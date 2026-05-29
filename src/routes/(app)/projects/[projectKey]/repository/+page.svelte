<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import TagFilterBar from '$lib/components/TagFilterBar.svelte';
  import TagInput from '$lib/components/TagInput.svelte';
  import type { TagInput as TagInputType, TagView } from '$lib/api/testcases';
  import { Dialog } from 'bits-ui';
  import { createColumnHelper, type ColumnDef } from '@tanstack/table-core';
  import { z } from 'zod';
  import SetaraStepGridEditor from '$lib/components/scenario/SetaraStepGridEditor.svelte';
  import type { BackendStep } from '$lib/components/scenario/step-grid.types';
  import { getValidSession, hasPermission } from '$lib/auth';
  import {
    approveDraftScenarios,
    archiveScenario,
    bulkCopyScenarios,
    bulkDeleteScenarios,
    checkScenarioExists,
    createDirectory,
    deleteDirectory,
    moveDirectory,
    rejectDraftScenarios,
    renameDirectory,
    getScenario,
    updateScenario,
    searchSimilarScenarios,
    type Scenario,
    type ScenarioStep,
    type TestDirectory,
    type SimilarScenarioResult
  } from '$lib/api/testcases';

  let { data } = $props();

  let canWrite = $state(false);

  type TreeNode = TestDirectory & { children: TreeNode[]; directCount: number; totalCount: number };

  // ── Core state ───────────────────────────────────────────────
  let selectedNodeId = $state<string | null>(null);
  let reviewMode = $state<'LIVE' | 'DRAFT'>('LIVE');
  let selectedScenarioIds = $state<string[]>([]);
  let expandedIds = $state<Set<string>>(new Set());
  let busy = $state(false);
  let actionError = $state('');
  let copyMessage = $state('');
  let detailScenario = $state<Scenario | null>(null);
  let detailDraft = $state<Scenario | null>(null);
  let detailBusy = $state(false);
  let detailOpen = $state(false);
  let detailSteps = $state<BackendStep[]>([]);
  let detailDraftTags = $state<{ sanitized: string; display: string }[]>([]);

  // ── Similar scenarios ────────────────────────────────────────
  let similarScenarios = $state<SimilarScenarioResult[]>([]);
  let similarLoading = $state(false);
  let similarError = $state('');

  // ── Scenario sorting ─────────────────────────────────────────
  let scenarioSortBy = $state<'key' | 'name' | 'priority' | 'automation' | 'status'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  // ── Scenario filters ─────────────────────────────────────────
  let filterAutomation = $state<string>('');
  let filterPriority = $state<string>('');
  let filterSearch = $state<string>('');

  // ── Tag filters ──────────────────────────────────────────────
  let filterTags = $state<string[]>([]);
  let filterTagMode = $state<'ANY' | 'ALL'>('ANY');

  // ── Create directory modal ───────────────────────────────────
  let showDirectoryModal = $state(false);
  let directoryParentId = $state<string | null>(null);
  let directoryName = $state('');

  // ── Rename directory modal ───────────────────────────────────
  let showRenameModal = $state(false);
  let renameNodeId = $state<string | null>(null);
  let renameNodeCurrentName = $state('');
  let renameNodeNewName = $state('');

  // ── Move directory modal ─────────────────────────────────────
  let showMoveModal = $state(false);
  let moveNodeId = $state<string | null>(null);
  let moveNodeName = $state('');
  let moveTargetParentId = $state<string | 'ROOT' | null>(null);
  let moveSearch = $state('');

  // ── Delete directory modal ───────────────────────────────────
  let showDeleteDirModal = $state(false);
  let deleteDirNodeId = $state<string | null>(null);
  let deleteDirName = $state('');

  // ── Copy scenarios modal ─────────────────────────────────────
  let showCopyModal = $state(false);
  let copyTargetNodeId = $state<string | null>(null);
  let copyDuplicateStrategy = $state<'SKIP_EXISTING' | 'FAIL_ON_DUPLICATE'>('SKIP_EXISTING');
  let copySearch = $state('');
  let copyExistenceChecking = $state(false);
  let copyExistenceResults = $state<Record<string, boolean>>({});
  let copyResult = $state<{ createdCount: number; skippedCount: number } | null>(null);

  // ── Derived ──────────────────────────────────────────────────
  const scopedScenarios = $derived(reviewMode === 'LIVE' ? data.scenarios : data.draftScenarios);
  const selectedDirectory = $derived(
    data.directories.find((d: TestDirectory) => d.id === selectedNodeId) ?? null
  );
  const tree = $derived(buildTree(data.directories, scopedScenarios));
  const visibleScenarios = $derived(
    selectedNodeId
      ? scopedScenarios.filter((s: Scenario) => s.nodeId === selectedNodeId)
      : scopedScenarios
  );
  const filteredScenarios = $derived(
    visibleScenarios.filter((s: Scenario) => {
      if (filterAutomation && s.automationStatus !== filterAutomation) return false;
      if (filterPriority && s.priority !== filterPriority) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        if (!s.name?.toLowerCase().includes(q) && !s.scenarioKey?.toLowerCase().includes(q)) return false;
      }
      // Tag filter: client-side, ANY or ALL mode
      if (filterTags.length > 0) {
        const scenarioSans = (s.tags ?? []).map(t => t.sanitized);
        if (filterTagMode === 'ALL') {
          if (!filterTags.every(t => scenarioSans.includes(t))) return false;
        } else {
          if (!filterTags.some(t => scenarioSans.includes(t))) return false;
        }
      }
      return true;
    })
  );
  const sortedScenarios = $derived(
    [...filteredScenarios].sort((a: Scenario, b: Scenario) => {
      const result = scenarioValue(a, scenarioSortBy).localeCompare(scenarioValue(b, scenarioSortBy));
      return scenarioSortDir === 'asc' ? result : -result;
    })
  );
  const uniquePriorities = $derived(
    [...new Set(scopedScenarios.map((s: Scenario) => s.priority).filter(Boolean))] as string[]
  );
  const availableTags = $derived(
    [...new Map(
      scopedScenarios
        .flatMap((s: Scenario) => s.tags ?? [])
        .filter(t => t.sanitized)
        .map(t => [t.sanitized, { sanitized: t.sanitized, display: t.display }] as const)
    ).values()]
  );
  const selectedTitle = $derived(selectedDirectory ? selectedDirectory.name : 'All Scenarios');
  const scenarioColumnHelper = createColumnHelper<Scenario>();
  const scenarioColumns = [
    scenarioColumnHelper.display({ id: 'select' }),
    scenarioColumnHelper.accessor('scenarioKey', { id: 'key' }),
    scenarioColumnHelper.accessor('name', { id: 'name' }),
    scenarioColumnHelper.accessor('steps', { id: 'steps' }),
    scenarioColumnHelper.accessor('priority', { id: 'priority' }),
    scenarioColumnHelper.accessor('automatable', { id: 'automatable' }),
    scenarioColumnHelper.accessor('status', { id: 'status' })
  ] satisfies ColumnDef<Scenario, any>[];
  const scenarioFormSchema = z.object({
    name: z.string().min(1),
    priority: z.string().nullable().optional(),
    automationStatus: z.string().optional(),
    status: z.string().min(1),
    manualNotes: z.string().nullable().optional(),
    steps: z.array(z.object({
      keyword: z.string().min(1),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      expectation: z.string().nullable().optional()
    }))
  });
  // Directories available as move targets (excludes selected node and its descendants)
  const moveCandidates = $derived(
    data.directories.filter((d: TestDirectory) => {
      if (!moveNodeId) return true;
      const movingNode = data.directories.find((n: TestDirectory) => n.id === moveNodeId);
      if (!movingNode) return true;
      return d.id !== moveNodeId && !d.path?.startsWith(movingNode.path + '/');
    })
  );
  const filteredMoveCandidates = $derived(
    moveSearch.trim()
      ? moveCandidates.filter((d: TestDirectory) => d.name.toLowerCase().includes(moveSearch.toLowerCase()))
      : moveCandidates
  );
  const filteredCopyTargets = $derived(
    copySearch.trim()
      ? data.directories.filter((d: TestDirectory) => d.name.toLowerCase().includes(copySearch.toLowerCase()))
      : data.directories
  );

  // ── Init ─────────────────────────────────────────────────────
  onMount(() => {
    canWrite = hasPermission(getValidSession(), 'scenario:write');
  });

  $effect(() => {
    if (data.directories.length && expandedIds.size === 0) {
      expandedIds = new Set(
        data.directories
          .filter((n: TestDirectory) => n.parentId === null)
          .map((n: TestDirectory) => n.id)
      );
    }
  });

  // ── Tree builder ─────────────────────────────────────────────
  function buildTree(nodes: TestDirectory[], scenarios: Scenario[]): TreeNode[] {
    const byId = new Map<string, TreeNode>();
    for (const node of nodes) {
      byId.set(node.id, { ...node, children: [], directCount: 0, totalCount: 0 });
    }
    for (const scenario of scenarios) {
      const node = byId.get(scenario.nodeId);
      if (node) node.directCount += 1;
    }
    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const count = (node: TreeNode): number => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.totalCount = node.directCount + node.children.reduce((sum, child) => sum + count(child), 0);
      return node.totalCount;
    };
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(count);
    return roots;
  }

  // ── Sorting helpers ──────────────────────────────────────────
  function scenarioValue(scenario: Scenario, field: string): string {
    switch (field) {
      case 'key':        return scenario.scenarioKey ?? '';
      case 'priority':   return scenario.priority ?? '';
      case 'automation': return scenario.automationStatus ?? '';
      case 'status':     return scenario.status ?? '';
      default:           return scenario.name ?? '';
    }
  }

  function sortScenarios(field: typeof scenarioSortBy) {
    scenarioSortDir = scenarioSortBy === field && scenarioSortDir === 'asc' ? 'desc' : 'asc';
    scenarioSortBy = field;
  }

  function sortIndicator(field: typeof scenarioSortBy): string {
    if (scenarioSortBy !== field) return '';
    return scenarioSortDir === 'asc' ? '↑' : '↓';
  }

  function directScenariosForNode(nodeId: string): Scenario[] {
    return scopedScenarios
      .filter((scenario: Scenario) => scenario.nodeId === nodeId)
      .sort((a: Scenario, b: Scenario) => a.name.localeCompare(b.name));
  }

  async function openScenarioDetail(scenario: Scenario) {
    detailScenario = scenario;
    detailDraft = structuredClone(scenario);
    detailSteps = (scenario.steps ?? []).map((s) => ({
      sequenceNo: s.sequenceNo,
      keyword: s.keyword,
      name: s.name,
      description: s.description,
      expectation: s.expectation
    }));
    detailDraftTags = (scenario.tags ?? []).map(t => ({ sanitized: t.sanitized, display: t.display }));
    detailOpen = true;
    detailBusy = true;
    try {
      const full = await getScenario(data.projectKey, scenario.id);
      detailScenario = full;
      detailDraft = structuredClone(full);
      detailSteps = (full.steps ?? []).map((s) => ({
        sequenceNo: s.sequenceNo,
        keyword: s.keyword,
        name: s.name,
        description: s.description,
        expectation: s.expectation
      }));
      detailDraftTags = (full.tags ?? []).map(t => ({ sanitized: t.sanitized, display: t.display }));
    } finally {
      detailBusy = false;
    }
    // Fetch similar scenarios
    fetchSimilarScenarios(scenario);
  }

  function closeScenarioDetail() {
    detailOpen = false;
    detailScenario = null;
    detailDraft = null;
    detailSteps = [];
    detailDraftTags = [];
    similarScenarios = [];
    similarError = '';
  }

  async function fetchSimilarScenarios(scenario: Scenario) {
    similarScenarios = [];
    similarError = '';
    similarLoading = true;
    try {
      const query = [scenario.name, scenario.scenarioKey]
        .filter(Boolean)
        .join(' ');
      similarScenarios = await searchSimilarScenarios(data.projectKey, query, 8);
    } catch (e) {
      similarError = (e as Error).message;
    } finally {
      similarLoading = false;
    }
  }

  async function saveDetailScenario() {
    const draft = detailDraft;
    if (!draft) return;
    if (!draft.name?.trim()) {
      actionError = 'Scenario name is required.';
      return;
    }
    const hasEmptySteps = detailSteps.some((s) => !s.name?.trim());
    if (hasEmptySteps) {
      actionError = 'All steps must have a non-empty step text before saving.';
      return;
    }
    await runAction(async () => {
      const saved = await updateScenario(data.projectKey, draft.id, {
        name: draft.name,
        priority: draft.priority ?? undefined,
        automatable: draft.automatable,
        status: draft.status,
        automationStatus: draft.automationStatus,
        manualNotes: draft.manualNotes ?? undefined,
        automationNotes: draft.automationNotes ?? undefined,
        tags: detailDraftTags.length > 0 ? detailDraftTags.map(t => ({ sanitized: t.sanitized, display: t.display })) : [],
        steps: detailSteps.map((s, i) => ({
          sequenceNo: i + 1,
          keyword: s.keyword,
          name: s.name,
          description: s.description,
          expectation: s.expectation
        }))
      });
      detailScenario = saved;
      detailDraft = structuredClone(saved);
      detailSteps = (saved.steps ?? []).map((s) => ({
        sequenceNo: s.sequenceNo,
        keyword: s.keyword,
        name: s.name,
        description: s.description,
        expectation: s.expectation
      }));
    });
  }

  function copyDetailScenarioId(e: MouseEvent) {
    if (!detailDraft) return;
    copyText(detailDraft.id, 'Scenario id', e);
  }

  // ── Tree interaction ─────────────────────────────────────────
  function toggleExpand(nodeId: string, e?: MouseEvent) {
    e?.stopPropagation();
    const next = new Set(expandedIds);
    next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
    expandedIds = next;
  }

  function selectNode(nodeId: string | null) {
    selectedNodeId = nodeId;
    selectedScenarioIds = [];
  }

  function setReviewMode(mode: 'LIVE' | 'DRAFT') {
    reviewMode = mode;
    selectedScenarioIds = [];
    filterAutomation = '';
    filterPriority = '';
    filterSearch = '';
  }

  function toggleScenario(id: string) {
    selectedScenarioIds = selectedScenarioIds.includes(id)
      ? selectedScenarioIds.filter((x) => x !== id)
      : [...selectedScenarioIds, id];
  }

  function toggleAllVisible() {
    selectedScenarioIds =
      selectedScenarioIds.length === sortedScenarios.length
        ? []
        : sortedScenarios.map((s: Scenario) => s.id);
  }

  // ── Shared action runner ─────────────────────────────────────
  async function runAction(work: () => Promise<void>) {
    busy = true;
    actionError = '';
    try {
      await work();
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function copyText(value: string, label: string, e?: MouseEvent) {
    e?.stopPropagation();
    await navigator.clipboard.writeText(value);
    copyMessage = `${label} copied`;
    setTimeout(() => (copyMessage = ''), 1800);
  }

  function createScenarioUrl(nodeId: string | null): string {
    const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : '';
    return `/projects/${data.projectKey}/repository/scenarios/new${query}`;
  }

  // ── Create directory ─────────────────────────────────────────
  function openNodeModal(parentId: string | null) {
    directoryParentId = parentId;
    directoryName = '';
    showDirectoryModal = true;
  }

  async function handleCreateNode(e: SubmitEvent) {
    e.preventDefault();
    if (!directoryName.trim()) return;
    await runAction(async () => {
      const node = await createDirectory(data.projectKey, {
        parentId: directoryParentId,
        name: directoryName.trim()
      });
      selectedNodeId = node.id;
      expandedIds = new Set([...expandedIds, directoryParentId ?? node.id]);
      showDirectoryModal = false;
      directoryName = '';
    });
  }

  // ── Rename directory ─────────────────────────────────────────
  function openRenameModal(nodeId: string, currentName: string) {
    renameNodeId = nodeId;
    renameNodeCurrentName = currentName;
    renameNodeNewName = currentName;
    showRenameModal = true;
  }

  async function handleRenameDirectory(e: SubmitEvent) {
    e.preventDefault();
    if (!renameNodeNewName.trim() || !renameNodeId) return;
    await runAction(async () => {
      await renameDirectory(data.projectKey, renameNodeId!, renameNodeNewName.trim());
      showRenameModal = false;
    });
  }

  // ── Move directory ───────────────────────────────────────────
  function openMoveModal(nodeId: string, nodeName: string) {
    moveNodeId = nodeId;
    moveNodeName = nodeName;
    moveTargetParentId = null;
    moveSearch = '';
    showMoveModal = true;
  }

  async function handleMoveDirectory() {
    if (moveNodeId === null || moveTargetParentId === null) return;
    await runAction(async () => {
      const newParentId = moveTargetParentId === 'ROOT' ? null : (moveTargetParentId as string);
      await moveDirectory(data.projectKey, moveNodeId!, newParentId);
      showMoveModal = false;
    });
  }

  // ── Delete directory ─────────────────────────────────────────
  function openDeleteDirModal(nodeId: string, name: string) {
    deleteDirNodeId = nodeId;
    deleteDirName = name;
    showDeleteDirModal = true;
  }

  async function handleDeleteDirectory() {
    if (!deleteDirNodeId) return;
    await runAction(async () => {
      await deleteDirectory(data.projectKey, deleteDirNodeId!);
      if (selectedNodeId === deleteDirNodeId) selectedNodeId = null;
      showDeleteDirModal = false;
    });
  }

  // ── Bulk draft operations ────────────────────────────────────
  async function handleBulkApprove() {
    if (selectedScenarioIds.length === 0) return;
    await runAction(async () => {
      await approveDraftScenarios(data.projectKey, selectedScenarioIds);
      setReviewMode('LIVE');
    });
  }

  async function handleBulkReject() {
    if (selectedScenarioIds.length === 0) return;
    await runAction(async () => {
      await rejectDraftScenarios(data.projectKey, selectedScenarioIds);
      selectedScenarioIds = [];
    });
  }

  // ── Bulk archive ─────────────────────────────────────────────
  async function handleBulkArchive() {
    if (selectedScenarioIds.length === 0) return;
    if (!confirm(`Archive ${selectedScenarioIds.length} scenario(s)?`)) return;
    await runAction(async () => {
      for (const id of selectedScenarioIds) await archiveScenario(data.projectKey, id);
      selectedScenarioIds = [];
    });
  }

  // ── Bulk delete (hard) ───────────────────────────────────────
  async function handleBulkDelete() {
    if (selectedScenarioIds.length === 0) return;
    if (
      !confirm(
        `Permanently delete ${selectedScenarioIds.length} scenario(s)?\n\nThis cannot be undone. Scenarios in release plans cannot be deleted.`
      )
    )
      return;
    await runAction(async () => {
      await bulkDeleteScenarios(data.projectKey, selectedScenarioIds);
      selectedScenarioIds = [];
    });
  }

  // ── Copy scenarios ───────────────────────────────────────────
  function openCopyModal() {
    if (selectedScenarioIds.length === 0) return;
    copyTargetNodeId = null;
    copyDuplicateStrategy = 'SKIP_EXISTING';
    copySearch = '';
    copyExistenceResults = {};
    copyResult = null;
    showCopyModal = true;
  }

  async function checkExistenceInTarget(targetNodeId: string) {
    copyExistenceChecking = true;
    copyExistenceResults = {};
    try {
      const selectedNames = selectedScenarioIds
        .map((id) => scopedScenarios.find((s: Scenario) => s.id === id)?.name)
        .filter(Boolean) as string[];
      const results: Record<string, boolean> = {};
      await Promise.all(
        selectedNames.map(async (name) => {
          const res = await checkScenarioExists(data.projectKey, targetNodeId, name);
          results[name] = res.exists;
        })
      );
      copyExistenceResults = results;
    } finally {
      copyExistenceChecking = false;
    }
  }

  async function handleCopyScenarios() {
    if (!copyTargetNodeId || selectedScenarioIds.length === 0) return;
    await runAction(async () => {
      const result = await bulkCopyScenarios(data.projectKey, {
        scenarioIds: selectedScenarioIds,
        targetNodeId: copyTargetNodeId!,
        duplicateStrategy: copyDuplicateStrategy
      });
      copyResult = { createdCount: result.createdCount, skippedCount: result.skippedCount };
      selectedScenarioIds = [];
    });
  }
</script>

<svelte:head>
  <title>Test Repository — {data.projectKey} — Setara</title>
</svelte:head>

<!-- ── SVG icon snippets ────────────────────────────────── -->
{#snippet iconLayers()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>{/snippet}
{#snippet iconFolder()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>{/snippet}
{#snippet iconFolderOpen()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>{/snippet}
{#snippet iconFile()}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>{/snippet}
{#snippet iconChevronRight()}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>{/snippet}
{#snippet iconChevronDown()}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>{/snippet}
{#snippet iconFolderPlus()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>{/snippet}
{#snippet iconFilePlus()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>{/snippet}
{#snippet iconPencil()}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>{/snippet}
{#snippet iconMove()}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 7 12 2 7 7"/><polyline points="17 17 12 22 7 17"/></svg>{/snippet}
{#snippet iconTrash()}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>{/snippet}
{#snippet iconCopy()}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{/snippet}
{#snippet iconUpload()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>{/snippet}

{#snippet iconExcel()}<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/><path d="m13 12 2 3 2-3m-4 0 2-3 2 3" stroke-width="1.5"/></svg>{/snippet}

{#snippet iconManual()}<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></svg>{/snippet}

{#snippet iconAutomatable()}<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>{/snippet}

{#snippet iconAutomated()}<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/><polyline points="8.5 21 11 18.5 13 20.5 16.5 17" stroke-width="2"/></svg>{/snippet}

<div class="page">
  {#if data.error}<div class="error-banner">Could not load repository — {data.error}</div>{/if}
  {#if actionError}<div class="error-banner">{actionError}</div>{/if}
  {#if copyMessage}<div class="toast">{copyMessage}</div>{/if}

  <div class="repo-layout">
    <!-- ── Directory tree ──────────────────────────────────────── -->
    <aside class="tree-panel">
      <div class="tree-topbar">
        <span class="panel-title">Test Repository</span>
        <div class="tree-topbar-actions">
          <button class="icon-btn" title="Add root directory" aria-label="Add root directory" onclick={() => openNodeModal(null)}>{@render iconFolderPlus()}</button>
        </div>
      </div>

      <div class="tree-scroll">
        <button
          class="tree-all-btn"
          class:active={selectedNodeId === null}
          onclick={() => selectNode(null)}
        >
          <span class="all-icon">{@render iconLayers()}</span>
          <span class="all-label">All Scenarios</span>
          <span class="count-pill">{scopedScenarios.length}</span>
        </button>

        <div class="tree-list">
        {#snippet treeRows(nodes: TreeNode[])}
          {#each nodes as node}
            <div class="tree-row">
              <div class="tree-line">
                <button
                  class="tree-caret-btn"
                  onclick={(e) => toggleExpand(node.id, e)}
                  aria-label={expandedIds.has(node.id) ? 'Collapse' : 'Expand'}
                  tabindex="-1"
                >
                  {#if node.children.length || node.directCount}
                    {#if expandedIds.has(node.id)}{@render iconChevronDown()}{:else}{@render iconChevronRight()}{/if}
                  {/if}
                </button>
                <button
                  class="tree-node"
                  class:active={selectedNodeId === node.id}
                  onclick={() => { selectNode(node.id); if (node.children.length || node.directCount) toggleExpand(node.id, new MouseEvent('click')); }}
                >
                  <span class="node-icon folder">{#if expandedIds.has(node.id)}{@render iconFolderOpen()}{:else}{@render iconFolder()}{/if}</span>
                  <span class="node-label"><strong>{node.name}</strong></span>
                  <span class="count-pill">{node.totalCount}</span>
                </button>
              </div>
            </div>
            {#if expandedIds.has(node.id)}
              <div class="tree-children">
                {@render treeRows(node.children)}
                {#each directScenariosForNode(node.id) as scenario}
                  <div class="scenario-leaf">
                    <button
                      class="leaf-main"
                      onclick={() => openScenarioDetail(scenario)}
                    >
                      <span class="leaf-indent"></span>
                      <span class="node-icon file">{@render iconFile()}</span>
                      <span class="node-label">{scenario.name}</span>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          {/each}
        {/snippet}
        {@render treeRows(tree)}
        </div>
      </div>
    </aside>

    <!-- ── Scenario panel ─────────────────────────────────────── -->
    <section class="scenario-panel">
      <div class="scenario-topbar">
        <div>
          <div class="title-row">
            <h1>{selectedTitle}</h1>
            <span class="scenario-count-badge">{sortedScenarios.length} scenarios</span>
          </div>
          <p class="panel-subtitle">{selectedDirectory?.path ?? data.projectKey}</p>
          {#if selectedDirectory}
            <div class="directory-toolbar" aria-label="Directory actions">
              <button class="dir-action-btn" title="Copy directory ID" aria-label="Copy directory ID" onclick={(e) => copyText(selectedDirectory.directoryId ?? selectedDirectory.id, 'Directory id', e)}>{@render iconCopy()} <span>Copy ID</span></button>
              <a class="dir-action-btn" title="Open directory coverage map" aria-label="Open directory coverage map" href="/projects/{data.projectKey}/repository/directories/{selectedDirectory.directoryId ?? selectedDirectory.id}/coverage-map">{@render iconLayers()} <span>Directory Map</span></a>
              <button class="dir-action-btn" title="Add sub-directory" aria-label="Add sub-directory" onclick={(e) => { e.stopPropagation(); openNodeModal(selectedDirectory.id); }}>{@render iconFolderPlus()} <span>Sub Dir</span></button>
              <button class="dir-action-btn" title="Add scenario" aria-label="Add scenario" onclick={(e) => { e.stopPropagation(); goto(createScenarioUrl(selectedDirectory.id)); }}>{@render iconFilePlus()} <span>Scenario</span></button>
              {#if canWrite}
                <button class="dir-action-btn" title="Rename directory" aria-label="Rename directory" onclick={(e) => { e.stopPropagation(); openRenameModal(selectedDirectory.id, selectedDirectory.name); }}>{@render iconPencil()} <span>Rename</span></button>
                <button class="dir-action-btn" title="Move directory" aria-label="Move directory" onclick={(e) => { e.stopPropagation(); openMoveModal(selectedDirectory.id, selectedDirectory.name); }}>{@render iconMove()} <span>Move</span></button>
                <button class="dir-action-btn danger" title="Delete directory" aria-label="Delete directory" onclick={(e) => { e.stopPropagation(); openDeleteDirModal(selectedDirectory.id, selectedDirectory.name); }}>{@render iconTrash()} <span>Delete</span></button>
              {/if}
            </div>
          {/if}
        </div>
        <div class="header-actions">
          <div class="segmented">
            <button class:active={reviewMode === 'LIVE'} onclick={() => setReviewMode('LIVE')}>Live</button>
            <button class:active={reviewMode === 'DRAFT'} onclick={() => setReviewMode('DRAFT')}>Drafts</button>
          </div>
          {#if canWrite}
            <a class="dir-action-btn" title="Semantic search" aria-label="Semantic search" href="/projects/{data.projectKey}/repository/semantic-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> AI Search
            </a>
            <a class="dir-action-btn import-action" title="Import scenarios from Excel" aria-label="Import scenarios from Excel" href="/projects/{data.projectKey}/repository/import">{@render iconUpload()} Import</a>
            <button class="dir-action-btn" title="Add scenario" aria-label="Add scenario" onclick={() => goto(createScenarioUrl(selectedNodeId))} disabled={!selectedNodeId}>{@render iconFilePlus()} Add Scenario</button>
          {/if}
        </div>
      </div>

      <!-- Filter / search bar -->
      <div class="filter-bar">
        <div class="search-wrap">
          <input
            class="search-input"
            type="search"
            placeholder="Search by name or key…"
            bind:value={filterSearch}
          />
        </div>
        <label class="filter-group">
          <span class="filter-label-text">Type</span>
          <select class="filter-select" bind:value={filterAutomation}>
            <option value="">All types</option>
            <option value="MANUAL_ONLY">Manual Only</option>
            <option value="AUTOMATABLE">Automatable</option>
            <option value="AUTOMATED">Automated</option>
          </select>
        </label>
        <label class="filter-group">
          <span class="filter-label-text">Priority</span>
          <select class="filter-select" bind:value={filterPriority}>
            <option value="">All</option>
            {#each uniquePriorities.sort() as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </label>
        {#if filterAutomation || filterPriority || filterSearch.trim()}
          <button
            class="clear-filter"
            onclick={() => { filterAutomation = ''; filterPriority = ''; filterSearch = ''; }}
          >✕ Clear</button>
        {/if}
      </div>

      <TagFilterBar
        availableTags={availableTags}
        selectedTags={filterTags}
        tagMode={filterTagMode}
        onchange={(tags, mode) => { filterTags = tags; filterTagMode = mode as 'ANY' | 'ALL'; }}
      />

      <!-- Bulk action bar — only visible when rows are selected -->
      {#if selectedScenarioIds.length > 0}
        <div class="bulk-bar">
          <span class="bulk-count">{selectedScenarioIds.length} selected</span>
          {#if canWrite}
            {#if reviewMode === 'DRAFT'}
              <button onclick={handleBulkApprove} disabled={busy}>Approve</button>
              <button class="danger" onclick={handleBulkReject} disabled={busy}>Reject</button>
            {:else}
              <button onclick={handleBulkArchive} disabled={busy}>Archive</button>
            {/if}
          {/if}
          <button onclick={openCopyModal} disabled={busy} title="Copy selected scenarios to another directory">Copy to…</button>
          {#if canWrite}
            <button class="danger" onclick={handleBulkDelete} disabled={busy} title="Permanently delete selected scenarios">Delete</button>
          {/if}
        </div>
      {/if}

      <!-- Scenario table -->
      {#if sortedScenarios.length === 0}
        <div class="empty-state">
          {filteredScenarios.length < visibleScenarios.length
            ? 'No scenarios match the current filters.'
            : `No ${reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios in this directory.`}
        </div>
      {:else}
        <DataTable>
          {#snippet head()}
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedScenarioIds.length === sortedScenarios.length && sortedScenarios.length > 0}
                  onchange={toggleAllVisible}
                />
              </th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('name')}>
                  Name <span class="sort-indicator">{sortIndicator('name')}</span>
                </button>
              </th>
              <th>Steps</th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('priority')}>
                  Priority <span class="sort-indicator">{sortIndicator('priority')}</span>
                </button>
              </th>
              <th class="col-auto" title="Automation Status">
                <span class="auto-legend" title="Manual / Automatable / Automated">{@render iconManual()}&hairsp;{@render iconAutomatable()}&hairsp;{@render iconAutomated()}</span>
              </th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('status')}>
                  Status <span class="sort-indicator">{sortIndicator('status')}</span>
                </button>
              </th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each sortedScenarios as scenario}
              <tr class="click-row" onclick={() => openScenarioDetail(scenario)}>
                <td onclick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedScenarioIds.includes(scenario.id)}
                    onchange={() => toggleScenario(scenario.id)}
                  />
                </td>
                <td class="name-cell" onclick={(e) => e.stopPropagation()}>
                  <div class="name-cell-inner">
                    <div class="name-cell-text">
                      <span class="scenario-key">{scenario.scenarioKey}</span>
                      <button class="name-link" onclick={() => openScenarioDetail(scenario)}>{scenario.name}</button>
                    </div>
                    <button class="ta-btn copy-name-btn" title="Copy scenario ID" aria-label="Copy scenario ID" onclick={(e) => copyText(scenario.id, 'Scenario id', e)}>{@render iconCopy()}</button>
                  </div>
                </td>
                <td>
                  <div class="steps-preview">
                    {#each (scenario.steps ?? []).slice(0, 3) as step, index}
                      <button
                        class:washed={index >= 2}
                        onclick={(e) => { e.stopPropagation(); openScenarioDetail(scenario); }}
                      >
                        <span>{step.sequenceNo}</span>
                        {step.keyword} {step.name}
                      </button>
                    {/each}
                    {#if (scenario.steps?.length ?? 0) >= 3}
                      <button class="show-more" onclick={(e) => { e.stopPropagation(); openScenarioDetail(scenario); }}>Show more</button>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class="status-badge priority priority-{(scenario.priority ?? 'unset').toLowerCase()}">{scenario.priority ?? 'UNSET'}</span>
                </td>
                <td class="col-auto">
                  {#if scenario.automationStatus === 'AUTOMATED'}
                    <span class="auto-icon is-automated" title="Automated">{@render iconAutomated()}</span>
                  {:else if scenario.automationStatus === 'AUTOMATABLE'}
                    <span class="auto-icon is-automatable" title="Automatable">{@render iconAutomatable()}</span>
                  {:else}
                    <span class="auto-icon is-manual" title="Manual only">{@render iconManual()}</span>
                  {/if}
                </td>
                <td>
                  <span class="status-badge status-{scenario.status.toLowerCase()}">{scenario.status}</span>
                </td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </section>
  </div>
</div>

<!-- ── Create directory modal ──────────────────────────────────── -->
<Modal open={showDirectoryModal} title="Create Directory" onclose={() => (showDirectoryModal = false)}>
  <form class="modal-form" onsubmit={handleCreateNode}>
    <label>
      <span>Name</span>
      <input bind:value={directoryName} placeholder="Directory name" disabled={busy} required />
    </label>
    <div class="form-actions">
      <button type="button" onclick={() => (showDirectoryModal = false)} disabled={busy}>Cancel</button>
      <button class="primary-btn" type="submit" disabled={busy || !directoryName.trim()}>Create</button>
    </div>
  </form>
</Modal>

<!-- ── Rename directory modal ─────────────────────────────────── -->
<Modal open={showRenameModal} title="Rename Directory" onclose={() => (showRenameModal = false)}>
  <form class="modal-form" onsubmit={handleRenameDirectory}>
    <p class="modal-hint">Current name: <strong>{renameNodeCurrentName}</strong></p>
    <label>
      <span>New name</span>
      <input bind:value={renameNodeNewName} placeholder="New directory name" disabled={busy} required />
    </label>
    <div class="form-actions">
      <button type="button" onclick={() => (showRenameModal = false)} disabled={busy}>Cancel</button>
      <button
        class="primary-btn"
        type="submit"
        disabled={busy || !renameNodeNewName.trim() || renameNodeNewName.trim() === renameNodeCurrentName}
      >Rename</button>
    </div>
  </form>
</Modal>

<!-- ── Move directory modal ───────────────────────────────────── -->
<Modal open={showMoveModal} title="Move Directory" onclose={() => (showMoveModal = false)}>
  <div class="modal-form">
    <p class="modal-hint">Moving: <strong>{moveNodeName}</strong></p>
    <label class="search-label">
      <span>Search directories</span>
      <input bind:value={moveSearch} placeholder="Filter…" />
    </label>
    <div class="dir-pick-list">
      <button
        class="dir-pick-item"
        class:selected={moveTargetParentId === 'ROOT'}
        onclick={() => (moveTargetParentId = 'ROOT')}
      >
        <span class="node-icon small">R</span>
        <span>Root level (no parent)</span>
      </button>
      {#each filteredMoveCandidates as dir}
        <button
          class="dir-pick-item"
          class:selected={moveTargetParentId === dir.id}
          onclick={() => (moveTargetParentId = dir.id)}
        >
          <span class="node-icon small">D</span>
          <span>
            <strong>{dir.name}</strong>
            <small class="muted">{dir.path}</small>
          </span>
        </button>
      {/each}
      {#if filteredMoveCandidates.length === 0}
        <p class="empty-pick">No directories found.</p>
      {/if}
    </div>
    <div class="form-actions">
      <button onclick={() => (showMoveModal = false)} disabled={busy}>Cancel</button>
      <button
        class="primary-btn"
        onclick={handleMoveDirectory}
        disabled={busy || moveTargetParentId === null}
      >Move Here</button>
    </div>
  </div>
</Modal>

<!-- ── Delete directory confirmation ──────────────────────────── -->
<Modal open={showDeleteDirModal} title="Delete Directory" onclose={() => (showDeleteDirModal = false)}>
  <div class="modal-form">
    <p class="modal-hint danger-hint">
      Delete <strong>{deleteDirName}</strong>? This only works on empty directories (no scenarios, no sub-directories).
    </p>
    <div class="form-actions">
      <button onclick={() => (showDeleteDirModal = false)} disabled={busy}>Cancel</button>
      <button class="danger-btn" onclick={handleDeleteDirectory} disabled={busy}>
        Delete Directory
      </button>
    </div>
  </div>
</Modal>

<!-- ── Copy scenarios modal ────────────────────────────────────── -->
<Modal open={showCopyModal} title="Copy Scenarios to Directory" onclose={() => { showCopyModal = false; copyResult = null; }}>
  <div class="modal-form">
    {#if copyResult}
      <div class="copy-result">
        <p>
          <strong>{copyResult.createdCount}</strong> scenario(s) copied as drafts.
          {#if copyResult.skippedCount > 0}
            <span class="muted">{copyResult.skippedCount} skipped (already exist).</span>
          {/if}
        </p>
      </div>
      <div class="form-actions">
        <button class="primary-btn" onclick={() => { showCopyModal = false; copyResult = null; }}>
          Done
        </button>
      </div>
    {:else}
      <p class="modal-hint">Copying <strong>{selectedScenarioIds.length}</strong> scenario(s).</p>

      <label class="search-label">
        <span>Target directory</span>
        <input bind:value={copySearch} placeholder="Search directories…" />
      </label>

      <div class="dir-pick-list">
        {#each filteredCopyTargets as dir}
          <button
            class="dir-pick-item"
            class:selected={copyTargetNodeId === dir.id}
            onclick={async () => {
              copyTargetNodeId = dir.id;
              await checkExistenceInTarget(dir.id);
            }}
          >
            <span class="node-icon small">D</span>
            <span>
              <strong>{dir.name}</strong>
              <small class="muted">{dir.path}</small>
            </span>
          </button>
        {/each}
        {#if filteredCopyTargets.length === 0}
          <p class="empty-pick">No directories found.</p>
        {/if}
      </div>

      {#if copyTargetNodeId && !copyExistenceChecking && Object.keys(copyExistenceResults).length > 0}
        <div class="existence-summary">
          {#each Object.entries(copyExistenceResults) as [name, exists]}
            <div class="existence-row" class:exists>
              <span class="existence-dot" class:exists></span>
              <span class="existence-name">{name}</span>
              <span class="existence-label">{exists ? 'already exists' : 'new'}</span>
            </div>
          {/each}
        </div>
      {:else if copyExistenceChecking}
        <p class="modal-hint">Checking for duplicates…</p>
      {/if}

      <label class="search-label">
        <span>If duplicate found</span>
        <select class="filter-select" bind:value={copyDuplicateStrategy}>
          <option value="SKIP_EXISTING">Skip existing</option>
          <option value="FAIL_ON_DUPLICATE">Fail (stop on duplicate)</option>
        </select>
      </label>

      <div class="form-actions">
        <button onclick={() => (showCopyModal = false)} disabled={busy}>Cancel</button>
        <button
          class="primary-btn"
          onclick={handleCopyScenarios}
          disabled={busy || !copyTargetNodeId}
        >Copy</button>
      </div>
    {/if}
  </div>
</Modal>

<!-- ── Scenario detail drawer ───────────────────────────────────── -->
<Dialog.Root bind:open={detailOpen} onOpenChange={(open) => { if (!open) closeScenarioDetail(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="drawer-overlay" />
    <Dialog.Content class="scenario-drawer">
      <div class="drawer-header">
        <div>
          <Dialog.Title class="drawer-title">{detailDraft?.name ?? detailScenario?.name ?? 'Scenario'}</Dialog.Title>
          <p class="drawer-subtitle">{detailDraft?.scenarioKey ?? detailScenario?.scenarioKey ?? 'Loading...'}</p>
        </div>
        <Dialog.Close class="drawer-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </Dialog.Close>
      </div>

      {#if detailBusy && !detailDraft}
        <div class="empty-state compact">Loading scenario...</div>
      {:else if detailDraft}
        <div class="scenario-editor">
          <div class="editor-top">
            <div class="id-row">
              <span class="id-label">ID</span>
              <strong class="id-value">{detailDraft.scenarioKey}</strong>
              <button class="ta-btn" title="Copy scenario ID" aria-label="Copy scenario ID" onclick={copyDetailScenarioId}>{@render iconCopy()}</button>
              {#if detailDraft.source === 'AUTOMATED'}
                <span class="source-badge automated" title="Ingested from automation">⚙ From Automation</span>
              {:else}
                <span class="source-badge manual" title="Manually created">✎ Manual</span>
              {/if}
              {#if detailBusy}<span class="sync-pill">Syncing</span>{/if}
            </div>
            <div class="editor-grid">
              <label>
                <span>Name</span>
                <input bind:value={detailDraft.name} />
              </label>
              <label>
                <span>Priority</span>
                <select bind:value={detailDraft.priority}>
                  <option value="">Unset</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select bind:value={detailDraft.status}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
              <label>
                <span>Automation Type</span>
                <select
                  value={detailDraft.automationStatus}
                  onchange={(e) => {
                    if (!detailDraft) return;
                    const val = (e.currentTarget as HTMLSelectElement).value;
                    detailDraft = {
                      ...detailDraft,
                      automationStatus: val,
                      automatable: val === 'AUTOMATABLE' || val === 'AUTOMATED'
                    };
                  }}
                  disabled={detailDraft.source === 'AUTOMATED'}
                  title={detailDraft.source === 'AUTOMATED' ? 'Set automatically from ingestion' : ''}
                >
                  <option value="MANUAL_ONLY">Manual Only</option>
                  <option value="AUTOMATABLE">Automatable</option>
                  <option value="AUTOMATED">Automated</option>
                </select>
              </label>
            </div>
            <label class="description-field">
              <span>Description / Notes</span>
              <textarea bind:value={detailDraft.manualNotes} rows="3" placeholder="Scenario notes or acceptance context"></textarea>
            </label>
          </div>

          <div class="tag-edit-field">
            <span class="editor-label">Tags <span class="opt">(optional, max 20)</span></span>
            <TagInput
              tags={detailDraftTags.map(t => ({ id: '', sanitized: t.sanitized, display: t.display }))}
              suggestions={availableTags}
              disabled={detailBusy}
              maxTags={20}
              onchange={(updated: TagInputType[]) => { detailDraftTags = updated; }}
            />
          </div>

          <!-- RevoGrid step editor -->
          <div class="steps-section">
            <h3 class="steps-section-title">Steps</h3>
            <SetaraStepGridEditor
              steps={detailSteps}
              readonly={detailDraft.source === 'AUTOMATED'}
              onchange={(updated) => { detailSteps = updated; }}
            />
          </div>

          <!-- Similar scenarios -->
          <div class="similar-section">
            <h3 class="steps-section-title">Similar Scenarios</h3>
            {#if similarLoading}
              <p class="similar-hint">Searching for similar scenarios…</p>
            {:else if similarError}
              <p class="similar-hint error">Similarity search unavailable: {similarError}</p>
            {:else if similarScenarios.length === 0}
              <p class="similar-hint">No similar scenarios found.</p>
            {:else}
              <div class="similar-list">
                {#each similarScenarios as sim}
                  <a
                    href="/projects/{data.projectKey}/repository?scenario={sim.scenarioId}"
                    class="similar-item"
                  >
                    <div class="similar-main">
                      <span class="similar-key">{sim.scenarioKey}</span>
                      <span class="similar-name">{sim.name}</span>
                      {#if sim.path}<span class="similar-path">{sim.path}</span>{/if}
                    </div>
                    <span class="similar-score" style="--score:{sim.score * 100}%">
                      {(sim.score * 100).toFixed(0)}%
                    </span>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Footer always visible at bottom of drawer -->
        <div class="drawer-footer">
          {#if actionError}<span class="footer-error">{actionError}</span>{/if}
          <Dialog.Close class="drawer-close-btn">Close</Dialog.Close>
          <button class="primary-btn" type="button" onclick={saveDetailScenario} disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .page { max-width: none; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .toast { position: fixed; right: 24px; bottom: 24px; background: var(--color-text); color: var(--color-bg); padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; z-index: 120; }
  .repo-layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: 0; min-height: calc(100vh - 112px); overflow: hidden; background: var(--color-surface); }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-surface); min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  .tree-scroll { flex: 1; overflow: auto; }
  .scenario-panel { min-width: 0; padding: 0 0 14px; background: var(--color-bg); overflow: auto; }
  .tree-topbar,
  .scenario-topbar { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
  .tree-topbar-actions,
  .header-actions,
  .directory-toolbar,
  .segmented { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .panel-title { font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .panel-subtitle { margin: 3px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }

  button, input, select { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.danger { color: var(--color-danger); border-color: transparent; }
  button.danger:hover:not(:disabled) { border-color: var(--color-danger); }
  button.danger-btn { background: var(--color-danger); color: #fff; border-color: var(--color-danger); }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  .primary-outline { border-color: color-mix(in srgb, var(--color-accent), transparent 55%); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 92%); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .icon-btn { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; text-decoration: none; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface); color: var(--color-text-muted); font-weight: 800; line-height: 1; }
  .icon-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .directory-toolbar { margin-top: 10px; max-width: min(100%, 760px); }
  .dir-action-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 10px; font-size: 0.76rem; font-weight: 760; line-height: 1; white-space: nowrap; color: var(--color-text-muted); }
  a.dir-action-btn { text-decoration: none; }
  .dir-action-btn svg { width: 14px; height: 14px; flex: 0 0 auto; }
  .dir-action-btn.danger { color: var(--color-danger, #ef4444); }
  /* Import button */
  .import-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; text-decoration: none; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: 0.78rem; font-weight: 700; line-height: 1; white-space: nowrap; transition: border-color 0.12s, color 0.12s; }
  .import-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
  input, select { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  input[type='checkbox'] { width: auto; }

  .tree-list { padding: 16px 14px 28px; }
  .tree-row { margin-bottom: 4px; position: relative; }
  .tree-line { display: flex; align-items: center; gap: 0; position: relative; }
  /* IDE-style connected guide lines using nested .tree-children containers */
  .tree-children {
    margin-left: 13px; /* aligns with center of caret button (26px wide) */
    padding-left: 13px;
    border-left: 1px solid color-mix(in srgb, var(--color-border), transparent 25%);
  }
  .scenario-leaf { display: flex; align-items: center; gap: 0; margin-bottom: 4px; position: relative; }
  .tree-caret-btn { display: inline-grid; place-items: center; width: 26px; height: 38px; flex-shrink: 0; border: 0; padding: 0; background: transparent; color: var(--color-text-muted); cursor: pointer; border-radius: 4px; }
  .tree-caret-btn:hover { color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .leaf-indent { display: inline-block; width: 26px; flex-shrink: 0; }
  .tree-node,
  .leaf-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; text-align: left; border-color: transparent; background: transparent; padding: 10px 10px 10px 4px; border-radius: 8px; }
  .tree-node.active,
  .tree-node:hover,
  .leaf-main:hover { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-color: transparent; }
  /* All Scenarios root button */
  .tree-all-btn { display: flex; align-items: center; gap: 12px; width: calc(100% - 32px); margin: 18px 16px 10px; padding: 16px 14px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--color-text); cursor: pointer; text-align: left; font: inherit; font-size: 0.95rem; }
  .tree-all-btn:hover,
  .tree-all-btn.active { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-color: transparent; }
  .all-icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: color-mix(in srgb, var(--color-accent), transparent 82%); color: var(--color-accent); font-size: 0.85rem; flex-shrink: 0; }
  .all-label { flex: 1; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ta-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border: none; background: transparent; color: var(--color-text-muted); border-radius: 5px; cursor: pointer; transition: background 0.1s, color 0.1s; flex-shrink: 0; }
  .ta-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); }
  .ta-btn.danger:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger, #ef4444), transparent 85%); color: var(--color-danger, #ef4444); }
  .ta-btn.ta-secondary { opacity: 0.75; }
  .ta-btn svg { display: block; pointer-events: none; }
  .node-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; color: var(--color-accent); flex-shrink: 0; }
  .node-icon.folder { background: color-mix(in srgb, var(--color-accent), transparent 82%); }
  .node-icon.file { background: transparent; color: var(--color-text-muted); }
  .node-icon.small { width: 20px; height: 20px; font-size: 0.7rem; }
  .node-label { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tree-node.active .node-label { color: var(--color-accent); }
  .node-label strong { font-weight: 750; }
  .count-pill,
  .scenario-count-badge { border-radius: 4px; background: color-mix(in srgb, var(--color-text-muted), transparent 82%); color: var(--color-text-muted); padding: 3px 8px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; flex-shrink: 0; }

  .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .title-row h1 { font-size: 1.25rem; line-height: 1.2; font-weight: 800; margin: 0; }
  .segmented { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; gap: 0; }
  .segmented button { border: 0; border-radius: 0; padding: 8px 13px; text-transform: uppercase; font-size: 0.78rem; font-weight: 850; background: transparent; }
  .segmented button.active { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); }
  /* Filter / search bar */
  .filter-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-bg); flex-wrap: wrap; }
  .search-wrap { flex: 1; min-width: 160px; max-width: 300px; position: relative; }
  .search-input { width: 100%; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.85rem; box-sizing: border-box; }
  .search-input:focus { outline: none; border-color: var(--color-accent); }
  .filter-group { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; }
  .filter-label-text { color: var(--color-text-muted); white-space: nowrap; font-weight: 600; }
  .filter-select { padding: 7px 8px; border-radius: 6px; font-size: 0.82rem; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); min-width: 110px; font: inherit; }
  .clear-filter { padding: 6px 10px; font-size: 0.78rem; border-radius: 6px; color: var(--color-text-muted); border-color: var(--color-border); white-space: nowrap; }

  /* Bulk action bar */
  .bulk-bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid color-mix(in srgb, var(--color-accent), transparent 75%); background: color-mix(in srgb, var(--color-accent), transparent 93%); flex-wrap: wrap; }
  .bulk-bar button { padding: 5px 10px; font-size: 0.78rem; }
  .bulk-count { font-size: 0.8rem; color: var(--color-accent); font-weight: 700; min-width: 72px; }

  /* Scenario table */
  .scenario-panel :global(.table-wrap) { border: 0; border-radius: 0; }
  .scenario-panel :global(th) { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.73rem; }
  .scenario-panel :global(td),
  .scenario-panel :global(th) { padding: 16px 18px; vertical-align: middle; }
  .scenario-panel :global(tbody tr:hover) { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .click-row { cursor: pointer; }
  /* Name cell: key above name + copy button */
  .name-cell { min-width: 240px; width: 30%; }
  .name-cell-inner { display: flex; align-items: center; gap: 10px; min-height: 50px; }
  .name-cell-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.75rem; color: var(--color-accent); font-weight: 700; }
  .name-link { border: 0; background: transparent; padding: 0; text-align: left; color: var(--color-text); font-weight: 700; line-height: 1.45; cursor: pointer; white-space: normal; }
  .name-link:hover { color: var(--color-accent); background: transparent; border: 0; }
  .copy-name-btn { opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
  tr:hover .copy-name-btn { opacity: 1; }
  /* Automatable column */
  .col-auto { width: 52px; text-align: center !important; }
  .auto-legend { display: inline-flex; align-items: center; gap: 1px; opacity: 0.6; }
  .auto-icon { display: inline-flex; }
  .auto-icon.is-manual { color: var(--color-text-muted); opacity: 0.55; }
  .auto-icon.is-automatable { color: #d97706; opacity: 1; }
  .auto-icon.is-automated { color: var(--color-success, #0d9488); opacity: 1; }
  .steps-preview { display: grid; gap: 7px; min-width: 300px; max-width: 460px; }
  .steps-preview button { display: flex; gap: 9px; align-items: flex-start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; border: 0; background: transparent; padding: 0; color: var(--color-text); font-size: 0.84rem; line-height: 1.35; }
  .steps-preview button span { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: color-mix(in srgb, var(--color-accent), transparent 86%); color: var(--color-accent); font-size: 0.68rem; font-weight: 800; flex: 0 0 auto; }
  .steps-preview button.washed { color: var(--color-text-muted); opacity: 0.5; }
  .steps-preview .show-more { color: var(--color-accent); font-weight: 800; width: max-content; opacity: 1; }
  .status-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 72px; width: max-content; border-radius: 999px; background: color-mix(in srgb, var(--color-success), transparent 86%); color: var(--color-success); padding: 5px 10px; font-size: 0.72rem; font-weight: 850; letter-spacing: 0.03em; }
  .status-badge.status-draft { background: color-mix(in srgb, #d97706, transparent 84%); color: #92400e; }
  .status-badge.status-active { background: color-mix(in srgb, var(--color-success), transparent 86%); color: var(--color-success); }
  .status-badge.status-archived { background: color-mix(in srgb, var(--color-text-muted), transparent 82%); color: var(--color-text-muted); }
  /* Priority badge color variants */
  .priority-critical { background: color-mix(in srgb, var(--color-danger, #ef4444), transparent 86%); color: var(--color-danger, #dc2626); }
  .priority-high { background: color-mix(in srgb, #f97316, transparent 84%); color: #c2410c; }
  .priority-medium { background: color-mix(in srgb, #3b82f6, transparent 86%); color: #1d4ed8; }
  .priority-low { background: color-mix(in srgb, #14b8a6, transparent 88%); color: #0f766e; }
  .priority-unset { background: color-mix(in srgb, var(--color-text-muted), transparent 86%); color: var(--color-text-muted); }
  .empty-state { color: var(--color-text-muted); font-size: 0.875rem; padding: 42px 20px; text-align: center; }
  .empty-state.compact { padding: 16px; }

  /* Modal common */
  .modal-form { display: grid; gap: 14px; }
  .modal-form label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .modal-hint { margin: 0; font-size: 0.82rem; color: var(--color-text-muted); }
  .danger-hint { color: var(--color-danger); }

  /* Directory picker */
  .search-label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .dir-pick-list { max-height: 240px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px; display: flex; flex-direction: column; gap: 1px; padding: 4px; }
  .dir-pick-item { display: flex; align-items: center; gap: 8px; text-align: left; border: 1px solid transparent; padding: 7px 10px; border-radius: 4px; transition: background 0.1s; }
  .dir-pick-item:hover { background: var(--color-accent-subtle); }
  .dir-pick-item.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); }
  .dir-pick-item span { display: block; font-size: 0.82rem; }
  .dir-pick-item small { font-size: 0.72rem; }
  .empty-pick { font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 12px; margin: 0; }
  .muted { color: var(--color-text-muted) !important; }

  /* Existence summary */
  .existence-summary { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .existence-row { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 8px; font-size: 0.78rem; padding: 3px 4px; border-radius: 4px; }
  .existence-row.exists { background: color-mix(in srgb, var(--color-warning, #f59e0b), transparent 90%); }
  .existence-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-success); }
  .existence-dot.exists { background: var(--color-warning, #f59e0b); }
  .existence-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .existence-label { font-size: 0.7rem; color: var(--color-text-muted); white-space: nowrap; }

  /* Copy result */
  .copy-result { padding: 14px; background: color-mix(in srgb, var(--color-success), transparent 90%); border: 1px solid color-mix(in srgb, var(--color-success), transparent 70%); border-radius: 6px; font-size: 0.85rem; }
  .copy-result p { margin: 0; }

  /* Scenario drawer/editor */
  /* Similar scenarios in drawer */
  .similar-section {
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
    margin-top: 4px;
  }
  .similar-hint {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    padding: 8px 0;
  }
  .similar-hint.error {
    color: var(--color-warning, #f59e0b);
  }
  .similar-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .similar-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    text-decoration: none;
    color: var(--color-text);
    transition: border-color 0.15s, background 0.15s;
  }
  .similar-item:hover {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 94%);
  }
  .similar-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .similar-key {
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    color: var(--color-accent);
    font-weight: 700;
  }
  .similar-name {
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .similar-path {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .similar-score {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent), transparent calc(100% - var(--score)));
    color: var(--color-accent);
  }

  :global(.drawer-overlay) { position: fixed; inset: 0; z-index: 100; background: rgba(15, 23, 42, 0.42); backdrop-filter: blur(4px); }
  :global(.scenario-drawer) {
    position: fixed; z-index: 101; top: 0; right: 0; bottom: 0;
    width: min(1120px, calc(100vw - 32px));
    background: var(--color-bg);
    border-left: 1px solid var(--color-border);
    box-shadow: -24px 0 60px color-mix(in srgb, #000, transparent 78%);
    outline: none;
    /* flex column: header | scrollable body | fixed footer */
    display: flex;
    flex-direction: column;
  }
  .drawer-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
  :global(.drawer-title) { margin: 0; font-size: 1.15rem; font-weight: 850; line-height: 1.25; }
  .drawer-subtitle { margin: 4px 0 0; color: var(--color-text-muted); font-family: ui-monospace, monospace; font-size: 0.8rem; }
  :global(.drawer-close) {
    width: 34px; height: 34px;
    display: inline-grid; place-items: center;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    flex-shrink: 0;
  }
  :global(.drawer-close:hover) {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: scale(1.05);
  }
  :global([data-theme="dark"]) :global(.drawer-close) {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.12);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
  :global([data-theme="dark"]) :global(.drawer-close:hover) {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.25);
    color: #fff;
  }
  .sync-pill { border-radius: 999px; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); padding: 3px 9px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; }
  /* Scrollable body */
  .scenario-editor { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; padding: 20px 24px 8px; }
  .editor-top { display: flex; flex-direction: column; gap: 14px; flex-shrink: 0; }
  .id-row { display: flex; align-items: center; gap: 10px; font-size: 0.86rem; flex-wrap: wrap; }
  .id-label { color: var(--color-text-muted); flex-shrink: 0; }
  .id-value { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .editor-grid { display: grid; grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(130px, 1fr)); gap: 14px; align-items: end; }
  .editor-grid label,
  .description-field { display: grid; gap: 6px; font-size: 0.78rem; color: var(--color-text-muted); }
  textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; font: inherit; resize: vertical; box-sizing: border-box; }
  /* Source badge */
  .source-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em; flex-shrink: 0; }
  .source-badge.automated { background: color-mix(in srgb, var(--color-accent), transparent 84%); color: var(--color-accent); }
  .source-badge.manual { background: color-mix(in srgb, var(--color-text-muted), transparent 86%); color: var(--color-text-muted); }
  /* Steps section */
  .steps-section { display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .steps-section-title { margin: 0; font-size: 0.95rem; font-weight: 700; }
  /* Always-visible drawer footer */
  .drawer-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 24px;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .footer-error { flex: 1; font-size: 0.78rem; color: var(--color-danger, #ef4444); }
  :global(.drawer-close-btn) {
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    border-radius: 6px;
    padding: 8px 16px;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  :global(.drawer-close-btn:hover) { border-color: var(--color-accent); color: var(--color-accent); }

  @media (max-width: 1040px) {
    .repo-layout { grid-template-columns: 1fr; }
    .tree-panel { border-right: 0; border-bottom: 1px solid var(--color-border); max-height: 46vh; }
    .filter-bar { padding: 8px 12px; }
    .search-wrap { max-width: none; }
    .editor-grid { grid-template-columns: 1fr; }
    :global(.scenario-drawer) { width: 100vw; }
    .scenario-topbar { align-items: stretch; flex-direction: column; }
    .header-actions { flex-wrap: wrap; }
    .directory-toolbar { margin-top: 12px; }
    .dir-action-btn { flex: 1 1 118px; }
  }
  @media (max-width: 720px) {
    .tree-list { padding-inline: 10px; }
    .tree-row,
    .scenario-leaf { padding-left: calc(var(--level) * 22px); }
    .scenario-panel :global(table) { min-width: 1080px; }
    .filter-bar { display: grid; grid-template-columns: 1fr; }
    .filter-group { display: grid; align-items: stretch; }
    .header-actions { justify-content: space-between; }
    .directory-toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .dir-action-btn { width: 100%; min-width: 0; }
  }
  /* Touch / mobile: always show copy buttons, increase tap targets */
  @media (hover: none) and (pointer: coarse) {
    .ta-secondary { display: none; }
    .tree-line { gap: 2px; }
    .copy-name-btn { opacity: 1; }
    .icon-btn { width: 44px; height: 44px; }
    .dir-action-btn { min-height: 44px; }
    .tree-caret-btn { height: 44px; }
  }
  .tag-edit-field { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .editor-label { font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted); }
  .opt { font-weight: 400; opacity: 0.7; }
</style>

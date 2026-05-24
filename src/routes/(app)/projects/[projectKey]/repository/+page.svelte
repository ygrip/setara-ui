<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
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
    type Scenario,
    type ScenarioStep,
    type TestDirectory
  } from '$lib/api/testcases';

  let { data } = $props();

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
  let rowDrafts = $state<Record<string, { priority: string; automatable: boolean; status: string }>>({});

  // ── Scenario sorting ─────────────────────────────────────────
  let scenarioSortBy = $state<'key' | 'name' | 'priority' | 'automation' | 'status'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  // ── Scenario filters ─────────────────────────────────────────
  let filterAutomation = $state<string>('');
  let filterPriority = $state<string>('');
  let filterSearch = $state<string>('');

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
  const selectedTitle = $derived(selectedDirectory ? selectedDirectory.name : 'All Scenarios');

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
  $effect(() => {
    if (data.directories.length && expandedIds.size === 0) {
      expandedIds = new Set(
        data.directories
          .filter((n: TestDirectory) => n.parentId === null)
          .map((n: TestDirectory) => n.id)
      );
    }
  });

  $effect(() => {
    const next: typeof rowDrafts = {};
    for (const scenario of scopedScenarios) {
      next[scenario.id] = rowDrafts[scenario.id] ?? {
        priority: scenario.priority ?? '',
        automatable: scenario.automatable,
        status: scenario.status
      };
    }
    rowDrafts = next;
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

  function rowChanged(scenario: Scenario): boolean {
    const draft = rowDrafts[scenario.id];
    return !!draft && (
      draft.priority !== (scenario.priority ?? '')
      || draft.automatable !== scenario.automatable
      || draft.status !== scenario.status
    );
  }

  function setRowDraft(scenarioId: string, patch: Partial<{ priority: string; automatable: boolean; status: string }>) {
    rowDrafts = {
      ...rowDrafts,
      [scenarioId]: {
        ...(rowDrafts[scenarioId] ?? { priority: '', automatable: false, status: 'ACTIVE' }),
        ...patch
      }
    };
  }

  async function saveRowScenario(scenario: Scenario) {
    const draft = rowDrafts[scenario.id];
    if (!draft || !rowChanged(scenario)) return;
    if (!confirm(`Save changes to ${scenario.name}?`)) return;
    await runAction(async () => {
      await updateScenario(data.projectKey, scenario.id, {
        priority: draft.priority || undefined,
        automatable: draft.automatable,
        status: draft.status
      });
    });
  }

  async function openScenarioDetail(scenario: Scenario) {
    detailBusy = true;
    try {
      const full = await getScenario(data.projectKey, scenario.id);
      detailScenario = full;
      detailDraft = structuredClone(full);
    } finally {
      detailBusy = false;
    }
  }

  function closeScenarioDetail() {
    detailScenario = null;
    detailDraft = null;
  }

  function setDetailStep(index: number, patch: Partial<ScenarioStep>) {
    if (!detailDraft) return;
    const steps = [...(detailDraft.steps ?? [])];
    steps[index] = { ...steps[index], ...patch };
    detailDraft = { ...detailDraft, steps };
  }

  function addDetailStep() {
    if (!detailDraft) return;
    const steps = [...(detailDraft.steps ?? [])];
    steps.push({ sequenceNo: steps.length + 1, keyword: 'AND', name: '', description: null, expectation: null });
    detailDraft = { ...detailDraft, steps };
  }

  async function saveDetailScenario() {
    const draft = detailDraft;
    if (!draft) return;
    await runAction(async () => {
      const saved = await updateScenario(data.projectKey, draft.id, {
        name: draft.name,
        priority: draft.priority ?? undefined,
        automatable: draft.automatable,
        status: draft.status,
        automationStatus: draft.automationStatus,
        manualNotes: draft.manualNotes ?? undefined,
        automationNotes: draft.automationNotes ?? undefined,
        steps: (draft.steps ?? []).map((step, index) => ({
          sequenceNo: index + 1,
          keyword: step.keyword,
          name: step.name,
          description: step.description,
          expectation: step.expectation
        }))
      });
      detailScenario = saved;
      detailDraft = structuredClone(saved);
    });
  }

  function copyDetailScenarioId(e: MouseEvent) {
    if (!detailDraft) return;
    copyText(detailDraft.id, 'Scenario id', e);
  }

  // ── Tree interaction ─────────────────────────────────────────
  function toggleExpand(nodeId: string, e: MouseEvent) {
    e.stopPropagation();
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
          <a class="icon-btn" title="Import from Excel" aria-label="Import from Excel" href="/projects/{data.projectKey}/repository/import">{@render iconUpload()}</a>
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
        {#snippet treeRows(nodes: TreeNode[], level = 0)}
          {#each nodes as node}
            <div class="tree-row" style={`--level: ${level}`}>
              <div class="tree-line">
                <button
                  class="tree-caret"
                  onclick={(e) => toggleExpand(node.id, e)}
                  aria-label="Toggle directory"
                >
                  {#if node.children.length || node.directCount}
                    {#if expandedIds.has(node.id)}{@render iconChevronDown()}{:else}{@render iconChevronRight()}{/if}
                  {/if}
                </button>
                <button
                  class="tree-node"
                  class:active={selectedNodeId === node.id}
                  onclick={() => selectNode(node.id)}
                >
                  <span class="node-icon folder">{#if expandedIds.has(node.id)}{@render iconFolderOpen()}{:else}{@render iconFolder()}{/if}</span>
                  <span class="node-label"><strong>{node.name}</strong></span>
                  <span class="count-pill">{node.totalCount}</span>
                </button>
                <div class="tree-actions">
                  <button class="ta-btn ta-secondary" title="Copy directory ID" aria-label="Copy directory ID" onclick={(e) => copyText(node.directoryId ?? node.id, 'Directory id', e)}>{@render iconCopy()}</button>
                  <button class="ta-btn" title="Add sub-directory" aria-label="Add sub-directory" onclick={(e) => { e.stopPropagation(); openNodeModal(node.id); }}>{@render iconFolderPlus()}</button>
                  <button class="ta-btn" title="Add scenario" aria-label="Add scenario" onclick={(e) => { e.stopPropagation(); goto(createScenarioUrl(node.id)); }}>{@render iconFilePlus()}</button>
                  <button class="ta-btn ta-secondary" title="Rename directory" aria-label="Rename directory" onclick={(e) => { e.stopPropagation(); openRenameModal(node.id, node.name); }}>{@render iconPencil()}</button>
                  <button class="ta-btn ta-secondary" title="Move directory" aria-label="Move directory" onclick={(e) => { e.stopPropagation(); openMoveModal(node.id, node.name); }}>{@render iconMove()}</button>
                  <button class="ta-btn danger" title="Delete directory" aria-label="Delete directory" onclick={(e) => { e.stopPropagation(); openDeleteDirModal(node.id, node.name); }}>{@render iconTrash()}</button>
                </div>
              </div>
            </div>
            {#if expandedIds.has(node.id)}
              {@render treeRows(node.children, level + 1)}
              {#each directScenariosForNode(node.id) as scenario}
                <div class="scenario-leaf" style={`--level: ${level + 1}`}>
                  <button class="leaf-main" onclick={() => openScenarioDetail(scenario)}>
                    <span class="tree-caret"></span>
                    <span class="node-icon file">{@render iconFile()}</span>
                    <span class="node-label">{scenario.name}</span>
                  </button>
                  <span class="leaf-actions">
                    <span class="leaf-key">{scenario.scenarioKey}</span>
                    <button class="ta-btn" title="Copy scenario ID" aria-label="Copy scenario ID" onclick={(e) => copyText(scenario.id, 'Scenario id', e)}>{@render iconCopy()}</button>
                  </span>
                </div>
              {/each}
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
            {#if selectedDirectory}
              <button class="ta-btn" title="Copy directory ID" aria-label="Copy directory ID" onclick={(e) => copyText(selectedDirectory.directoryId ?? selectedDirectory.id, 'Directory id', e)}>{@render iconCopy()}</button>
            {/if}
          </div>
          <p class="panel-subtitle">{selectedDirectory?.path ?? data.projectKey}</p>
        </div>
        <div class="header-actions">
          <div class="segmented">
            <button class:active={reviewMode === 'LIVE'} onclick={() => setReviewMode('LIVE')}>Live</button>
            <button class:active={reviewMode === 'DRAFT'} onclick={() => setReviewMode('DRAFT')}>Drafts</button>
          </div>
          <button class="primary-outline" onclick={() => goto(createScenarioUrl(selectedNodeId))} disabled={!selectedNodeId}>
            + Scenario
          </button>
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

      <!-- Bulk action bar — only visible when rows are selected -->
      {#if selectedScenarioIds.length > 0}
        <div class="bulk-bar">
          <span class="bulk-count">{selectedScenarioIds.length} selected</span>
          {#if reviewMode === 'DRAFT'}
            <button onclick={handleBulkApprove} disabled={busy}>Approve</button>
            <button class="danger" onclick={handleBulkReject} disabled={busy}>Reject</button>
          {:else}
            <button onclick={handleBulkArchive} disabled={busy}>Archive</button>
          {/if}
          <button onclick={openCopyModal} disabled={busy} title="Copy selected scenarios to another directory">Copy to…</button>
          <button class="danger" onclick={handleBulkDelete} disabled={busy} title="Permanently delete selected scenarios">Delete</button>
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
                <button class="sort-button" onclick={() => sortScenarios('key')}>
                  Key <span class="sort-indicator">{sortIndicator('key')}</span>
                </button>
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
              <th>Automatable</th>
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
              <tr class="click-row" class:dirty-row={rowChanged(scenario)} onclick={() => openScenarioDetail(scenario)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedScenarioIds.includes(scenario.id)}
                    onclick={(e) => { e.stopPropagation(); toggleScenario(scenario.id); }}
                  />
                </td>
                <td class="scenario-key-cell">
                  <span class="scenario-key">{scenario.scenarioKey}</span>
                  <button class="ta-btn inline-copy" title="Copy scenario ID" aria-label="Copy scenario ID" onclick={(e) => copyText(scenario.id, 'Scenario id', e)}>{@render iconCopy()}</button>
                </td>
                <td class="scenario-name">{scenario.name}</td>
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
                  <select
                    class="row-select"
                    value={rowDrafts[scenario.id]?.priority ?? ''}
                    onclick={(e) => e.stopPropagation()}
                    onchange={(e) => setRowDraft(scenario.id, { priority: (e.currentTarget as HTMLSelectElement).value })}
                  >
                    <option value="">Unset</option>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </td>
                <td>
                  <label class="check-cell">
                    <input
                      type="checkbox"
                      checked={rowDrafts[scenario.id]?.automatable ?? scenario.automatable}
                      onclick={(e) => e.stopPropagation()}
                      onchange={(e) => setRowDraft(scenario.id, { automatable: (e.currentTarget as HTMLInputElement).checked })}
                    />
                    <span>{(rowDrafts[scenario.id]?.automatable ?? scenario.automatable) ? '✓' : '—'}</span>
                  </label>
                </td>
                <td>
                  <select
                    class="row-select"
                    value={rowDrafts[scenario.id]?.status ?? scenario.status}
                    onclick={(e) => e.stopPropagation()}
                    onchange={(e) => setRowDraft(scenario.id, { status: (e.currentTarget as HTMLSelectElement).value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </td>
                <td>
                  {#if rowChanged(scenario)}
                    <button class="save-mini" onclick={(e) => { e.stopPropagation(); saveRowScenario(scenario); }}>Save</button>
                  {/if}
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

<!-- ── Scenario detail modal ───────────────────────────────────── -->
<Modal
  open={detailScenario !== null}
  title={detailDraft?.scenarioKey ?? detailScenario?.scenarioKey ?? 'Scenario'}
  onclose={closeScenarioDetail}
>
  {#if detailBusy}
    <div class="empty-state compact">Loading scenario...</div>
  {:else if detailDraft}
    <div class="scenario-editor">
      <div class="editor-top">
        <div class="id-row">
          <span>ID</span>
          <strong>{detailDraft.scenarioKey}</strong>
          <button class="ta-btn" title="Copy scenario ID" aria-label="Copy scenario ID" onclick={copyDetailScenarioId}>{@render iconCopy()}</button>
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
          <label class="check-edit">
            <span>Automatable</span>
            <input type="checkbox" bind:checked={detailDraft.automatable} />
          </label>
        </div>
        <label class="description-field">
          <span>Description</span>
          <textarea bind:value={detailDraft.manualNotes} rows="3" placeholder="Scenario notes or acceptance context"></textarea>
        </label>
      </div>

      <div class="steps-editor-head">
        <h3>Steps</h3>
        <button type="button" onclick={addDetailStep}>+ Step</button>
      </div>

      <div class="steps-editor">
        <div class="steps-grid steps-grid-head">
          <span>No</span>
          <span>Step</span>
          <span>Description</span>
          <span>Expectation</span>
        </div>
        {#each detailDraft.steps ?? [] as step, index}
          <div class="steps-grid">
            <span class="step-number">{index + 1}</span>
            <div class="step-name-edit">
              <select
                value={step.keyword}
                onchange={(e) => setDetailStep(index, { keyword: (e.currentTarget as HTMLSelectElement).value })}
              >
                <option value="GIVEN">GIVEN</option>
                <option value="WHEN">WHEN</option>
                <option value="THEN">THEN</option>
                <option value="AND">AND</option>
                <option value="BUT">BUT</option>
              </select>
              <textarea
                value={step.name}
                rows="2"
                placeholder="Step name"
                oninput={(e) => setDetailStep(index, { name: (e.currentTarget as HTMLTextAreaElement).value })}
              ></textarea>
            </div>
            <textarea
              value={step.description ?? ''}
              rows="3"
              placeholder="What happens in this step"
              oninput={(e) => setDetailStep(index, { description: (e.currentTarget as HTMLTextAreaElement).value })}
            ></textarea>
            <textarea
              value={step.expectation ?? ''}
              rows="3"
              placeholder="Expected result"
              oninput={(e) => setDetailStep(index, { expectation: (e.currentTarget as HTMLTextAreaElement).value })}
            ></textarea>
          </div>
        {:else}
          <div class="empty-state compact">No steps recorded.</div>
        {/each}
      </div>

      <div class="form-actions sticky-actions">
        <button type="button" onclick={closeScenarioDetail}>Close</button>
        <button class="primary-btn" type="button" onclick={saveDetailScenario} disabled={busy}>Save Changes</button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .page { max-width: none; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .toast { position: fixed; right: 24px; bottom: 24px; background: var(--color-text); color: var(--color-bg); padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; z-index: 120; }
  .repo-layout { display: grid; grid-template-columns: minmax(360px, 520px) minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: 0; min-height: calc(100vh - 112px); overflow: hidden; background: var(--color-surface); }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-surface); min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  .tree-scroll { flex: 1; overflow: auto; }
  .scenario-panel { min-width: 0; padding: 0 0 14px; background: var(--color-bg); overflow: auto; }
  .tree-topbar,
  .scenario-topbar { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
  .tree-topbar-actions,
  .header-actions,
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
  input, select { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  input[type='checkbox'] { width: auto; }

  .tree-list { padding: 12px 14px 22px; }
  .tree-row { margin-bottom: 7px; padding-left: calc(var(--level) * 30px); position: relative; }
  .tree-row::before,
  .scenario-leaf::before { content: ''; position: absolute; left: calc(16px + var(--level) * 30px); top: -7px; bottom: -7px; width: 1px; background: color-mix(in srgb, var(--color-border), transparent 12%); }
  .tree-line,
  .scenario-leaf { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; position: relative; }
  .scenario-leaf { padding-left: calc(var(--level) * 30px); margin-bottom: 7px; }
  .tree-node,
  .leaf-main { min-width: 0; display: grid; grid-template-columns: 26px 30px minmax(0, 1fr) auto; align-items: center; gap: 8px; text-align: left; border-color: transparent; background: transparent; width: 100%; padding: 9px 10px; border-radius: 7px; }
  .leaf-main { grid-template-columns: 26px 30px minmax(0, 1fr); }
  .tree-node.active,
  .tree-node:hover,
  .leaf-main:hover { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-color: transparent; }
  /* All Scenarios root button */
  .tree-all-btn { display: flex; align-items: center; gap: 12px; width: calc(100% - 32px); margin: 18px 16px 6px; padding: 13px 14px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--color-text); cursor: pointer; text-align: left; font: inherit; font-size: 0.95rem; }
  .tree-all-btn:hover,
  .tree-all-btn.active { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-color: transparent; }
  .all-icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: color-mix(in srgb, var(--color-accent), transparent 82%); color: var(--color-accent); font-size: 0.85rem; flex-shrink: 0; }
  .all-label { flex: 1; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tree-caret { display: inline-grid; place-items: center; width: 26px; height: 26px; border: 0; padding: 0; background: transparent; color: var(--color-text-muted); font-weight: 900; }
  .tree-actions { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 1px; opacity: 0; pointer-events: none; transition: opacity 0.12s; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; padding: 2px 3px; z-index: 2; box-shadow: 0 1px 6px color-mix(in srgb, #000, transparent 88%); }
  .tree-line:hover .tree-actions,
  .tree-line:focus-within .tree-actions { opacity: 1; pointer-events: auto; }
  .ta-btn { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: none; background: transparent; color: var(--color-text-muted); border-radius: 4px; cursor: pointer; transition: background 0.1s, color 0.1s; flex-shrink: 0; }
  .ta-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); }
  .ta-btn.danger:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger, #ef4444), transparent 85%); color: var(--color-danger, #ef4444); }
  .ta-btn.ta-secondary { opacity: 0.75; }
  .ta-btn svg { display: block; pointer-events: none; }
  .node-icon { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; color: var(--color-accent); font-size: 0.72rem; font-weight: 900; flex-shrink: 0; }
  .node-icon.folder { background: color-mix(in srgb, var(--color-accent), transparent 82%); }
  .node-icon.file { background: transparent; color: var(--color-text-muted); }
  .node-icon.small { width: 18px; height: 18px; font-size: 0.65rem; }
  .node-label { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tree-node.active .node-label { color: var(--color-accent); }
  .node-label strong { font-weight: 750; }
  .count-pill,
  .scenario-count-badge { border-radius: 4px; background: color-mix(in srgb, var(--color-text-muted), transparent 82%); color: var(--color-text-muted); padding: 3px 8px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
  .leaf-actions { display: flex; align-items: center; gap: 4px; padding-right: 5px; opacity: 0.65; }
  .scenario-leaf:hover .leaf-actions { opacity: 1; }
  .leaf-key { font-family: ui-monospace, monospace; color: var(--color-accent); font-size: 0.72rem; }

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

  .scenario-panel :global(.table-wrap) { border: 0; border-radius: 0; }
  .scenario-panel :global(th) { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.73rem; }
  .scenario-panel :global(td),
  .scenario-panel :global(th) { padding: 15px 18px; }
  .scenario-panel :global(tbody tr:hover) { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .click-row { cursor: pointer; }
  .dirty-row { box-shadow: inset 3px 0 0 var(--color-accent); }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.82rem; color: var(--color-accent); }
  .scenario-key-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .inline-copy { opacity: 0.78; }
  .scenario-name { font-weight: 600; }
  .steps-preview { display: grid; gap: 4px; max-width: 360px; }
  .steps-preview button { display: flex; gap: 7px; align-items: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; border: 0; background: transparent; padding: 2px 0; color: var(--color-text); font-size: 0.78rem; }
  .steps-preview button span { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: color-mix(in srgb, var(--color-accent), transparent 86%); color: var(--color-accent); font-size: 0.68rem; font-weight: 800; flex: 0 0 auto; }
  .steps-preview button.washed { color: var(--color-text-muted); opacity: 0.5; }
  .steps-preview .show-more { color: var(--color-accent); font-weight: 800; width: max-content; opacity: 1; }
  .row-select { min-width: 112px; padding: 6px 8px; font-size: 0.78rem; }
  .check-cell { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
  .check-cell span { color: var(--color-success); font-weight: 900; min-width: 14px; }
  .save-mini { background: var(--color-accent); color: #fff; border-color: var(--color-accent); padding: 5px 9px; font-size: 0.78rem; }
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

  /* Scenario editor */
  .scenario-editor { display: grid; gap: 18px; max-height: min(78vh, 820px); overflow: auto; padding-right: 4px; }
  .editor-top { display: grid; gap: 14px; }
  .id-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; font-size: 0.86rem; }
  .id-row span { color: var(--color-text-muted); }
  .editor-grid { display: grid; grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)); gap: 12px; align-items: end; }
  .editor-grid label,
  .description-field { display: grid; gap: 6px; font-size: 0.78rem; color: var(--color-text-muted); }
  textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; font: inherit; resize: vertical; box-sizing: border-box; }
  .check-edit { align-self: stretch; align-content: end; }
  .check-edit input { width: 18px; height: 18px; }
  .steps-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .steps-editor-head h3 { margin: 0; font-size: 0.98rem; }
  .steps-editor { border: 1px solid var(--color-border); border-radius: 8px; overflow: auto; max-height: 430px; background: var(--color-bg); }
  .steps-grid { display: grid; grid-template-columns: 56px minmax(220px, 1.25fr) minmax(220px, 1fr) minmax(220px, 1fr); gap: 10px; padding: 10px; border-bottom: 1px solid var(--color-border); min-width: 880px; align-items: start; }
  .steps-grid:last-child { border-bottom: 0; }
  .steps-grid-head { position: sticky; top: 0; z-index: 1; background: var(--color-surface); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); font-weight: 800; }
  .step-number { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; background: color-mix(in srgb, var(--color-accent), transparent 86%); color: var(--color-accent); font-weight: 900; }
  .step-name-edit { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; }
  .steps-grid textarea { min-height: 76px; }
  .sticky-actions { position: sticky; bottom: 0; background: var(--color-bg); padding-top: 12px; }

  @media (max-width: 1040px) {
    .repo-layout { grid-template-columns: 1fr; }
    .tree-panel { border-right: 0; border-bottom: 1px solid var(--color-border); max-height: 46vh; }
    .filter-bar { padding: 8px 12px; }
    .search-wrap { max-width: none; }
    .editor-grid { grid-template-columns: 1fr; }
    .scenario-topbar { align-items: stretch; flex-direction: column; }
  }
  @media (max-width: 720px) {
    .tree-list { padding-inline: 10px; }
    .tree-row,
    .scenario-leaf { padding-left: calc(var(--level) * 22px); }
    .scenario-panel :global(table) { min-width: 1040px; }
    .filter-bar { display: grid; grid-template-columns: 1fr; }
    .filter-group { display: grid; align-items: stretch; }
    .header-actions { justify-content: space-between; }
  }
  /* Touch / mobile: always show tree actions, hide secondary ones */
  @media (hover: none) and (pointer: coarse) {
    .tree-actions { position: static; transform: none; opacity: 1; pointer-events: auto; background: transparent; border: none; box-shadow: none; padding: 0; gap: 0; }
    .ta-secondary { display: none; }
    .tree-line { gap: 2px; }
  }
</style>

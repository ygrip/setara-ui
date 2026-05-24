<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
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
    type Scenario,
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

  // ── Scenario sorting ─────────────────────────────────────────
  let scenarioSortBy = $state<'key' | 'name' | 'priority' | 'automation' | 'status'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  // ── Scenario filters ─────────────────────────────────────────
  let filterAutomation = $state<string>('');
  let filterPriority = $state<string>('');

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

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED': case 'AUTOMATED': case 'ACTIVE': return 'success';
      case 'FAILED': case 'ARCHIVED': return 'danger';
      case 'AUTOMATABLE': return 'info';
      case 'DRAFT': case 'BLOCKED': case 'MANUAL_ONLY': return 'warning';
      default: return 'neutral';
    }
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

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Test Repository</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Test Repository</h1>
      <p class="page-subtitle">Browse directories, review drafts, and manage scenario scope.</p>
    </div>
    <a class="import-btn" href="/projects/{data.projectKey}/repository/import">⬆ Import Excel</a>
  </div>

  {#if data.error}<div class="error-banner">Could not load repository — {data.error}</div>{/if}
  {#if actionError}<div class="error-banner">{actionError}</div>{/if}
  {#if copyMessage}<div class="toast">{copyMessage}</div>{/if}

  <div class="repo-layout">
    <!-- ── Directory tree ──────────────────────────────────────── -->
    <aside class="tree-panel">
      <div class="panel-header">
        <div>
          <span class="panel-title">Directories</span>
          <p class="panel-subtitle">
            {reviewMode === 'LIVE' ? data.scenarios.length : data.draftScenarios.length} scenarios
          </p>
        </div>
        <button onclick={() => openNodeModal(null)}>+ Dir</button>
      </div>

      <button
        class="tree-item all-item"
        class:active={selectedNodeId === null}
        onclick={() => selectNode(null)}
      >
        <span class="node-icon">A</span>
        <span><strong>All Scenarios</strong><small>{scopedScenarios.length} total</small></span>
      </button>

      <div class="tree-list">
        {#snippet treeRows(nodes: TreeNode[], level = 0)}
          {#each nodes as node}
            <div class="tree-row" style={`--level: ${level}`}>
              <div class="tree-item-wrap">
                <button
                  class="twisty"
                  onclick={(e) => toggleExpand(node.id, e)}
                  aria-label="Toggle directory"
                >
                  {node.children.length ? (expandedIds.has(node.id) ? '⌄' : '›') : ''}
                </button>
                <button
                  class="tree-item"
                  class:active={selectedNodeId === node.id}
                  onclick={() => selectNode(node.id)}
                >
                  <span class="node-icon">D</span>
                  <span class="node-main">
                    <strong>{node.name}</strong>
                    <small>{node.totalCount} scenarios</small>
                  </span>
                </button>
              </div>
              <div class="tree-actions">
                <button
                  title="Copy directory id"
                  onclick={(e) => copyText(node.directoryId ?? node.id, 'Directory id', e)}
                >Copy ID</button>
                <button
                  title="Add sub directory"
                  onclick={(e) => { e.stopPropagation(); openNodeModal(node.id); }}
                >+ Dir</button>
                <button
                  title="Add scenario"
                  onclick={(e) => { e.stopPropagation(); goto(createScenarioUrl(node.id)); }}
                >+ Scen</button>
                <button
                  title="Rename directory"
                  onclick={(e) => { e.stopPropagation(); openRenameModal(node.id, node.name); }}
                >Rename</button>
                <button
                  title="Move directory to a different parent"
                  onclick={(e) => { e.stopPropagation(); openMoveModal(node.id, node.name); }}
                >Move</button>
                <button
                  class="danger"
                  title="Delete empty directory"
                  onclick={(e) => { e.stopPropagation(); openDeleteDirModal(node.id, node.name); }}
                >Delete</button>
              </div>
            </div>
            {#if expandedIds.has(node.id)}
              {@render treeRows(node.children, level + 1)}
            {/if}
          {/each}
        {/snippet}
        {@render treeRows(tree)}
      </div>
    </aside>

    <!-- ── Scenario panel ─────────────────────────────────────── -->
    <section class="scenario-panel">
      <div class="panel-header scenario-header">
        <div>
          <span class="panel-title">{selectedDirectory ? selectedDirectory.name : 'All Scenarios'}</span>
          <p class="panel-subtitle">
            {sortedScenarios.length} {reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios
            {#if filteredScenarios.length < visibleScenarios.length}
              <span class="filter-badge">filtered</span>
            {/if}
          </p>
        </div>
        <div class="header-actions">
          <div class="segmented">
            <button class:active={reviewMode === 'LIVE'} onclick={() => setReviewMode('LIVE')}>Live</button>
            <button class:active={reviewMode === 'DRAFT'} onclick={() => setReviewMode('DRAFT')}>Drafts</button>
          </div>
          <button onclick={() => goto(createScenarioUrl(selectedNodeId))} disabled={!selectedNodeId}>
            + Scenario
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <label class="filter-label" for="filter-automation">Automation</label>
          <select id="filter-automation" class="filter-select" bind:value={filterAutomation}>
            <option value="">All</option>
            <option value="MANUAL_ONLY">Manual Only</option>
            <option value="AUTOMATABLE">Automatable</option>
            <option value="AUTOMATED">Automated</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="filter-priority">Priority</label>
          <select id="filter-priority" class="filter-select" bind:value={filterPriority}>
            <option value="">All</option>
            {#each uniquePriorities.sort() as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </div>
        {#if filterAutomation || filterPriority}
          <button
            class="clear-filter"
            onclick={() => { filterAutomation = ''; filterPriority = ''; }}
          >✕ Clear</button>
        {/if}
      </div>

      <!-- Bulk action bar -->
      <div class="bulk-bar">
        <span class="bulk-count">{selectedScenarioIds.length} selected</span>
        {#if reviewMode === 'DRAFT'}
          <button onclick={handleBulkApprove} disabled={busy || selectedScenarioIds.length === 0}>
            Approve
          </button>
          <button
            class="danger"
            onclick={handleBulkReject}
            disabled={busy || selectedScenarioIds.length === 0}
          >Reject</button>
        {:else}
          <button
            onclick={handleBulkArchive}
            disabled={busy || selectedScenarioIds.length === 0}
          >Archive</button>
        {/if}
        <button
          onclick={openCopyModal}
          disabled={busy || selectedScenarioIds.length === 0}
          title="Copy selected scenarios to another directory"
        >Copy to Dir</button>
        <button
          class="danger"
          onclick={handleBulkDelete}
          disabled={busy || selectedScenarioIds.length === 0}
          title="Permanently delete selected scenarios"
        >Delete</button>
      </div>

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
                  ID <span class="sort-indicator">{sortIndicator('key')}</span>
                </button>
              </th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('name')}>
                  Scenario <span class="sort-indicator">{sortIndicator('name')}</span>
                </button>
              </th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('priority')}>
                  Priority <span class="sort-indicator">{sortIndicator('priority')}</span>
                </button>
              </th>
              <th>
                <button class="sort-button" onclick={() => sortScenarios('automation')}>
                  Automation <span class="sort-indicator">{sortIndicator('automation')}</span>
                </button>
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
              <tr class="click-row" onclick={() => (detailScenario = scenario)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedScenarioIds.includes(scenario.id)}
                    onclick={(e) => { e.stopPropagation(); toggleScenario(scenario.id); }}
                  />
                </td>
                <td class="scenario-key">{scenario.scenarioKey}</td>
                <td class="scenario-name">{scenario.name}</td>
                <td>{scenario.priority ?? '—'}</td>
                <td>
                  <Badge text={scenario.automationStatus} variant={statusVariant(scenario.automationStatus)} />
                </td>
                <td>
                  <Badge text={scenario.status} variant={statusVariant(scenario.status)} />
                </td>
                <td>
                  <button onclick={(e) => copyText(scenario.id, 'Scenario id', e)}>Copy ID</button>
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
  title={detailScenario?.name ?? 'Scenario'}
  onclose={() => (detailScenario = null)}
>
  {#if detailScenario}
    <div class="scenario-detail">
      <div class="detail-meta">
        <span>ID</span>
        <strong>{detailScenario.scenarioKey}</strong>
        <button onclick={(e) => detailScenario && copyText(detailScenario.id, 'Scenario id', e)}>
          Copy ID
        </button>
      </div>
      <div class="detail-grid">
        <span>Priority</span><strong>{detailScenario.priority ?? 'UNSET'}</strong>
        <span>Automatable</span><strong>{detailScenario.automatable ? 'Yes' : 'No'}</strong>
        <span>Automation</span><strong>{detailScenario.automationStatus}</strong>
        <span>Status</span><strong>{detailScenario.status}</strong>
      </div>
      {#if detailScenario.manualNotes || detailScenario.automationNotes}
        <div class="notes">
          {#if detailScenario.manualNotes}<p>{detailScenario.manualNotes}</p>{/if}
          {#if detailScenario.automationNotes}<p>{detailScenario.automationNotes}</p>{/if}
        </div>
      {/if}
      <div class="steps">
        {#each [...(detailScenario.steps ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo) as step, index}
          <div class="step-item">
            <span class="step-no">{index + 1}</span>
            <div>
              <strong>{step.keyword} {step.name}</strong>
              {#if step.description}<p>{step.description}</p>{/if}
              {#if step.expectation}<small>{step.expectation}</small>{/if}
            </div>
          </div>
        {:else}
          <div class="empty-state compact">No steps recorded.</div>
        {/each}
      </div>
    </div>
  {/if}
</Modal>

<style>
  .page { max-width: 1320px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .import-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--color-accent); color: #fff; border-radius: 8px; padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background 0.15s; }
  .import-btn:hover { background: var(--color-accent-hover); }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .toast { position: fixed; right: 24px; bottom: 24px; background: var(--color-text); color: var(--color-bg); padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; z-index: 120; }
  .repo-layout { display: grid; grid-template-columns: 380px minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: var(--radius); min-height: 680px; overflow: hidden; background: var(--color-surface); }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-bg); min-width: 0; }
  .scenario-panel { min-width: 0; padding: 0 0 14px; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .panel-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .panel-subtitle { margin: 3px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }
  .filter-badge { display: inline-block; background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); font-size: 0.65rem; border-radius: 3px; padding: 1px 5px; margin-left: 4px; font-weight: 600; }

  button, input, select { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.danger { color: var(--color-danger); border-color: transparent; }
  button.danger:hover:not(:disabled) { border-color: var(--color-danger); }
  button.danger-btn { background: var(--color-danger); color: #fff; border-color: var(--color-danger); }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  input, select { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  input[type='checkbox'] { width: auto; }

  .tree-list { padding: 8px; }
  .tree-row { padding-left: calc(var(--level) * 18px); display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; margin-bottom: 6px; }
  .tree-item-wrap { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 4px; }
  .tree-item { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; }
  .all-item { margin: 10px; width: calc(100% - 20px); }
  .tree-actions { display: flex; gap: 3px; padding-left: 38px; flex-wrap: wrap; }
  .tree-actions button { padding: 3px 6px; font-size: 0.7rem; }
  .twisty { width: 24px; min-height: 34px; padding: 0; color: var(--color-text-muted); }
  .tree-item small { display: block; color: var(--color-text-muted); font-size: 0.72rem; margin-top: 2px; }
  .node-icon { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; background: var(--color-accent-subtle); color: var(--color-accent); font-size: 0.72rem; font-weight: 800; flex-shrink: 0; }
  .node-icon.small { width: 18px; height: 18px; font-size: 0.65rem; }
  .node-main { min-width: 0; }

  .scenario-header { flex-wrap: wrap; }
  .header-actions, .segmented, .bulk-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* Filter bar */
  .filter-bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface), transparent 40%); }
  .filter-group { display: flex; flex-direction: column; gap: 3px; }
  .filter-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .filter-select { padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: 0.82rem; min-width: 110px; }
  .clear-filter { padding: 5px 10px; font-size: 0.78rem; align-self: flex-end; }

  .bulk-bar { padding: 10px 16px; color: var(--color-text-muted); font-size: 0.82rem; border-bottom: 1px solid var(--color-border); }
  .bulk-count { font-weight: 600; min-width: 70px; }
  .bulk-bar button { padding: 5px 10px; font-size: 0.8rem; }

  .scenario-panel :global(.table-wrap) { border: 0; border-radius: 0; }
  .click-row { cursor: pointer; }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.76rem; color: var(--color-text-muted); }
  .scenario-name { font-weight: 600; }
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

  /* Scenario detail */
  .scenario-detail { display: grid; gap: 14px; }
  .detail-meta { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 0.82rem; }
  .detail-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px 12px; padding: 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-size: 0.82rem; }
  .detail-grid span, .detail-meta span { color: var(--color-text-muted); }
  .notes { border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; color: var(--color-text-muted); line-height: 1.5; }
  .notes p { margin: 0 0 8px; }
  .notes p:last-child { margin-bottom: 0; }
  .steps { display: grid; gap: 10px; }
  .step-item { display: grid; grid-template-columns: 28px 1fr; gap: 10px; }
  .step-no { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--color-accent-subtle); color: var(--color-accent); font-weight: 800; font-size: 0.75rem; }
  .step-item strong { display: block; font-size: 0.88rem; }
  .step-item p { margin: 4px 0; color: var(--color-text-muted); font-size: 0.82rem; line-height: 1.45; }
  .step-item small { color: var(--color-text-muted); font-size: 0.76rem; }

  @media (max-width: 1000px) {
    .repo-layout { grid-template-columns: 1fr; }
    .tree-panel { border-right: 0; border-bottom: 1px solid var(--color-border); }
  }
</style>

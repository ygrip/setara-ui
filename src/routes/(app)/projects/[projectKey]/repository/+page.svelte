<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {
    approveDraftScenarios,
    archiveScenario,
    createDirectory,
    rejectDraftScenarios,
    type Scenario,
    type TestDirectory
  } from '$lib/api/testcases';

  let { data } = $props();

  type TreeNode = TestDirectory & { children: TreeNode[]; directCount: number; totalCount: number };

  let selectedNodeId = $state<string | null>(null);
  let reviewMode = $state<'LIVE' | 'DRAFT'>('LIVE');
  let selectedScenarioIds = $state<string[]>([]);
  let expandedIds = $state<Set<string>>(new Set());
  let busy = $state(false);
  let actionError = $state('');
  let copyMessage = $state('');
  let detailScenario = $state<Scenario | null>(null);
  let showDirectoryModal = $state(false);
  let directoryParentId = $state<string | null>(null);
  let directoryName = $state('');
  let scenarioSortBy = $state<'key' | 'name' | 'priority' | 'automation'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  const scopedScenarios = $derived(reviewMode === 'LIVE' ? data.scenarios : data.draftScenarios);
  const selectedDirectory = $derived(data.directories.find((directory: TestDirectory) => directory.id === selectedNodeId) ?? null);
  const tree = $derived(buildTree(data.directories, scopedScenarios));
  const visibleScenarios = $derived(
    selectedNodeId
      ? scopedScenarios.filter((scenario: Scenario) => scenario.nodeId === selectedNodeId)
      : scopedScenarios
  );
  const sortedScenarios = $derived([...visibleScenarios].sort((a: Scenario, b: Scenario) => {
    const result = scenarioValue(a, scenarioSortBy).localeCompare(scenarioValue(b, scenarioSortBy));
    return scenarioSortDir === 'asc' ? result : -result;
  }));

  $effect(() => {
    if (data.directories.length && expandedIds.size === 0) {
      expandedIds = new Set(data.directories.filter((node: TestDirectory) => node.parentId === null).map((node: TestDirectory) => node.id));
    }
  });

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

  function scenarioValue(scenario: Scenario, field: string): string {
    switch (field) {
      case 'key': return scenario.scenarioKey ?? '';
      case 'priority': return scenario.priority ?? '';
      case 'automation': return scenario.automationStatus ?? '';
      default: return scenario.name ?? '';
    }
  }

  function sortScenarios(field: 'key' | 'name' | 'priority' | 'automation') {
    scenarioSortDir = scenarioSortBy === field && scenarioSortDir === 'asc' ? 'desc' : 'asc';
    scenarioSortBy = field;
  }

  function sortIndicator(field: 'key' | 'name' | 'priority' | 'automation'): string {
    if (scenarioSortBy !== field) return '';
    return scenarioSortDir === 'asc' ? '↑' : '↓';
  }

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED':
      case 'AUTOMATED':
      case 'ACTIVE':
        return 'success';
      case 'FAILED':
      case 'ARCHIVED':
        return 'danger';
      case 'AUTOMATABLE':
        return 'info';
      case 'DRAFT':
      case 'BLOCKED':
      case 'MANUAL_ONLY':
        return 'warning';
      default:
        return 'neutral';
    }
  }

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
  }

  function toggleScenario(id: string) {
    selectedScenarioIds = selectedScenarioIds.includes(id)
      ? selectedScenarioIds.filter((existing) => existing !== id)
      : [...selectedScenarioIds, id];
  }

  function toggleAllVisible() {
    selectedScenarioIds = selectedScenarioIds.length === sortedScenarios.length
      ? []
      : sortedScenarios.map((scenario: Scenario) => scenario.id);
  }

  function openNodeModal(parentId: string | null) {
    directoryParentId = parentId;
    directoryName = '';
    showDirectoryModal = true;
  }

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

  async function handleCreateNode(e: SubmitEvent) {
    e.preventDefault();
    if (!directoryName.trim()) return;
    await runAction(async () => {
      const node = await createDirectory(data.projectKey, { parentId: directoryParentId, name: directoryName.trim() });
      selectedNodeId = node.id;
      expandedIds = new Set([...expandedIds, directoryParentId ?? node.id]);
      showDirectoryModal = false;
      directoryName = '';
    });
  }

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

  async function handleBulkArchive() {
    if (selectedScenarioIds.length === 0) return;
    if (!confirm(`Archive ${selectedScenarioIds.length} scenarios?`)) return;
    await runAction(async () => {
      for (const scenarioId of selectedScenarioIds) {
        await archiveScenario(data.projectKey, scenarioId);
      }
      selectedScenarioIds = [];
    });
  }

  async function copyText(value: string, label: string, e?: MouseEvent) {
    e?.stopPropagation();
    await navigator.clipboard.writeText(value);
    copyMessage = `${label} copied`;
    setTimeout(() => copyMessage = '', 1800);
  }

  function createScenarioUrl(nodeId: string | null): string {
    const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : '';
    return `/projects/${data.projectKey}/repository/scenarios/new${query}`;
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
    <aside class="tree-panel">
      <div class="panel-header">
        <div>
          <span class="panel-title">Directories</span>
          <p class="panel-subtitle">{reviewMode === 'LIVE' ? data.scenarios.length : data.draftScenarios.length} scenarios</p>
        </div>
        <button onclick={() => openNodeModal(null)}>+ Dir</button>
      </div>

      <button class="tree-item all-item" class:active={selectedNodeId === null} onclick={() => selectNode(null)}>
        <span class="node-icon">A</span>
        <span><strong>All Scenarios</strong><small>{scopedScenarios.length} total</small></span>
      </button>

      <div class="tree-list">
        {#snippet treeRows(nodes: TreeNode[], level = 0)}
          {#each nodes as node}
            <div class="tree-row" style={`--level: ${level}`}>
              <div class="tree-item-wrap">
                <button class="twisty" onclick={(e) => toggleExpand(node.id, e)} aria-label="Toggle directory">
                  {node.children.length ? (expandedIds.has(node.id) ? '⌄' : '›') : ''}
                </button>
                <button class="tree-item" class:active={selectedNodeId === node.id} onclick={() => selectNode(node.id)}>
                  <span class="node-icon">D</span>
                  <span class="node-main">
                    <strong>{node.name}</strong>
                    <small>{node.totalCount} scenarios</small>
                  </span>
                </button>
              </div>
              <div class="tree-actions">
                <button title="Copy directory id" onclick={(e) => copyText(node.directoryId ?? node.id, 'Directory id', e)}>Copy</button>
                <button title="Add sub directory" onclick={(e) => { e.stopPropagation(); openNodeModal(node.id); }}>+ Dir</button>
                <button title="Add scenario" onclick={(e) => { e.stopPropagation(); goto(createScenarioUrl(node.id)); }}>+ Scenario</button>
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

    <section class="scenario-panel">
      <div class="panel-header scenario-header">
        <div>
          <span class="panel-title">{selectedDirectory ? selectedDirectory.name : 'All Scenarios'}</span>
          <p class="panel-subtitle">{sortedScenarios.length} {reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios</p>
        </div>
        <div class="header-actions">
          <div class="segmented">
            <button class:active={reviewMode === 'LIVE'} onclick={() => setReviewMode('LIVE')}>Live</button>
            <button class:active={reviewMode === 'DRAFT'} onclick={() => setReviewMode('DRAFT')}>Drafts</button>
          </div>
          <button onclick={() => goto(createScenarioUrl(selectedNodeId))} disabled={!selectedNodeId}>+ Scenario</button>
        </div>
      </div>

      <div class="bulk-bar">
        <span>{selectedScenarioIds.length} selected</span>
        {#if reviewMode === 'DRAFT'}
          <button onclick={handleBulkApprove} disabled={busy || selectedScenarioIds.length === 0}>Approve</button>
          <button class="danger" onclick={handleBulkReject} disabled={busy || selectedScenarioIds.length === 0}>Reject</button>
        {:else}
          <button class="danger" onclick={handleBulkArchive} disabled={busy || selectedScenarioIds.length === 0}>Archive</button>
        {/if}
      </div>

      {#if sortedScenarios.length === 0}
        <div class="empty-state">No {reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios in this directory.</div>
      {:else}
        <DataTable>
          {#snippet head()}
            <tr>
              <th><input type="checkbox" checked={selectedScenarioIds.length === sortedScenarios.length} onchange={toggleAllVisible} /></th>
              <th><button class="sort-button" onclick={() => sortScenarios('key')}>ID <span class="sort-indicator">{sortIndicator('key')}</span></button></th>
              <th><button class="sort-button" onclick={() => sortScenarios('name')}>Scenario <span class="sort-indicator">{sortIndicator('name')}</span></button></th>
              <th><button class="sort-button" onclick={() => sortScenarios('priority')}>Priority <span class="sort-indicator">{sortIndicator('priority')}</span></button></th>
              <th><button class="sort-button" onclick={() => sortScenarios('automation')}>Automation <span class="sort-indicator">{sortIndicator('automation')}</span></button></th>
              <th>Status</th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each sortedScenarios as scenario}
              <tr class="click-row" onclick={() => detailScenario = scenario}>
                <td><input type="checkbox" checked={selectedScenarioIds.includes(scenario.id)} onclick={(e) => { e.stopPropagation(); toggleScenario(scenario.id); }} /></td>
                <td class="scenario-key">{scenario.scenarioKey}</td>
                <td class="scenario-name">{scenario.name}</td>
                <td>{scenario.priority ?? 'UNSET'}</td>
                <td><Badge text={scenario.automationStatus} variant={statusVariant(scenario.automationStatus)} /></td>
                <td><Badge text={scenario.status} variant={statusVariant(scenario.status)} /></td>
                <td><button onclick={(e) => copyText(scenario.id, 'Scenario id', e)}>Copy ID</button></td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </section>
  </div>
</div>

<Modal
  open={showDirectoryModal}
  title="Create Directory"
  onclose={() => showDirectoryModal = false}
>
  <form class="modal-form" onsubmit={handleCreateNode}>
    <label>
      <span>Name</span>
      <input bind:value={directoryName} placeholder="Directory name" disabled={busy} required />
    </label>
    <div class="form-actions">
      <button type="button" onclick={() => showDirectoryModal = false} disabled={busy}>Cancel</button>
      <button class="primary-btn" type="submit" disabled={busy || !directoryName.trim()}>Create</button>
    </div>
  </form>
</Modal>

<Modal
  open={detailScenario !== null}
  title={detailScenario?.name ?? 'Scenario'}
  onclose={() => detailScenario = null}
>
  {#if detailScenario}
    <div class="scenario-detail">
      <div class="detail-meta">
        <span>ID</span>
        <strong>{detailScenario.scenarioKey}</strong>
        <button onclick={(e) => detailScenario && copyText(detailScenario.id, 'Scenario id', e)}>Copy ID</button>
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
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .toast { position: fixed; right: 24px; bottom: 24px; background: var(--color-text); color: var(--color-bg); padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; z-index: 120; }
  .repo-layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: var(--radius); min-height: 680px; overflow: hidden; background: var(--color-surface); }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-bg); min-width: 0; }
  .scenario-panel { min-width: 0; padding: 0 0 14px; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .panel-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .panel-subtitle { margin: 3px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }
  button, input { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.danger { color: var(--color-danger); }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  input[type='checkbox'] { width: auto; }
  .tree-list { padding: 8px; }
  .tree-row { padding-left: calc(var(--level) * 18px); display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; margin-bottom: 6px; }
  .tree-item-wrap { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 4px; }
  .tree-item { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; }
  .all-item { margin: 10px; width: calc(100% - 20px); }
  .tree-actions { display: flex; gap: 4px; padding-left: 38px; }
  .tree-actions button { padding: 4px 7px; font-size: 0.72rem; }
  .twisty { width: 24px; min-height: 34px; padding: 0; color: var(--color-text-muted); }
  .tree-item small { display: block; color: var(--color-text-muted); font-size: 0.72rem; margin-top: 2px; }
  .node-icon { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; background: var(--color-accent-subtle); color: var(--color-accent); font-size: 0.72rem; font-weight: 800; flex-shrink: 0; }
  .node-main { min-width: 0; }
  .scenario-header { flex-wrap: wrap; }
  .header-actions, .segmented, .bulk-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .bulk-bar { padding: 10px 16px; color: var(--color-text-muted); font-size: 0.82rem; border-bottom: 1px solid var(--color-border); }
  .scenario-panel :global(.table-wrap) { border: 0; border-radius: 0; }
  .click-row { cursor: pointer; }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.76rem; color: var(--color-text-muted); }
  .scenario-name { font-weight: 600; }
  .empty-state { color: var(--color-text-muted); font-size: 0.875rem; padding: 42px 20px; text-align: center; }
  .empty-state.compact { padding: 16px; }
  .modal-form { display: grid; gap: 14px; }
  .modal-form label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
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

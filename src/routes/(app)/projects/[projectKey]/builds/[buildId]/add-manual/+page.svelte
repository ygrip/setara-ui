<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { addBuildScenario } from '$lib/api/builds';
  import type { Scenario, TestDirectory } from '$lib/api/testcases';

  let { data } = $props();

  type TreeNode = TestDirectory & { children: TreeNode[]; directCount: number; totalCount: number };
  type ViewStep = 'select' | 'review';

  let step = $state<ViewStep>('select');

  // Tree state
  let expandedIds = $state<Set<string>>(new Set());
  let selectedDirId = $state<string | null>(null);

  // Search
  let dirSearch = $state('');
  let scenarioFilter = $state('');
  let typeFilter = $state('');
  let priorityFilter = $state('');

  // Scenario sort — client-side (all data loaded upfront)
  let scenarioSortBy = $state<'name' | 'priority'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  // Selection — persists across dir switches
  let selectedIds = $state<Set<string>>(new Set());
  let selectedScenarios = $state<Map<string, Scenario>>(new Map());

  // Add progress
  let adding = $state(false);
  let addProgress = $state('');
  let addError = $state('');

  // ── Tree builder (same as repository page) ──────────────────
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

  // ── Derived ──────────────────────────────────────────────────
  const tree = $derived(buildTree(data.directories as TestDirectory[], data.scenarios as Scenario[]));

  // Filter tree nodes by search (flattened match — highlight matching nodes)
  const dirSearchLower = $derived(dirSearch.toLowerCase());
  function nodeMatchesSearch(node: TreeNode): boolean {
    if (!dirSearchLower) return true;
    return node.name.toLowerCase().includes(dirSearchLower);
  }

  // Scenarios visible in selected directory
  const dirScenarios = $derived.by(() => {
    const all = data.scenarios as Scenario[];
    if (!selectedDirId) return all;
    return all.filter(s => s.nodeId === selectedDirId);
  });

  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  function toggleScenarioSort(col: 'name' | 'priority') {
    if (scenarioSortBy === col) scenarioSortDir = scenarioSortDir === 'asc' ? 'desc' : 'asc';
    else { scenarioSortBy = col; scenarioSortDir = 'asc'; }
  }

  function sortIcon(col: string): string {
    if (scenarioSortBy !== col) return '';
    return scenarioSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filteredScenarios = $derived.by(() => {
    const q = scenarioFilter.toLowerCase();
    let result = dirScenarios;
    if (q) result = result.filter(s => s.name.toLowerCase().includes(q) || s.scenarioKey.toLowerCase().includes(q));
    if (typeFilter) result = result.filter(s => s.automationStatus === typeFilter);
    if (priorityFilter) result = result.filter(s => s.priority === priorityFilter);
    return [...result].sort((a, b) => {
      const dir = scenarioSortDir === 'asc' ? 1 : -1;
      if (scenarioSortBy === 'priority') {
        const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 99;
        const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 99;
        return (pa - pb) * dir;
      }
      return (a.name ?? '').localeCompare(b.name ?? '') * dir;
    });
  });

  const uniquePriorities = $derived(
    [...new Set(dirScenarios.map(s => s.priority).filter(Boolean) as string[])].sort()
  );

  const visibleSelectedCount = $derived(filteredScenarios.filter(s => selectedIds.has(s.id)).length);
  const allVisibleSelected = $derived(filteredScenarios.length > 0 && filteredScenarios.every(s => selectedIds.has(s.id)));
  const selectedList = $derived([...selectedScenarios.values()]);

  const selectedDir = $derived(
    selectedDirId ? (data.directories as TestDirectory[]).find(d => d.id === selectedDirId) ?? null : null
  );

  // Auto-expand root nodes on load
  $effect(() => {
    if ((data.directories as TestDirectory[]).length && expandedIds.size === 0) {
      expandedIds = new Set(
        (data.directories as TestDirectory[])
          .filter(n => n.parentId === null)
          .map(n => n.id)
      );
    }
  });

  // ── Tree interaction ──────────────────────────────────────────
  function selectDir(id: string) {
    selectedDirId = id;
    scenarioFilter = '';
    typeFilter = '';
    priorityFilter = '';
  }

  function toggleExpand(id: string, e: MouseEvent) {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    expandedIds = next;
  }

  function handleNodeClick(node: TreeNode, e: MouseEvent) {
    selectDir(node.id);
    if (node.children.length || node.directCount) toggleExpand(node.id, e);
  }

  // ── Scenario selection ────────────────────────────────────────
  function toggleScenario(s: Scenario) {
    const next = new Set(selectedIds);
    const nextMap = new Map(selectedScenarios);
    if (next.has(s.id)) { next.delete(s.id); nextMap.delete(s.id); }
    else { next.add(s.id); nextMap.set(s.id, s); }
    selectedIds = next;
    selectedScenarios = nextMap;
  }

  function toggleAll() {
    const next = new Set(selectedIds);
    const nextMap = new Map(selectedScenarios);
    if (allVisibleSelected) {
      filteredScenarios.forEach(s => { next.delete(s.id); nextMap.delete(s.id); });
    } else {
      filteredScenarios.forEach(s => { next.add(s.id); nextMap.set(s.id, s); });
    }
    selectedIds = next;
    selectedScenarios = nextMap;
  }

  function removeSelected(id: string) {
    const next = new Set(selectedIds);
    const nextMap = new Map(selectedScenarios);
    next.delete(id);
    nextMap.delete(id);
    selectedIds = next;
    selectedScenarios = nextMap;
  }

  // ── Confirm add ───────────────────────────────────────────────
  async function handleConfirmAdd() {
    if (adding) return;
    adding = true;
    addError = '';
    const ids = [...selectedIds];
    const total = ids.length;
    let done = 0;
    try {
      for (const sid of ids) {
        addProgress = `Adding ${done + 1}/${total}…`;
        try {
          await addBuildScenario(data.projectKey, data.buildId, {
            scenarioId: sid,
            source: 'MANUAL',
            addedBy: 'qa.user'
          });
        } catch { /* skip individual failures */ }
        done++;
      }
      addProgress = '';
      await goto(`/projects/${data.projectKey}/builds/${data.buildId}`);
    } catch (e) {
      addError = (e as Error).message;
    } finally {
      adding = false;
      addProgress = '';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'success';
      case 'DRAFT': return 'warning';
      case 'ARCHIVED': return 'neutral';
      default: return 'neutral';
    }
  }

  function priorityVariant(p: string | null): string {
    switch ((p ?? '').toLowerCase()) {
      case 'critical': return 'prio-critical';
      case 'high': return 'prio-high';
      case 'medium': return 'prio-medium';
      case 'low': return 'prio-low';
      default: return 'prio-unset';
    }
  }
</script>

<svelte:head>
  <title>Add Manually — {data.buildId} — Setara</title>
</svelte:head>

<!-- SVG icons (matching repository page) -->
{#snippet iconFolder()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>{/snippet}
{#snippet iconFolderOpen()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>{/snippet}
{#snippet iconChevronRight()}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>{/snippet}
{#snippet iconChevronDown()}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>{/snippet}
{#snippet iconLayers()}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>{/snippet}

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}/builds">Builds</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}/builds/{data.buildId}">{data.build?.buildKey ?? data.buildId}</a>
    <span>›</span>
    <span>Add Scenarios Manually</span>
  </nav>

  <h1 class="page-title">Add Scenarios Manually</h1>

  {#if addError}
    <div class="error">{addError}</div>
  {/if}

  {#if step === 'select'}
    <div class="split-layout">
      <!-- Left: directory tree (repository style) -->
      <aside class="tree-panel">
        <div class="tree-topbar">
          <span class="panel-title">Directories</span>
        </div>
        <div class="tree-search-wrap">
          <input class="tree-search" type="search" bind:value={dirSearch} placeholder="Filter directories…" aria-label="Filter directories" />
        </div>

        <div class="tree-scroll">
          <!-- All scenarios entry -->
          <button
            class="tree-all-btn"
            class:active={selectedDirId === null}
            onclick={() => { selectedDirId = null; scenarioFilter = ''; typeFilter = ''; priorityFilter = ''; }}
          >
            {@render iconLayers()}
            <span class="all-label">All Scenarios</span>
            <span class="count-pill">{(data.scenarios as Scenario[]).length}</span>
          </button>

          <div class="tree-list">
            {#snippet treeRows(nodes: TreeNode[])}
              {#each nodes as node (node.id)}
                {#if nodeMatchesSearch(node) || !dirSearchLower || node.children.some(c => c.name.toLowerCase().includes(dirSearchLower))}
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
                        class:active={selectedDirId === node.id}
                        onclick={(e) => handleNodeClick(node, e)}
                      >
                        <span class="node-icon">{#if expandedIds.has(node.id)}{@render iconFolderOpen()}{:else}{@render iconFolder()}{/if}</span>
                        <span class="node-label">{node.name}</span>
                        <span class="count-pill">{node.totalCount}</span>
                        {#if selectedIds.size > 0}
                          {@const nodeSelected = [...selectedIds].filter(id => {
                            const s = (data.scenarios as Scenario[]).find(sc => sc.id === id);
                            // check if scenario belongs to this subtree
                            const sNode = (data.directories as TestDirectory[]).find(d => d.id === s?.nodeId);
                            return sNode?.path === node.path || sNode?.path?.startsWith(node.path + '/');
                          }).length}
                          {#if nodeSelected > 0}
                            <span class="sel-badge">{nodeSelected}</span>
                          {/if}
                        {/if}
                      </button>
                    </div>
                  </div>
                  {#if expandedIds.has(node.id)}
                    <div class="tree-children">
                      {@render treeRows(node.children)}
                    </div>
                  {/if}
                {/if}
              {/each}
            {/snippet}
            {@render treeRows(tree)}
          </div>
        </div>
      </aside>

      <!-- Main: scenario list -->
      <main class="main-area">
        <div class="main-subheader">
          <h2 class="dir-heading">
            {selectedDir?.name ?? 'All Scenarios'}
          </h2>
          {#if selectedIds.size > 0}
            <span class="selection-badge">{selectedIds.size} selected across all directories</span>
          {/if}
        </div>

        <div class="filters-row">
          <input class="search-input flex-search" type="search" bind:value={scenarioFilter} placeholder="Search by name or key…" aria-label="Search scenarios" />
          <select class="filter-select" bind:value={typeFilter} aria-label="Filter by type">
            <option value="">All types</option>
            <option value="MANUAL_ONLY">Manual Only</option>
            <option value="AUTOMATABLE">Automatable</option>
            <option value="AUTOMATED">Automated</option>
          </select>
          <select class="filter-select" bind:value={priorityFilter} aria-label="Filter by priority">
            <option value="">All priorities</option>
            {#each uniquePriorities as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
          <span class="visible-count">{visibleSelectedCount} of {filteredScenarios.length} visible selected</span>
        </div>

        <!-- Selection chips -->
        {#if selectedIds.size > 0}
          <div class="chips-row">
            {#each selectedList as s (s.id)}
              <span class="chip">
                <code>{s.scenarioKey}</code>
                <button class="chip-remove" onclick={() => removeSelected(s.id)} aria-label="Remove {s.scenarioKey}">×</button>
              </span>
            {/each}
          </div>
        {/if}

        {#if filteredScenarios.length === 0 && !selectedDirId && !scenarioFilter && !typeFilter && !priorityFilter}
          <p class="empty">Select a directory to browse scenarios.</p>
        {:else if filteredScenarios.length === 0}
          <p class="empty">{scenarioFilter || typeFilter || priorityFilter ? 'No scenarios match the current filters.' : 'No scenarios in this directory.'}</p>
        {:else}
          <DataTable>
            {#snippet head()}
              <tr>
                <th class="checkbox-col">
                  <input type="checkbox" checked={allVisibleSelected} onchange={toggleAll} aria-label="Select all visible" />
                </th>
                <th class="th-sort" onclick={() => toggleScenarioSort('name')}>Scenario{sortIcon('name')}</th>
                <th class="th-sort" onclick={() => toggleScenarioSort('priority')}>Priority{sortIcon('priority')}</th>
              </tr>
            {/snippet}
            {#snippet body()}
              {#each filteredScenarios as scenario (scenario.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <tr class="click-row" onclick={() => toggleScenario(scenario)}>
                  <td data-label="" class="checkbox-col" onclick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(scenario.id)} onchange={() => toggleScenario(scenario)} />
                  </td>
                  <td data-label="Scenario">
                    <div class="scenario-cell">
                      <code class="scenario-key">{scenario.scenarioKey}</code>
                      <span class="scenario-name">{scenario.name}</span>
                    </div>
                  </td>
                  <td data-label="Priority">
                    <span class="prio-badge {priorityVariant(scenario.priority)}">{scenario.priority ?? 'UNSET'}</span>
                  </td>
                </tr>
              {/each}
            {/snippet}
          </DataTable>
        {/if}
      </main>
    </div>

    <!-- Sticky footer -->
    <div class="footer-bar">
      <span class="footer-count">{selectedIds.size} scenarios selected</span>
      <div class="footer-actions">
        <Button variant="secondary" onclick={() => goto(`/projects/${data.projectKey}/builds/${data.buildId}`)}>Cancel</Button>
        <Button variant="primary" disabled={selectedIds.size === 0} onclick={() => step = 'review'}>Review &amp; Add →</Button>
      </div>
    </div>

  {:else}
    <!-- Review step -->
    <div class="review-section">
      <h2 class="review-heading">{selectedIds.size} scenarios to add</h2>

      <DataTable mobileCards>
        {#snippet head()}
          <tr>
            <th>Key</th>
            <th>Name</th>
            <th>Directory</th>
            <th>Priority</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each selectedList as s (s.id)}
            {@const sDir = (data.directories as TestDirectory[]).find(d => d.id === s.nodeId)}
            <tr>
              <td data-label="Key"><code class="mono">{s.scenarioKey}</code></td>
              <td data-label="Name">{s.name}</td>
              <td data-label="Directory" class="muted">{sDir?.name ?? s.featureName ?? '—'}</td>
              <td data-label="Priority"><span class="prio-badge {priorityVariant(s.priority)}">{s.priority ?? 'UNSET'}</span></td>
              <td data-label="Status"><Badge text={s.status} variant={statusVariant(s.status)} /></td>
              <td data-label="">
                <button class="remove-btn" onclick={() => removeSelected(s.id)} aria-label="Remove {s.scenarioKey}">×</button>
              </td>
            </tr>
          {/each}
          {#if selectedList.length === 0}
            <tr><td colspan="6" class="empty">No scenarios selected.</td></tr>
          {/if}
        {/snippet}
      </DataTable>

      {#if adding}
        <p class="progress-text">{addProgress || 'Adding…'}</p>
      {/if}

      <div class="footer-bar review-footer">
        <Button variant="secondary" onclick={() => step = 'select'}>Back to Select</Button>
        <Button variant="primary" disabled={adding || selectedIds.size === 0} onclick={handleConfirmAdd}>
          {adding ? (addProgress || 'Adding…') : 'Confirm Add'}
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: none; padding: 0 24px 80px; }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .breadcrumb a:hover { text-decoration: underline; }
  .page-title { font-size: 1.5rem; margin: 0 0 16px; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }

  /* Split layout */
  .split-layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: calc(100vh - 200px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  /* ── Tree panel (matches repository sidebar) ── */
  .tree-panel {
    border-right: 1px solid var(--color-border);
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .tree-topbar {
    padding: 10px 14px 6px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .panel-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
  .tree-search-wrap { padding: 8px 10px 4px; flex-shrink: 0; }
  .tree-search {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    padding: 6px 8px;
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: 0.8rem;
    box-sizing: border-box;
  }
  .tree-search:focus { outline: none; border-color: var(--color-accent); }

  .tree-scroll { flex: 1; overflow-y: auto; padding: 4px 6px 8px; }

  /* All Scenarios button */
  .tree-all-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 8px;
    border: none;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font: inherit;
    font-size: 0.82rem;
    color: var(--color-text-muted);
    text-align: left;
    margin-bottom: 4px;
  }
  .tree-all-btn:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); color: var(--color-text); }
  .tree-all-btn.active { background: var(--color-accent-subtle); color: var(--color-accent); font-weight: 700; }
  .all-label { flex: 1; }

  /* Tree rows */
  .tree-list { display: flex; flex-direction: column; gap: 0; }
  .tree-row { display: flex; flex-direction: column; }
  .tree-line { display: flex; align-items: center; gap: 0; }
  .tree-children { padding-left: 16px; }

  .tree-caret-btn {
    width: 20px;
    height: 28px;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border-radius: 4px;
    padding: 0;
  }
  .tree-caret-btn:hover { background: color-mix(in srgb, var(--color-accent), transparent 88%); }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 5px 8px 5px 2px;
    border: none;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font: inherit;
    font-size: 0.82rem;
    color: var(--color-text);
    text-align: left;
    overflow: hidden;
  }
  .tree-node:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .tree-node.active { background: var(--color-accent-subtle); font-weight: 700; color: var(--color-accent); }
  .tree-node.active .count-pill { background: color-mix(in srgb, var(--color-accent), transparent 80%); color: var(--color-accent); }

  .node-icon { flex-shrink: 0; color: var(--color-text-muted); display: flex; align-items: center; }
  .tree-node.active .node-icon { color: var(--color-accent); }

  .node-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .count-pill {
    flex-shrink: 0;
    font-size: 0.68rem;
    font-weight: 700;
    background: var(--color-border);
    color: var(--color-text-muted);
    border-radius: 10px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
  }

  /* Selected badge on tree node */
  .sel-badge {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-weight: 800;
    background: var(--color-accent);
    color: #fff;
    border-radius: 10px;
    padding: 1px 5px;
    min-width: 16px;
    text-align: center;
  }

  /* Main area */
  .main-area { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--color-surface); }
  .main-subheader { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dir-heading { font-size: 1rem; margin: 0; font-weight: 700; }
  .selection-badge { font-size: 0.75rem; font-weight: 700; background: var(--color-accent-subtle); color: var(--color-accent); border-radius: 12px; padding: 2px 10px; }

  .filters-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .flex-search { flex: 1; min-width: 180px; }
  .search-input { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; }
  .search-input:focus { outline: none; border-color: var(--color-accent); }
  .filter-select { border: 1px solid var(--color-border); border-radius: 5px; padding: 7px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.82rem; }
  .visible-count { font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; margin-left: auto; }

  /* Chips */
  .chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; background: var(--color-accent-subtle); border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%); border-radius: 4px; padding: 2px 4px 2px 7px; font-size: 0.72rem; }
  .chip code { font-family: var(--font-mono, monospace); color: var(--color-accent); }
  .chip-remove { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0 2px; font-size: 0.9rem; line-height: 1; }
  .chip-remove:hover { color: var(--color-danger); }

  /* Scenario table */
  .th-sort { cursor: pointer; user-select: none; white-space: nowrap; }
  .th-sort:hover { color: var(--color-accent); }
  .click-row { cursor: pointer; }
  .click-row:hover { background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .checkbox-col { width: 36px; text-align: center; }
  .scenario-cell { display: flex; flex-direction: column; gap: 2px; }
  .scenario-key { font-size: 0.72rem; font-family: var(--font-mono, monospace); color: var(--color-text-muted); }
  .scenario-name { font-size: 0.84rem; font-weight: 600; }

  /* Priority badges */
  .prio-badge { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; }
  .prio-critical { background: #fee2e2; color: #dc2626; }
  .prio-high { background: #fef3c7; color: #d97706; }
  .prio-medium { background: #e0f2fe; color: #0284c7; }
  .prio-low { background: #f0fdf4; color: #16a34a; }
  .prio-unset { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

  /* Footer bar */
  .footer-bar {
    position: sticky;
    bottom: 0;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
    gap: 16px;
  }
  .footer-count { font-size: 0.9rem; font-weight: 600; color: var(--color-text-muted); }
  .footer-actions { display: flex; gap: 12px; align-items: center; }

  /* Review step */
  .review-section { display: flex; flex-direction: column; gap: 16px; }
  .review-heading { font-size: 1rem; margin: 0; }
  .review-footer { position: static; margin-top: 8px; justify-content: flex-end; }
  .progress-text { color: var(--color-accent); font-size: 0.875rem; margin: 0; }
  .muted { color: var(--color-text-muted); }
  .mono { font-family: var(--font-mono, monospace); font-size: 0.75rem; }
  .empty { color: var(--color-text-muted); font-size: 0.875rem; text-align: center; padding: 24px; }
  .remove-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 1rem; padding: 2px 6px; border-radius: 4px; }
  .remove-btn:hover { background: #fee2e2; color: #dc2626; }

  /* Dark theme */
  :global([data-theme="dark"]) .prio-critical { background: #450a0a; color: #f87171; }
  :global([data-theme="dark"]) .prio-high { background: #451a03; color: #fbbf24; }
  :global([data-theme="dark"]) .prio-medium { background: #0c1929; color: #38bdf8; }
  :global([data-theme="dark"]) .prio-low { background: #052e16; color: #4ade80; }

  /* Responsive */
  @media (max-width: 700px) {
    .page { padding: 0 12px 80px; }
    .split-layout { grid-template-columns: 1fr; height: auto; }
    .tree-panel { border-right: none; border-bottom: 1px solid var(--color-border); max-height: 220px; }
    .main-area { min-height: 300px; }
    .filters-row { gap: 6px; }
    .footer-bar { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
    .footer-actions { width: 100%; justify-content: flex-end; }
  }
</style>

<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { listScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';
  import { addBuildScenario } from '$lib/api/builds';

  let { data } = $props();

  type ViewStep = 'select' | 'review';

  let step = $state<ViewStep>('select');

  // Directory tree state
  let dirFilter = $state('');
  // Use a derived to pick initial dir, but then allow user override via selectDir()
  const initialDirId: string | null = (data.directories as TestDirectory[]).length > 0 ? data.directories[0].id : null;
  let selectedDirId = $state<string | null>(initialDirId);

  // Scenarios in current directory
  let dirScenarios = $state<Scenario[]>([]);
  let loadingScenarios = $state(false);

  // Filters for main area
  let scenarioFilter = $state('');
  let typeFilter = $state('');
  let priorityFilter = $state('');

  // Persisting selection across directories
  let selectedIds = $state<Set<string>>(new Set());
  // Map of id → Scenario for selected scenarios (accumulated as user selects)
  let selectedScenarios = $state<Map<string, Scenario>>(new Map());

  // Add progress
  let adding = $state(false);
  let addProgress = $state('');
  let addError = $state('');

  const filteredDirs = $derived.by(() => {
    const q = dirFilter.toLowerCase();
    if (!q) return data.directories as TestDirectory[];
    return (data.directories as TestDirectory[]).filter((d: TestDirectory) => d.name.toLowerCase().includes(q));
  });

  const filteredScenarios = $derived.by(() => {
    const q = scenarioFilter.toLowerCase();
    let result = dirScenarios;
    if (q) result = result.filter(s => s.name.toLowerCase().includes(q) || s.scenarioKey.toLowerCase().includes(q));
    if (typeFilter) result = result.filter(s => s.automationStatus === typeFilter);
    if (priorityFilter) result = result.filter(s => s.priority === priorityFilter);
    return result;
  });

  const uniquePriorities = $derived.by(() => {
    const set = new Set(dirScenarios.map(s => s.priority).filter(Boolean) as string[]);
    return [...set].sort();
  });

  const visibleSelectedCount = $derived(
    filteredScenarios.filter(s => selectedIds.has(s.id)).length
  );

  const allVisibleSelected = $derived(
    filteredScenarios.length > 0 && filteredScenarios.every(s => selectedIds.has(s.id))
  );

  const selectedList = $derived([...selectedScenarios.values()]);

  // Load first directory on mount
  $effect(() => {
    if (selectedDirId) {
      void loadDir(selectedDirId);
    }
  });

  async function loadDir(dirId: string) {
    loadingScenarios = true;
    try {
      dirScenarios = await listScenarios(data.projectKey, dirId, 'ACTIVE');
    } catch {
      dirScenarios = [];
    } finally {
      loadingScenarios = false;
    }
  }

  async function selectDir(dirId: string) {
    selectedDirId = dirId;
    scenarioFilter = '';
    typeFilter = '';
    priorityFilter = '';
    await loadDir(dirId);
  }

  function toggleScenario(s: Scenario) {
    const next = new Set(selectedIds);
    const nextMap = new Map(selectedScenarios);
    if (next.has(s.id)) {
      next.delete(s.id);
      nextMap.delete(s.id);
    } else {
      next.add(s.id);
      nextMap.set(s.id, s);
    }
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
  <title>Add Manually — {data.buildId} - Setara</title>
</svelte:head>

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
      <!-- Left: directory tree -->
      <aside class="sidebar">
        <input class="search-input" type="search" bind:value={dirFilter} placeholder="Filter directories…" aria-label="Filter directories" />
        <div class="dir-list">
          {#each filteredDirs as dir (dir.id)}
            <button class="dir-row" class:dir-row--active={selectedDirId === dir.id} onclick={() => selectDir(dir.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              <span class="dir-name">{dir.name}</span>
              <small class="dir-count">{dir.scenarioCount}</small>
            </button>
          {/each}
          {#if filteredDirs.length === 0}
            <p class="empty-sm">No directories found.</p>
          {/if}
        </div>
      </aside>

      <!-- Main: scenario list -->
      <main class="main-area">
        <div class="main-subheader">
          <h2 class="dir-heading">
            {filteredDirs.find((d: TestDirectory) => d.id === selectedDirId)?.name ?? 'Select a directory'}
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

        {#if loadingScenarios}
          <p class="empty">Loading scenarios…</p>
        {:else if filteredScenarios.length === 0 && !selectedDirId}
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
                <th>Scenario</th>
                <th>Priority</th>
                <th class="col-auto">Auto</th>
                <th>Status</th>
              </tr>
            {/snippet}
            {#snippet body()}
              {#each filteredScenarios as scenario (scenario.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <tr class="click-row" onclick={() => toggleScenario(scenario)}>
                  <td class="checkbox-col" onclick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(scenario.id)} onchange={() => toggleScenario(scenario)} />
                  </td>
                  <td>
                    <div class="scenario-cell">
                      <code class="scenario-key">{scenario.scenarioKey}</code>
                      <span class="scenario-name">{scenario.name}</span>
                    </div>
                  </td>
                  <td>
                    <span class="prio-badge {priorityVariant(scenario.priority)}">{scenario.priority ?? 'UNSET'}</span>
                  </td>
                  <td class="col-auto">
                    {#if scenario.automationStatus === 'AUTOMATED'}
                      <span class="auto-badge auto-automated" title="Automated">A</span>
                    {:else if scenario.automationStatus === 'AUTOMATABLE'}
                      <span class="auto-badge auto-automatable" title="Automatable">A</span>
                    {:else}
                      <span class="auto-badge auto-manual" title="Manual only">M</span>
                    {/if}
                  </td>
                  <td><Badge text={scenario.status} variant={statusVariant(scenario.status)} /></td>
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

      <DataTable>
        {#snippet head()}
          <tr>
            <th>Key</th>
            <th>Name</th>
            <th>Feature</th>
            <th>Priority</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each selectedList as s (s.id)}
            <tr>
              <td><code class="mono">{s.scenarioKey}</code></td>
              <td>{s.name}</td>
              <td class="muted">{s.featureName ?? '—'}</td>
              <td><span class="prio-badge {priorityVariant(s.priority)}">{s.priority ?? 'UNSET'}</span></td>
              <td><Badge text={s.status} variant={statusVariant(s.status)} /></td>
              <td>
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
  .page { max-width: 1200px; margin: 0 auto; padding-bottom: 80px; }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .breadcrumb a:hover { text-decoration: underline; }
  .page-title { font-size: 1.5rem; margin: 0 0 16px; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }

  /* Split layout */
  .split-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: calc(100vh - 220px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 0;
  }

  /* Sidebar */
  .sidebar {
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
    padding: 12px;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dir-list { display: flex; flex-direction: column; gap: 2px; }
  .dir-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 6px; background: none; cursor: pointer; font: inherit; color: var(--color-text); font-size: 0.82rem; text-align: left; width: 100%; }
  .dir-row:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .dir-row--active { background: var(--color-accent-subtle); font-weight: 700; }
  .dir-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dir-count { color: var(--color-text-muted); font-size: 0.72rem; flex-shrink: 0; }

  /* Main area */
  .main-area { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .main-subheader { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dir-heading { font-size: 1rem; margin: 0; }
  .selection-badge { font-size: 0.75rem; font-weight: 700; background: var(--color-accent-subtle); color: var(--color-accent); border-radius: 12px; padding: 2px 10px; }

  .filters-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .flex-search { flex: 1; min-width: 180px; }
  .search-input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .filter-select { border: 1px solid var(--color-border); border-radius: 5px; padding: 7px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.82rem; }
  .visible-count { font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; margin-left: auto; }

  /* Chips */
  .chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; background: var(--color-accent-subtle); border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%); border-radius: 4px; padding: 2px 4px 2px 7px; font-size: 0.72rem; }
  .chip code { font-family: var(--font-mono, monospace); color: var(--color-accent); }
  .chip-remove { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 0 2px; font-size: 0.9rem; line-height: 1; }
  .chip-remove:hover { color: var(--color-danger); }

  /* Scenario table */
  .click-row { cursor: pointer; }
  .click-row:hover { background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .checkbox-col { width: 36px; text-align: center; }
  .scenario-cell { display: flex; flex-direction: column; gap: 2px; }
  .scenario-key { font-size: 0.72rem; font-family: var(--font-mono, monospace); color: var(--color-text-muted); }
  .scenario-name { font-size: 0.84rem; font-weight: 600; }
  .col-auto { width: 44px; text-align: center; }

  /* Priority badges */
  .prio-badge { font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; }
  .prio-critical { background: #fee2e2; color: #dc2626; }
  .prio-high { background: #fef3c7; color: #d97706; }
  .prio-medium { background: #e0f2fe; color: #0284c7; }
  .prio-low { background: #f0fdf4; color: #16a34a; }
  .prio-unset { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

  /* Auto badges */
  .auto-badge { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; font-size: 0.62rem; font-weight: 800; }
  .auto-automated { background: #dcfce7; color: #15803d; }
  .auto-automatable { background: #fef3c7; color: #d97706; }
  .auto-manual { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

  /* Footer bar */
  .footer-bar {
    position: sticky;
    bottom: 0;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
    margin-top: 0;
  }
  .footer-count { font-size: 0.875rem; font-weight: 600; color: var(--color-text-muted); }
  .footer-actions { display: flex; gap: 10px; align-items: center; }

  /* Review step */
  .review-section { display: flex; flex-direction: column; gap: 16px; }
  .review-heading { font-size: 1rem; margin: 0; }
  .review-footer { position: static; margin-top: 8px; justify-content: flex-end; }
  .progress-text { color: var(--color-accent); font-size: 0.875rem; margin: 0; }
  .muted { color: var(--color-text-muted); }
  .mono { font-family: var(--font-mono, monospace); font-size: 0.75rem; }
  .empty { color: var(--color-text-muted); font-size: 0.875rem; text-align: center; padding: 24px; }
  .empty-sm { color: var(--color-text-muted); font-size: 0.8rem; padding: 8px 4px; margin: 0; }

  .remove-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 1rem; padding: 2px 6px; border-radius: 4px; }
  .remove-btn:hover { background: #fee2e2; color: #dc2626; }

  /* Dark theme */
  :global([data-theme="dark"]) .prio-critical { background: #450a0a; color: #f87171; }
  :global([data-theme="dark"]) .prio-high { background: #451a03; color: #fbbf24; }
  :global([data-theme="dark"]) .prio-medium { background: #0c1929; color: #38bdf8; }
  :global([data-theme="dark"]) .prio-low { background: #052e16; color: #4ade80; }
  :global([data-theme="dark"]) .auto-automated { background: #14532d; color: #4ade80; }
  :global([data-theme="dark"]) .auto-automatable { background: #451a03; color: #fbbf24; }

  /* Responsive */
  @media (max-width: 700px) {
    .split-layout { grid-template-columns: 1fr; height: auto; }
    .sidebar { border-right: none; border-bottom: 1px solid var(--color-border); max-height: 200px; }
    .main-area { max-height: calc(100vh - 360px); }
    .filters-row { gap: 6px; }
  }
</style>

<script lang="ts">
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { listSquadCoverage, listSquadProjectCoverage, type SquadCoverage, type SquadProjectCoverage } from '$lib/api/statistics';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();

  let initialized = false;
  let squads = $state<SquadCoverage[]>([]);
  let projects = $state<SquadProjectCoverage[]>([]);
  let selectedSquad = $state<SquadCoverage | null>(null);
  let tribeFilter = $state('');
  let squadFilter = $state('');
  let projectFilter = $state('');
  let squadSortBy = $state<'name' | 'coverage'>('coverage');
  let squadSortDir = $state<'asc' | 'desc'>('desc');
  let projectSortBy = $state<'name' | 'coverage'>('coverage');
  let projectSortDir = $state<'asc' | 'desc'>('desc');
  let busy = $state(false);
  let error = $state('');

  $effect(() => {
    if (initialized) return;
    squads = data.squads;
    projects = data.projects;
    error = data.error ?? '';
    initialized = true;
  });

  function pct(value: number): string {
    return `${Number(value ?? 0).toFixed(0)}%`;
  }

  function indicator(active: boolean, dir: 'asc' | 'desc'): string {
    if (!active) return '';
    return dir === 'asc' ? '↑' : '↓';
  }

  async function refreshSquads() {
    busy = true;
    error = '';
    try {
      squads = await listSquadCoverage({
        tribe: tribeFilter,
        squad: squadFilter,
        sortBy: squadSortBy,
        sortDir: squadSortDir
      });
      if (selectedSquad && !squads.some(row => row.squadId === selectedSquad?.squadId)) {
        selectedSquad = null;
        projects = [];
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function selectSquad(row: SquadCoverage) {
    selectedSquad = row;
    await refreshProjects();
  }

  async function refreshProjects() {
    if (!selectedSquad) return;
    busy = true;
    error = '';
    try {
      projects = await listSquadProjectCoverage(selectedSquad.squadId, {
        project: projectFilter,
        sortBy: projectSortBy,
        sortDir: projectSortDir
      });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  function sortSquads(field: 'name' | 'coverage') {
    squadSortDir = squadSortBy === field && squadSortDir === 'asc' ? 'desc' : 'asc';
    squadSortBy = field;
    void refreshSquads();
  }

  function sortProjects(field: 'name' | 'coverage') {
    projectSortDir = projectSortBy === field && projectSortDir === 'asc' ? 'desc' : 'asc';
    projectSortBy = field;
    void refreshProjects();
  }

  // Derived summary stats — distinct from dashboard
  const totalTribes = $derived(new Set(squads.map(s => s.tribeId).filter(Boolean)).size);
  const totalSquads = $derived(squads.length);
  const totalProjects = $derived(squads.reduce((sum, s) => sum + s.projectCount, 0));
  const totalScenarios = $derived(squads.reduce((sum, s) => sum + s.totalScenarios, 0));
  const totalAutomated = $derived(squads.reduce((sum, s) => sum + s.totalAutomated, 0));
  const overallCoverage = $derived(totalScenarios > 0 ? Math.round((totalAutomated / totalScenarios) * 100) : 0);
</script>

<svelte:head>
  <title>Overview — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Overview</h1>
      <p class="page-subtitle">See how much of each squad's test suite is automated, broken down by project.</p>
    </div>
  </div>

  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}

  <!-- ── Summary cards ───────────────────────────────────── -->
  <div class="stats-grid">
  <MetricCard label="Tribes" value={totalTribes} iconSvg='<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="8" y="3" width="8" height="6" rx="1.5" />
    <rect x="3" y="15" width="7" height="6" rx="1.5" />
    <rect x="14" y="15" width="7" height="6" rx="1.5" />
    <path d="M12 9v3" />
    <path d="M6.5 15v-3H17.5v3" />
  </svg>'
  variant="info"
    iconFrame={{
      size: "40px",
      padding: "6px",
      border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)",
      radius: "10px",
      background: "color-mix(in srgb, var(--color-info), transparent 86%)",
      color: "var(--color-info)"
    }}
  />
  <MetricCard label="Squads" value={totalSquads} iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>'
    iconFrame={{
      size: "40px",
      padding: "6px",
      border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)",
      radius: "10px",
      background: "color-mix(in srgb, var(--color-status-manual), transparent 86%)",
      color: "var(--color-status-manual)"
    }}
    variant="other"
  />
  <MetricCard label="Projects" value={totalProjects} iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
    iconFrame={{
      size: "40px",
      padding: "6px",
      border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)",
      radius: "10px",
      background: "color-mix(in srgb, var(--color-warning), transparent 86%)",
      color: "var(--color-warning)"
    }}
    variant="warning"
  />
  <MetricCard label="Coverage" value={overallCoverage + '%'} iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><polyline points="7 15 10 12 13 14 18 8"/></svg>'
    iconFrame={{
      size: "40px",
      padding: "6px",
      border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)",
      radius: "10px",
      background: "color-mix(in srgb, var(--color-success), transparent 86%)",
      color: "var(--color-success)"
    }}
    variant="success"
  >
      <div class="stat-card-bar">
          <div class="stat-card-bar-fill" style="width:{overallCoverage}%"></div>
      </div>
  </MetricCard>
  
  </div>

  <section class="section">
    <div class="section-heading">
      <div>
        <h2 class="section-title">Squads</h2>
        <p class="section-subtitle">{squads.length} squads visible</p>
      </div>
      <div class="filters">
        <input bind:value={tribeFilter} oninput={refreshSquads} placeholder="Filter tribe" />
        <input bind:value={squadFilter} oninput={refreshSquads} placeholder="Filter squad" />
      </div>
    </div>
    <DataTable>
      {#snippet head()}
        <tr>
          <th><button class="sort-button" onclick={() => sortSquads('name')}>Squad {indicator(squadSortBy === 'name', squadSortDir)}</button></th>
          <th>Tribe</th>
          <th>Projects</th>
          <th>Scenarios</th>
          <th>Automated</th>
          <th><button class="sort-button" onclick={() => sortSquads('coverage')}>Coverage {indicator(squadSortBy === 'coverage', squadSortDir)}</button></th>
        </tr>
      {/snippet}
      {#snippet body()}
        {#if squads.length === 0}
          <tr><td colspan="6" class="empty-cell">No coverage data yet.</td></tr>
        {:else}
          {#each squads as row}
            <tr
              class="click-row"
              class:row-selected={selectedSquad?.squadId === row.squadId}
              onclick={() => goto('/squads/' + row.squadId)}
            >
              <td data-label="Squad" class="bold">{row.squadName}</td>
              <td data-label="Tribe">{row.tribeName ?? '—'}</td>
              <td data-label="Projects">{row.projectCount}</td>
              <td data-label="Scenarios">{row.totalScenarios}</td>
              <td data-label="Automated">{row.totalAutomated}</td>
              <td data-label="Coverage"><strong>{pct(row.coveragePercentage)}</strong></td>
            </tr>
          {/each}
        {/if}
      {/snippet}
    </DataTable>
  </section>

  {#if selectedSquad}
    <section class="section">
      <div class="section-heading">
        <div>
          <h2 class="section-title">{selectedSquad.squadName} Projects</h2>
          <p class="section-subtitle">Project statistics inside this squad.</p>
        </div>
        <div class="filters">
          <input bind:value={projectFilter} oninput={refreshProjects} placeholder="Filter project" />
        </div>
      </div>
      <DataTable>
        {#snippet head()}
          <tr>
            <th><button class="sort-button" onclick={() => sortProjects('name')}>Project {indicator(projectSortBy === 'name', projectSortDir)}</button></th>
            <th>Scenarios</th>
            <th>Automated</th>
            <th>Automatable</th>
            <th><button class="sort-button" onclick={() => sortProjects('coverage')}>Coverage {indicator(projectSortBy === 'coverage', projectSortDir)}</button></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#if projects.length === 0}
            <tr><td colspan="5" class="empty-cell">No projects found for this squad.</td></tr>
          {:else}
            {#each projects as row}
              <tr>
                <td data-label="Project"><a class="link bold" href="/projects/{row.projectKey}">{row.projectName}</a></td>
                <td data-label="Scenarios">{row.totalScenarios}</td>
                <td data-label="Automated">{row.totalAutomated}</td>
                <td data-label="Automatable">{row.totalAutomatable}</td>
                <td data-label="Coverage"><strong>{pct(row.coveragePercentage)}</strong></td>
              </tr>
            {/each}
          {/if}
        {/snippet}
      </DataTable>
    </section>
  {/if}

  {#if busy}
    <div class="refresh-indicator" aria-live="polite" aria-label="Refreshing data">
      <span class="spinner" aria-hidden="true"></span>
      <span class="muted">Refreshing…</span>
    </div>
  {/if}
</div>

<style>
  .page { max-width: min(1520px, 100%); min-height: calc(100vh - 80px); }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle, .section-subtitle, .muted { color: var(--color-text-muted); font-size: 0.875rem; }

  /* ── Summary stats cards ─────────────────────────────────── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }

  .stat-card-bar { height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
  .stat-card-bar-fill { height: 100%; background: #16a34a; border-radius: 2px; transition: width 0.4s ease; }
  .refresh-indicator { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .section { margin-bottom: 32px; }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
  .filters { display: flex; gap: 10px; flex-wrap: wrap; }
  .filters input {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 8px 10px;
  }
  .sort-button {
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    font-weight: 700;
    color: inherit;
    cursor: pointer;
  }
  .click-row { cursor: pointer; }
  .row-selected { background: color-mix(in srgb, var(--color-accent), transparent 90%); }
  .bold { font-weight: 600; }
  .link { color: var(--color-accent); text-decoration: none; }
  .empty-cell { text-align: center; color: var(--color-text-muted); padding: 20px; }
  :global(.page > .app-alert) { margin-bottom: 20px; }

  @media (max-width: 720px) {
    .section-heading { flex-direction: column; align-items: stretch; }
    .filters { flex-direction: column; }
    .filters input { width: 100%; box-sizing: border-box; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>

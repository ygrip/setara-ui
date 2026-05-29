<script lang="ts">
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  import { listSquadCoverage, listSquadProjectCoverage, type SquadCoverage, type SquadProjectCoverage } from '$lib/api/statistics';

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
</script>

<svelte:head>
  <title>Coverage Overview — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Coverage Overview</h1>
      <p class="page-subtitle">Squad-level automation coverage with project drilldown.</p>
    </div>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

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
          <th>Total Scenarios</th>
          <th>Automated</th>
          <th><button class="sort-button" onclick={() => sortSquads('coverage')}>Coverage {indicator(squadSortBy === 'coverage', squadSortDir)}</button></th>
        </tr>
      {/snippet}
      {#snippet body()}
        {#if squads.length === 0}
          <tr><td colspan="6" class="empty-cell">No squad coverage captured yet.</td></tr>
        {:else}
          {#each squads as row}
            <tr
              class="click-row"
              class:row-selected={selectedSquad?.squadId === row.squadId}
              onclick={() => goto('/squads/' + row.squadId)}
            >
              <td class="bold">{row.squadName}</td>
              <td>{row.tribeName ?? '—'}</td>
              <td>{row.projectCount}</td>
              <td>{row.totalScenarios}</td>
              <td>{row.totalAutomated}</td>
              <td><strong>{pct(row.coveragePercentage)}</strong></td>
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
            <th>Total Scenarios</th>
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
                <td><a class="link bold" href="/projects/{row.projectKey}">{row.projectName}</a></td>
                <td>{row.totalScenarios}</td>
                <td>{row.totalAutomated}</td>
                <td>{row.totalAutomatable}</td>
                <td><strong>{pct(row.coveragePercentage)}</strong></td>
              </tr>
            {/each}
          {/if}
        {/snippet}
      </DataTable>
    </section>
  {/if}

  {#if busy}<p class="muted">Refreshing…</p>{/if}
</div>

<style>
  .page { max-width: min(1520px, 100%); }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle, .section-subtitle, .muted { color: var(--color-text-muted); font-size: 0.875rem; }
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
  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
  }

  @media (max-width: 720px) {
    .section-heading { flex-direction: column; align-items: stretch; }
    .filters { flex-direction: column; }
    .filters input { width: 100%; box-sizing: border-box; }
  }
</style>

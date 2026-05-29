<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { SquadProjectCoverage } from '$lib/api/statistics';

  let { data } = $props();

  let projectSearch = $state('');
  let squadSortBy = $state<'projectName' | 'coveragePercentage' | 'totalScenarios'>('coveragePercentage');
  let squadSortDir = $state<'asc' | 'desc'>('asc');

  function toggleSort(col: 'projectName' | 'coveragePercentage' | 'totalScenarios') {
    if (squadSortBy === col) squadSortDir = squadSortDir === 'asc' ? 'desc' : 'asc';
    else { squadSortBy = col; squadSortDir = col === 'coveragePercentage' ? 'asc' : 'desc'; }
  }
  function sortIcon(col: string): string {
    if (squadSortBy !== col) return '';
    return squadSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filteredProjects = $derived.by(() => {
    const q = projectSearch.toLowerCase();
    let result = (data.projects as SquadProjectCoverage[]).filter(p =>
      !q || p.projectName.toLowerCase().includes(q) || p.projectKey.toLowerCase().includes(q)
    );
    return [...result].sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (squadSortBy === 'projectName') { va = a.projectName; vb = b.projectName; }
      else if (squadSortBy === 'totalScenarios') { va = a.totalScenarios; vb = b.totalScenarios; }
      else { va = a.coveragePercentage; vb = b.coveragePercentage; }
      if (va < vb) return squadSortDir === 'asc' ? -1 : 1;
      if (va > vb) return squadSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  const totalAutomated = $derived(
    (data.projects as SquadProjectCoverage[]).reduce((s, p) => s + p.totalAutomated, 0)
  );
  const totalScenarios = $derived(
    (data.projects as SquadProjectCoverage[]).reduce((s, p) => s + p.totalScenarios, 0)
  );
  const coveragePct = $derived(
    totalScenarios > 0 ? Math.round((totalAutomated / totalScenarios) * 100) : 0
  );

  const coverageDonut = $derived({
    labels: ['Automated', 'Not Automated'],
    datasets: [{
      data: [totalAutomated, Math.max(totalScenarios - totalAutomated, 0)],
      backgroundColor: ['#0d9488', '#d1d5db'],
      borderWidth: 0
    }]
  });

  const passRateChartData = {
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'],
    datasets: [{
      label: 'Pass Rate %',
      data: [72, 78, 75, 82, 85, 80, 88],
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#0d9488'
    }]
  };

  // Top 3 volatile = lowest coverage percentage
  const volatileProjects = $derived.by(() => {
    return [...(data.projects as SquadProjectCoverage[])]
      .sort((a, b) => a.coveragePercentage - b.coveragePercentage)
      .slice(0, 3);
  });

  function pct(v: number): string {
    return `${Number(v ?? 0).toFixed(0)}%`;
  }
</script>

<svelte:head>
  <title>{data.squad?.name ?? data.squadId} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/coverage-overview">Squads</a>
    <span class="sep">›</span>
    {#if data.squad?.tribeName}
      <span>{data.squad.tribeName}</span>
      <span class="sep">›</span>
    {/if}
    <span>{data.squad?.name ?? data.squadId}</span>
  </nav>

  {#if data.error}
    <div class="error-banner">{data.error}</div>
  {:else}
    <header class="page-header">
      <div>
        <div class="header-top">
          <h1>{data.squad?.name ?? data.squadId}</h1>
          {#if data.squad?.tribeName}
            <Badge text={data.squad.tribeName} variant="neutral" />
          {/if}
        </div>
        <p class="header-sub">Squad detail — automation coverage and quality health overview.</p>
      </div>
      <Button variant="primary" href="/squads/{data.squadId}/release-plans"
        icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>'
      >Release Plans</Button>
    </header>

    <!-- Charts row -->
    <div class="charts-row">
      <div class="chart-card">
        <h2 class="chart-title">Overall Coverage</h2>
        <div class="donut-wrap">
          <DonutChart chartData={coverageDonut} size={240} />
        </div>
        <div class="coverage-stat">
          <strong>{pct(coveragePct)}</strong>
          <span>of {totalScenarios} scenarios automated</span>
        </div>
      </div>
      <div class="chart-card chart-card--wide">
        <h2 class="chart-title">Pass Rate Trend (Last 7 Weeks)</h2>
        <LineChart chartData={passRateChartData} />
      </div>
    </div>

    <!-- Volatile projects -->
    {#if volatileProjects.length > 0}
    <section class="section">
      <h2 class="section-title">Low Coverage Projects</h2>
      <div class="volatile-grid">
        {#each volatileProjects as proj}
          <a href="/projects/{proj.projectKey}" class="volatile-card">
            <div class="volatile-top">
              <span class="volatile-name">{proj.projectName}</span>
              <span class="volatile-badge volatile-badge--warn">
                {proj.totalScenarios - proj.totalAutomated} not automated
              </span>
            </div>
            <div class="volatile-pct">{pct(proj.coveragePercentage)} coverage</div>
            <div class="volatile-bar">
              <div class="volatile-fill" style="width:{proj.coveragePercentage}%"></div>
            </div>
          </a>
        {/each}
      </div>
    </section>
    {/if}

    <!-- Project coverage table -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Project Coverage</h2>
        <input class="search-input" bind:value={projectSearch} placeholder="Search projects…" />
      </div>
      <DataTable mobileCards>
        {#snippet head()}
          <tr>
            <th class="th-sort" onclick={() => toggleSort('projectName')}>Project{sortIcon('projectName')}</th>
            <th class="th-sort" onclick={() => toggleSort('totalScenarios')}>Scenarios{sortIcon('totalScenarios')}</th>
            <th>Automated</th>
            <th>Automatable</th>
            <th class="th-sort" onclick={() => toggleSort('coveragePercentage')}>Coverage{sortIcon('coveragePercentage')}</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#if filteredProjects.length === 0}
            <tr><td colspan="5" class="empty-cell">No projects found.</td></tr>
          {:else}
            {#each filteredProjects as proj}
              <tr>
                <td data-label="Project"><a class="project-link" href="/projects/{proj.projectKey}">{proj.projectName}</a></td>
                <td data-label="Scenarios">{proj.totalScenarios}</td>
                <td data-label="Automated">{proj.totalAutomated}</td>
                <td data-label="Automatable">{proj.totalAutomatable}</td>
                <td data-label="Coverage">
                  <div class="cov-cell">
                    <div class="cov-bar"><div class="cov-fill" style="width:{proj.coveragePercentage}%"></div></div>
                    <strong>{pct(proj.coveragePercentage)}</strong>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        {/snippet}
      </DataTable>
    </section>
  {/if}
</div>

<style>
  .page { max-width: min(1520px, 100%); }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .sep { opacity: 0.5; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; margin-bottom: 20px; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .header-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .header-sub { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }
  .charts-row { display: grid; grid-template-columns: 240px 1fr; gap: 20px; margin-bottom: 28px; }
  @media (min-width: 1100px) { .charts-row { grid-template-columns: 280px 1fr; } }
  .chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; }
  .chart-card--wide { display: flex; flex-direction: column; }
  .chart-title { font-size: 0.875rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 14px; }
  .donut-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
  .coverage-stat { text-align: center; font-size: 0.875rem; color: var(--color-text-muted); }
  .coverage-stat strong { display: block; font-size: 1.5rem; color: var(--color-text); }
  .section { margin-bottom: 32px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0 0 14px; }
  .section-header .section-title { margin: 0; }
  .search-input { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; }
  .project-link { color: var(--color-accent); text-decoration: none; font-weight: 600; }
  .cov-cell { display: flex; align-items: center; gap: 8px; }
  .cov-bar { flex: 1; height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; min-width: 60px; }
  .cov-fill { height: 100%; background: #0d9488; border-radius: 3px; }
  .empty-cell { text-align: center; color: var(--color-text-muted); padding: 20px; }
  .volatile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .volatile-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; text-decoration: none; color: var(--color-text); display: flex; flex-direction: column; gap: 10px; transition: border-color 0.15s; }
  .volatile-card:hover { border-color: var(--color-accent); }
  .volatile-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .volatile-name { font-weight: 700; font-size: 0.875rem; }
  .volatile-badge { font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
  .volatile-badge--warn { background: #fef3c7; color: #d97706; }
  .volatile-pct { font-size: 0.78rem; color: var(--color-text-muted); }
  .volatile-bar { height: 5px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
  .volatile-fill { height: 100%; background: #d97706; border-radius: 3px; }
  @media (max-width: 700px) {
    .charts-row { grid-template-columns: 1fr; }
  }
</style>

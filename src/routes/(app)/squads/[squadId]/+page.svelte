<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import type { SquadProjectCoverage, SquadHistoryPoint } from '$lib/api/statistics';
  import { listSquadHistory } from '$lib/api/statistics';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import { untrack } from 'svelte';

  let { data } = $props();

  let projectSearch = $state('');
  let squadSortBy = $state<'projectName' | 'coveragePercentage' | 'totalScenarios'>('coveragePercentage');
  let squadSortDir = $state<'asc' | 'desc'>('asc');

  // ── Trend chart controls ─────────────────────────────────────
  let chartStart = $state(untrack(() => data.squadHistoryStart) ?? '');
  let chartEnd = $state(untrack(() => data.squadHistoryEnd) ?? '');
  let granularity = $state<'daily' | 'weekly' | 'monthly'>('daily');
  let historyData = $state<SquadHistoryPoint[]>(untrack(() => data.squadHistory) ?? []);
  let loadingHistory = $state(false);

  async function refetchSquadHistory() {
    if (!chartStart || !chartEnd) return;
    loadingHistory = true;
    try {
      historyData = await listSquadHistory(data.squadId, chartStart, chartEnd, granularity);
    } finally {
      loadingHistory = false;
    }
  }

  // displayHistory = raw API data (server already handles grouping)
  const displayHistory = $derived(historyData);

  const trendChartData = $derived({
    labels: displayHistory.map(r => r.bucketDate.slice(5)),
    datasets: [
      {
        label: 'Coverage %',
        data: displayHistory.map(r => r.coveragePercentage),
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.12)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Pass %',
        data: displayHistory.map(r => r.avgPassPercentage ?? null),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        fill: false,
        tension: 0.4,
        borderDash: [4, 3],
        yAxisID: 'y1',
        spanGaps: false
      }
    ]
  });

  const avgPassPct = $derived.by(() => {
    const pts = displayHistory.filter(r => r.avgPassPercentage != null);
    if (pts.length === 0) return null;
    return pts.reduce((s, r) => s + (r.avgPassPercentage ?? 0), 0) / pts.length;
  });

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
    <AppAlert tone="error">{data.error}</AppAlert>
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
      <BentoCard title="Overall Coverage" subtitle="{pct(coveragePct)} of {totalScenarios} scenarios automated" variant="default">
        <div class="donut-wrap">
          <DonutChart chartData={coverageDonut} size={240} />
        </div>
      </BentoCard>
      <BentoCard title="Coverage Trend{loadingHistory ? ' …' : ''}" subtitle="Automation coverage over time" variant="default">
        <div class="chart-controls">
          <label>Start <input type="date" bind:value={chartStart} onchange={refetchSquadHistory} /></label>
          <label>End <input type="date" bind:value={chartEnd} onchange={refetchSquadHistory} /></label>
          <label>Group
            <select bind:value={granularity} onchange={refetchSquadHistory}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {#if avgPassPct != null}
            <div class="pass-avg-badge">
              <span class="pass-avg-label">Avg Pass</span>
              <span class="pass-avg-value">{avgPassPct.toFixed(1)}%</span>
            </div>
          {/if}
        </div>
        {#if historyData.length === 0}
          <p class="trend-empty">No coverage history available.</p>
        {:else}
          <LineChart chartData={trendChartData} height={260} label="Coverage" />
        {/if}
      </BentoCard>
    </div>

    <!-- Low Coverage Projects -->
    {#if volatileProjects.length > 0}
    <section class="section">
      <h2 class="section-title">Low Coverage Projects</h2>
      <div class="metrics-row">
        {#each volatileProjects as proj}
          <MetricCard
            label={proj.projectName}
            value={pct(proj.coveragePercentage)}
            sub={`${proj.totalScenarios - proj.totalAutomated} of ${proj.totalScenarios} not automated`}
            variant="warning"
            href="/projects/{proj.projectKey}"
            ariaLabel={`Open ${proj.projectName} coverage`}
          />
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
      <DataTable>
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
  :global(.page > .app-alert) { margin-bottom: 20px; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .header-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .header-sub { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }
  .charts-row { display: grid; grid-template-columns: 280px 1fr; gap: 20px; margin-bottom: 28px; }
  .donut-wrap { display: flex; justify-content: center; padding: 8px 0; }
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
  .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .chart-controls { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .chart-controls label {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 0.72rem; color: var(--color-text-muted); font-weight: 600;
  }
  .chart-controls input,
  .chart-controls select {
    border: 1px solid var(--color-border); border-radius: 6px;
    background: var(--color-bg); color: var(--color-text);
    padding: 7px 9px; font: inherit;
  }
  .trend-empty { color: var(--color-text-muted); font-size: 0.85rem; margin: 16px 0; }
  .pass-avg-badge {
    display: flex; flex-direction: column; gap: 2px;
    background: color-mix(in srgb, #6366f1, transparent 88%);
    border: 1px solid color-mix(in srgb, #6366f1, transparent 70%);
    border-radius: 8px; padding: 5px 10px;
  }
  .pass-avg-label { font-size: 0.68rem; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.04em; }
  .pass-avg-value { font-size: 1rem; font-weight: 800; color: #6366f1; line-height: 1.1; }
  @media (max-width: 800px) {
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
    .charts-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>

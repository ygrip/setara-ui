<script lang="ts">
  import { page } from '$app/state';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { ProjectStatistic } from '$lib/api/statistics';

  let { data }: { data: { history: ProjectStatistic[] } } = $props();

  const projectKey = $derived(page.params.projectKey);
  const latest = $derived(data.history[0]);
  const notAutomatable = $derived(latest ? Math.max(0, latest.totalScenarios - latest.totalAutomatable) : 0);

  // Real automation breakdown donut computed from latest stats
  const automationDonut = $derived({
    labels: ['Automated', 'Automatable (not yet)', 'Not Automatable'],
    datasets: [{
      data: [
        latest?.totalAutomated ?? 0,
        latest ? Math.max(0, latest.totalAutomatable - latest.totalAutomated) : 0,
        latest ? Math.max(0, latest.totalScenarios - latest.totalAutomatable) : 0
      ],
      backgroundColor: ['#0d9488', '#6366f1', '#94a3b8'],
      borderWidth: 0
    }]
  });

  const coverageTrend = $derived({
    labels: [...data.history].reverse().map(row => row.statDate.slice(5)),
    datasets: [{
      label: 'Coverage %',
      data: [...data.history].reverse().map(row => row.coveragePercentage),
      borderColor: '#2f8f83',
      backgroundColor: 'rgba(47, 143, 131, 0.14)',
      fill: true,
      tension: 0.32,
      yAxisID: 'y1'
    }]
  });
</script>

<svelte:head>
  <title>Coverage — {projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span class="sep">›</span>
    <span>Coverage</span>
  </nav>

  <div class="page-header">
    <h1 class="page-title">Coverage</h1>
  </div>

  <!-- Metric cards -->
  <div class="metrics-row">
    <MetricCard label="Total Scenarios" value={latest?.totalScenarios ?? '—'} sub={latest ? `snapshot ${latest.statDate}` : 'no scenario data'} variant="default" />
    <MetricCard label="Automated" value={latest?.totalAutomated ?? '—'} sub={latest ? `${latest.coveragePercentage}% coverage` : 'no data'} variant="info" />
    <MetricCard label="Automatable" value={latest?.totalAutomatable ?? '—'} sub="live scenarios only" variant="success" />
    <MetricCard label="Not Automatable" value={latest ? notAutomatable : '—'} sub={latest ? 'excluded from automatable coverage' : 'no data'} variant="warning" />
  </div>

  <div class="section">
    <h2 class="section-title">Coverage Trend</h2>
    {#if data.history.length === 0}
      <div class="empty-state"><p>No coverage statistics captured yet.</p></div>
    {:else}
      <div class="chart-panel">
        <LineChart chartData={coverageTrend} height={260} label="Daily Coverage" />
      </div>
    {/if}
  </div>

  <!-- Coverage formulas -->
  <div class="section">
    <h2 class="section-title">Coverage Formulas</h2>
    <div class="formula-card">
      <div class="formula-item">
        <span class="formula-name">Automation Coverage</span>
        <code class="formula-expr">automated_count / total_count × 100%</code>
        <span class="formula-desc">Percentage of all scenarios that have been automated.</span>
      </div>
      <div class="formula-divider"></div>
      <div class="formula-item">
        <span class="formula-name">Automatable Coverage</span>
        <code class="formula-expr">automated_count / automatable_count × 100%</code>
        <span class="formula-desc">Percentage of automatable scenarios that are covered.</span>
      </div>
      <div class="formula-divider"></div>
      <div class="formula-item">
        <span class="formula-name">Manual Coverage</span>
        <code class="formula-expr">manual_count / total_count × 100%</code>
        <span class="formula-desc">Percentage of scenarios executed only manually.</span>
      </div>
    </div>
  </div>

  <!-- Coverage Breakdown Donut -->
  {#if latest}
    <div class="section">
      <h2 class="section-title">Automation Breakdown</h2>
      <div class="chart-card donut-card">
        <DonutChart chartData={automationDonut} size={460} label="Scenario Automation Status" />
        <div class="donut-meta">
          <p class="donut-meta-line">Based on the latest coverage snapshot.</p>
          <p class="donut-meta-line"><strong>{latest.totalAutomated}</strong> automated out of <strong>{latest.totalScenarios}</strong> total scenarios.</p>
          <p class="donut-meta-line">Automatable coverage: <strong>{latest.coveragePercentage}%</strong></p>
        </div>
      </div>
    </div>
  {/if}

  <p class="data-note">
    Coverage data will populate once automation sessions are ingested and the execution worker processes scenario results.
  </p>
</div>

<style>
  .page { max-width: min(1520px, 100%); }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.5rem; font-weight: 700; }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .section {
    margin-bottom: 32px;
  }

  .chart-panel,
  .empty-state {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
  }

  .empty-state p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }

  .formula-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .formula-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 0;
  }

  .formula-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .formula-expr {
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 5px 10px;
    color: var(--color-accent);
    display: inline-block;
    width: fit-content;
  }

  .formula-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .formula-divider {
    height: 1px;
    background: var(--color-border);
    margin: 0;
  }

  .donut-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 28px 24px;
    display: flex;
    align-items: center;
    gap: 40px;
    box-shadow: var(--shadow);
    flex-wrap: wrap;
    justify-content: center;
  }

  .donut-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 240px;
    max-width: 420px;
  }

  @media (max-width: 760px) {
    .donut-card {
      padding: 18px;
      gap: 20px;
    }
  }

  .donut-meta-line {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .donut-meta-line strong { color: var(--color-text); }

  .data-note {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
    padding: 8px 0 16px;
  }
</style>

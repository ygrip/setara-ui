<script lang="ts">
  import { page } from '$app/state';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import { coverageByType } from '$lib/mock/data';

  const projectKey = $derived(page.params.projectKey);
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
    <MetricCard label="Total Scenarios" value="—" sub="no scenario data" variant="default" />
    <MetricCard label="Automated" value="—" sub="no data" variant="info" />
    <MetricCard label="Automatable" value="—" sub="no data" variant="success" />
    <MetricCard label="Not Automatable" value="—" sub="no data" variant="warning" />
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

  <!-- Coverage Charts -->
  <div class="section">
    <h2 class="section-title">Coverage Charts</h2>
    <div class="charts-row">
      <div class="chart-card">
        <DonutChart chartData={coverageByType} size={160} label="Coverage by Type" />
      </div>
      <div class="chart-card">
        <DonutChart chartData={coverageByType} size={160} label="Manual vs Automated" />
      </div>
      <div class="chart-card">
        <DonutChart chartData={coverageByType} size={160} label="Coverage by Priority" />
      </div>
    </div>
  </div>

  <p class="data-note">
    Coverage data will populate once automation sessions are ingested and the execution worker processes scenario results.
  </p>
</div>

<style>
  .page { max-width: 1100px; }

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

  .charts-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .chart-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 24px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow);
  }

  .data-note {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
    padding: 8px 0 16px;
  }

  @media (max-width: 640px) {
    .charts-row {
      grid-template-columns: 1fr;
    }
  }
</style>

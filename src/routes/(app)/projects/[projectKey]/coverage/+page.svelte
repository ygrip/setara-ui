<script lang="ts">
  import { page } from '$app/state';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { ProjectStatistic } from '$lib/api/statistics';

  let { data }: { data: { history: ProjectStatistic[] } } = $props();

  let formulaOpen = $state(false);

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

  <!-- ── Stat cards ───────────────────────────────────────── -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-card-icon total">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div class="stat-card-body">
        <span class="stat-card-value">{latest?.totalScenarios ?? '—'}</span>
        <span class="stat-card-label">Total Scenarios</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon automated">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="stat-card-body">
        <span class="stat-card-value">{latest?.totalAutomated ?? '—'}</span>
        <span class="stat-card-label">Automated</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon automatable">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/></svg>
      </div>
      <div class="stat-card-body">
        <span class="stat-card-value">{latest?.totalAutomatable ?? '—'}</span>
        <span class="stat-card-label">Automatable</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon coverage-stat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><polyline points="7 15 10 12 13 14 18 8"/></svg>
      </div>
      <div class="stat-card-body">
        <span class="stat-card-value">{latest?.coveragePercentage ?? '—'}%</span>
        <span class="stat-card-label">Coverage</span>
        <div class="stat-card-bar">
          <div class="stat-card-bar-fill" style="width:{latest?.coveragePercentage ?? 0}%"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Bento grid ─────────────────────────────────────────── -->
  <div class="bento-grid">
    <!-- Coverage trend -->
    <Card className="bento-card">
      <h3 class="bento-title">Coverage Trend</h3>
      {#if data.history.length === 0}
        <p class="empty-text">No coverage statistics captured yet.</p>
      {:else}
        <div class="chart-wrap">
          <LineChart chartData={coverageTrend} height={260} label="Daily Coverage" />
        </div>
      {/if}
    </Card>
    <!-- Automation breakdown -->
    <Card className="bento-card">
      <h3 class="bento-title">Automation Breakdown</h3>
      {#if latest}
        <div class="donut-wrap">
          <DonutChart chartData={automationDonut} size={220} label="Automation Status" />
        </div>
        <div class="donut-legend">
          <div class="legend-item">
            <span class="legend-dot automated-dot"></span>
            <span class="legend-label">Automated</span>
            <strong>{latest.totalAutomated}</strong>
          </div>
          <div class="legend-item">
            <span class="legend-dot automatable-dot"></span>
            <span class="legend-label">Automatable</span>
            <strong>{Math.max(0, latest.totalAutomatable - latest.totalAutomated)}</strong>
          </div>
          <div class="legend-item">
            <span class="legend-dot not-dot"></span>
            <span class="legend-label">Not Automatable</span>
            <strong>{notAutomatable}</strong>
          </div>
        </div>
      {:else}
        <p class="empty-text">No coverage data available.</p>
      {/if}
    </Card>
  </div>

  <!-- Coverage info -->
  <div class="section">
    <div class="section-header">
      <h2 class="section-title">Coverage Information</h2>
      <Button variant="secondary" onclick={() => formulaOpen = true}
        icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
      >Formulas</Button>
    </div>
    <Card padding="md">
      <p class="info-text">Coverage data populates once automation sessions are ingested and the execution worker processes scenario results. The trend chart shows daily snapshots; the donut breaks down the latest state.</p>
    </Card>
  </div>
</div>

<!-- ── Formula modal ───────────────────────────────────────── -->
<Modal open={formulaOpen} title="Coverage Formulas" size="md" onclose={() => formulaOpen = false}>
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
      <span class="formula-desc">Percentage of automatable scenarios that are covered by automation.</span>
    </div>
    <div class="formula-divider"></div>
    <div class="formula-item">
      <span class="formula-name">Manual Coverage</span>
      <code class="formula-expr">manual_count / total_count × 100%</code>
      <span class="formula-desc">Percentage of scenarios executed only via manual execution.</span>
    </div>
  </div>
</Modal>

<style>
  .page { max-width: min(1520px, 100%); }

  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.5rem; font-weight: 700; }

  /* ── Stat cards ──────────────────────────────────────────── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
  .stat-card {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .stat-card-icon {
    display: inline-grid; place-items: center;
    width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
  }
  .stat-card-icon.total { background: color-mix(in srgb, #3b82f6, transparent 86%); color: #1d4ed8; }
  .stat-card-icon.automated { background: color-mix(in srgb, #16a34a, transparent 86%); color: #15803d; }
  .stat-card-icon.automatable { background: color-mix(in srgb, #6366f1, transparent 86%); color: #4f46e5; }
  .stat-card-icon.coverage-stat { background: color-mix(in srgb, #0d9488, transparent 86%); color: #0f766e; }
  .stat-card-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .stat-card-value { font-size: 1.4rem; font-weight: 800; line-height: 1.1; color: var(--color-text); }
  .stat-card-label { font-size: 0.72rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-card-bar { height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
  .stat-card-bar-fill { height: 100%; background: #0d9488; border-radius: 2px; transition: width 0.4s ease; }

  /* ── Bento grid ──────────────────────────────────────────── */
  .bento-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
  :global(.bento-card) { display: flex; flex-direction: column; gap: 16px; }
  .bento-title { font-size: 0.95rem; font-weight: 700; margin: 0; color: var(--color-text); }
  .chart-wrap { flex: 1; min-height: 0; padding-top: 4px; }
  .empty-text { color: var(--color-text-muted); font-size: 0.85rem; margin: 0; }

  .donut-wrap { display: flex; justify-content: center; }
  .donut-legend { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .automated-dot { background: #0d9488; }
  .automatable-dot { background: #6366f1; }
  .not-dot { background: #94a3b8; }
  .legend-label { flex: 1; color: var(--color-text-muted); }
  .legend-item strong { color: var(--color-text); }

  .section { margin-bottom: 28px; }
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0; color: var(--color-text); }
  .info-text { font-size: 0.85rem; color: var(--color-text-muted); margin: 0; line-height: 1.6; }

  /* ── Formula modal (rendered in portal) ───────────────────── */
  :global(.formula-card) {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); padding: 20px;
    display: flex; flex-direction: column; gap: 0;
  }
  :global(.formula-item) { display: flex; flex-direction: column; gap: 6px; padding: 14px 0; }
  :global(.formula-name) { font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
  :global(.formula-expr) {
    font-family: ui-monospace, monospace; font-size: 0.82rem;
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: 4px; padding: 5px 10px; color: var(--color-accent);
    display: inline-block; width: fit-content;
  }
  :global(.formula-desc) { font-size: 0.8rem; color: var(--color-text-muted); }
  :global(.formula-divider) { height: 1px; background: var(--color-border); margin: 0; }

  @media (max-width: 900px) {
    .bento-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>

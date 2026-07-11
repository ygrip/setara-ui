<script lang="ts">
  import { page } from '$app/state';
  import Card from '$lib/components/Card.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { ProjectStatistic } from '$lib/api/statistics';
  import { listProjectStatisticHistory } from '$lib/api/statistics';
  import { untrack } from 'svelte';

  let { data }: { data: { history: ProjectStatistic[]; defaultStart: string; defaultEnd: string } } = $props();

  const projectKey = $derived(page.params.projectKey);

  let chartStart = $state(untrack(() => data.defaultStart));
  let chartEnd = $state(untrack(() => data.defaultEnd));
  let granularity = $state<'daily' | 'weekly'>('daily');
  let historyData = $state<ProjectStatistic[]>(untrack(() => data.history));
  let loadingHistory = $state(false);

  type RangeOption = '7d' | '30d' | '90d' | 'custom';
  let range = $state<RangeOption>('30d');

  function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

  function selectRange(next: RangeOption) {
    range = next;
    if (next === 'custom') return;
    const days = Number(next.slice(0, -1));
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    chartEnd = isoDate(end);
    chartStart = isoDate(start);
    refetchHistory();
  }

  async function refetchHistory() {
    const start = chartStart, end = chartEnd;
    if (!start || !end) return;
    loadingHistory = true;
    try {
      historyData = await listProjectStatisticHistory(projectKey as string, start, end, granularity);
    } finally {
      loadingHistory = false;
    }
  }

  $effect(() => {
    // Re-fetch when granularity changes (date changes call refetchHistory directly)
    granularity;
    refetchHistory();
  });

  const displayData = $derived(historyData);

  const latest = $derived(historyData[historyData.length - 1]);
  const notAutomatable = $derived(latest ? Math.max(0, latest.totalScenarios - latest.totalAutomatable) : 0);

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
    labels: displayData.map(row => row.statDate.slice(5)),
    datasets: [{
      label: 'Coverage %',
      data: displayData.map(row => row.coveragePercentage),
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
    <MetricCard
      label="Total Scenarios"
      value={latest?.totalScenarios ?? '—'}
      iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-info), transparent 86%)", color: "var(--color-info)" }}
    />
    <MetricCard
      label="Automated"
      value={latest?.totalAutomated ?? '—'}
      variant="success"
      iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-success), transparent 86%)", color: "var(--color-success)" }}
    />
    <MetricCard
      label="Automatable"
      value={latest?.totalAutomatable ?? '—'}
      iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/></svg>'
      iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-status-manual), transparent 86%)", color: "var(--color-status-manual)" }}
    />
    <MetricCard
      label="Coverage"
      value={`${latest?.coveragePercentage ?? '—'}%`}
      iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><polyline points="7 15 10 12 13 14 18 8"/></svg>'
      iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
    >
      <div class="stat-card-bar">
        <div class="stat-card-bar-fill" style="width:{latest?.coveragePercentage ?? 0}%"></div>
      </div>
    </MetricCard>
  </div>

  <!-- ── Coverage Trend (full width) ───────────────────────── -->
  <div class="trend-section">
  <BentoCard title="Coverage Trend{loadingHistory ? ' …' : ''}" subtitle="Automation coverage over time" variant="default">
    <div class="toolbar">
      <div class="presets">
        {#each (['7d', '30d', '90d', 'custom'] as const) as opt}
          <button class:active={range === opt} onclick={() => selectRange(opt)}>
            {opt === 'custom' ? 'Custom' : opt.toUpperCase()}
          </button>
        {/each}
      </div>
      <div class="toolbar-right">
        {#if range === 'custom'}
          <div class="date-fields">
            <label class="date-field">
              <span>From</span>
              <input type="date" value={chartStart} max={chartEnd || undefined}
                onchange={(e) => { chartStart = e.currentTarget.value; refetchHistory(); }} />
            </label>
            <label class="date-field">
              <span>To</span>
              <input type="date" value={chartEnd} min={chartStart || undefined}
                onchange={(e) => { chartEnd = e.currentTarget.value; refetchHistory(); }} />
            </label>
          </div>
        {/if}
        <select aria-label="Group by period" bind:value={granularity}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
    </div>
    {#if historyData.length === 0}
      <p class="empty-text">No coverage statistics captured yet.</p>
    {:else}
      <LineChart chartData={coverageTrend} height={300} label="Coverage" />
    {/if}
  </BentoCard>
  </div>

  <!-- ── Automation Breakdown (donut left, formula right) ──── -->
  <div class="breakdown-row">
    <Card className="breakdown-card">
      <h3 class="bento-title">Automation Breakdown</h3>
      {#if latest}
        <div class="donut-center">
          <DonutChart chartData={automationDonut} size={400} label="Automation Status" legendPosition="bottom" />
        </div>
      {:else}
        <p class="empty-text">No coverage data available.</p>
      {/if}
    </Card>

    <Card className="breakdown-card">
      <h3 class="bento-title">Coverage Formulas</h3>
      <div class="formula-list">
        <div class="formula-item">
          <span class="formula-name">Automation Coverage</span>
          <code class="formula-expr">automated_count / total_count × 100%</code>
          <span class="formula-desc">Percentage of all scenarios that have been automated.</span>
        </div>
        <div class="formula-divider"></div>
        <div class="formula-item">
          <span class="formula-name">Automatable Coverage</span>
          <code class="formula-expr">automated_count / automatable_count × 100%</code>
          <span class="formula-desc">Percentage of automatable scenarios covered by automation.</span>
        </div>
        <div class="formula-divider"></div>
        <div class="formula-item">
          <span class="formula-name">Not Automatable</span>
          <code class="formula-expr">total_count − automatable_count</code>
          <span class="formula-desc">Scenarios that require manual execution only.</span>
        </div>
        {#if latest}
          <div class="formula-divider"></div>
          <div class="stat-breakdown">
            <div class="stat-row"><span class="dot dot-auto"></span><span>Automated</span><strong>{latest.totalAutomated}</strong></div>
            <div class="stat-row"><span class="dot dot-can"></span><span>Automatable (pending)</span><strong>{Math.max(0, latest.totalAutomatable - latest.totalAutomated)}</strong></div>
            <div class="stat-row"><span class="dot dot-not"></span><span>Not Automatable</span><strong>{notAutomatable}</strong></div>
          </div>
        {/if}
      </div>
    </Card>
  </div>
</div>

<style>
  .page { max-width: min(100%); }

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
  .stat-card-bar { height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
  .stat-card-bar-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.4s ease; }

  /* ── Trend card ──────────────────────────────────────────── */
  .trend-section { margin-bottom: 28px; }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding: 0.45rem 0.6rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.6rem;
  }

  .presets { display: flex; gap: 0.25rem; }

  .presets button {
    padding: 0.28rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .presets button.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  }

  .presets button:hover:not(.active) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .date-fields { display: flex; gap: 0.4rem; }

  .date-field {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .date-field input {
    height: 1.9rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.7rem;
    padding: 0 0.4rem;
  }

  select {
    height: 1.9rem;
    padding: 0 0.55rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.7rem;
    cursor: pointer;
  }
  .empty-text { color: var(--color-text-muted); font-size: 0.85rem; margin: 0; }

  /* ── Breakdown row ───────────────────────────────────────── */
  .breakdown-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  :global(.breakdown-card) { display: flex; flex-direction: column; gap: 14px; }
  .donut-center { display: flex; justify-content: center; }

  /* ── Formula list ────────────────────────────────────────── */
  .formula-list { display: flex; flex-direction: column; }
  .formula-item { display: flex; flex-direction: column; gap: 5px; padding: 12px 0; }
  .formula-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
  .formula-expr {
    font-family: ui-monospace, monospace; font-size: 0.8rem;
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: 4px; padding: 4px 10px; color: var(--color-accent);
    display: inline-block; width: fit-content;
  }
  .formula-desc { font-size: 0.78rem; color: var(--color-text-muted); }
  .formula-divider { height: 1px; background: var(--color-border); }
  .stat-breakdown { display: flex; flex-direction: column; gap: 6px; padding: 12px 0 4px; }
  .stat-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
  .stat-row span:nth-child(2) { flex: 1; color: var(--color-text-muted); }
  .stat-row strong { color: var(--color-text); }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dot-auto { background: #0d9488; }
  .dot-can { background: #6366f1; }
  .dot-not { background: #94a3b8; }

  @media (max-width: 900px) {
    .breakdown-row { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>

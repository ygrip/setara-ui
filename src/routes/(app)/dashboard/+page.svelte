<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import LazyLineChart from '$lib/components/LazyLineChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {
    getDashboard,
    type DashboardMetricSummary,
    type DashboardResponse,
    type QualityHealthStatus,
    type TrendDirection
  } from '$lib/api/dashboard';
  import { executionSocketUrl, type ExecutionEvent } from '$lib/api/realtime';
  import { MockWebSocket, isStaticMockMode } from '$lib/mock/websocket';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import { AppSkeleton } from '$lib/ui/display';
  import { createQualityTrendData } from '$lib/components/qualityTrendChart';
  import NeedsAttentionPanel from '$lib/components/dashboard/NeedsAttentionPanel.svelte';
  import ProjectsOverviewTable from '$lib/components/dashboard/ProjectsOverviewTable.svelte';

  let { data } = $props();

  let chartStart = $state('');
  let chartEnd = $state('');
  let groupedBy = $state<'daily' | 'weekly' | 'monthly'>('daily');
  let dashboard = $state<DashboardResponse | null>(null);
  let dashboardError = $state('');
  $effect(() => {
    chartStart = data.chartStart;
    chartEnd = data.chartEnd;
    groupedBy = data.groupedBy;
    dashboard = data.dashboard;
    dashboardError = data.error ?? '';
  });
  let chartBusy = $state(false);
  let chartError = $state('');
  let showChartExpand = $state(false);
  let refreshingDashboard = false;

  let activeRuns = $state(new Map<string, ExecutionEvent>());
  let recentActivity = $state<ExecutionEvent[]>([]);

  const _wsCtor: typeof WebSocket = isStaticMockMode()
    ? (MockWebSocket as unknown as typeof WebSocket)
    : WebSocket;
  const projectSockets = new Map<string, WebSocket>();

  const liveByProject = $derived.by(() => {
    const m = new Map<string, number>();
    for (const ev of activeRuns.values()) {
      m.set(ev.projectKey, (m.get(ev.projectKey) ?? 0) + 1);
    }
    return m;
  });

  const liveRunCount = $derived(activeRuns.size);
  const summary = $derived(dashboard?.summary ?? null);

  onMount(() => {
    for (const project of dashboard?.projects ?? []) {
      openSocket(project.projectKey);
    }
  });

  onDestroy(() => {
    for (const ws of projectSockets.values()) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    }
    projectSockets.clear();
  });

  function openSocket(projectKey: string) {
    if (projectSockets.has(projectKey)) return;
    const url = executionSocketUrl(projectKey);
    if (!isStaticMockMode() && !url) return;
    const ws = new _wsCtor(
      isStaticMockMode() ? projectKey : url
    ) as WebSocket;
    projectSockets.set(projectKey, ws);

    ws.onerror = () => { /* onclose fires after onerror */ };
    ws.onmessage = (msg: MessageEvent) => {
      try {
        const event = JSON.parse(msg.data as string) as ExecutionEvent;
        handleWsEvent(event);
      } catch {
        // ignore malformed frames
      }
    };
  }

  function handleWsEvent(event: ExecutionEvent) {
    recentActivity = [event, ...recentActivity].slice(0, 8);

    if (event.type === 'RUN_STARTED') {
      activeRuns = new Map(activeRuns).set(event.runId, event);
    } else if (
      event.type === 'RUN_DISCOVERED' ||
      event.type === 'SCENARIO_RESULT_ACCEPTED'
    ) {
      if (activeRuns.has(event.runId)) {
        activeRuns = new Map(activeRuns).set(event.runId, {
          ...activeRuns.get(event.runId)!,
          ...event
        });
      }
    } else if (
      event.type === 'RUN_FINISHED' ||
      event.type === 'RUN_FINISH_ACCEPTED'
    ) {
      const next = new Map(activeRuns);
      next.delete(event.runId);
      activeRuns = next;
      void refreshDashboard(false);
    }
  }

  async function refreshDashboard(showBusy: boolean) {
    if (refreshingDashboard || !chartStart || !chartEnd) return;
    refreshingDashboard = true;
    if (showBusy) chartBusy = true;
    chartError = '';
    try {
      dashboard = await getDashboard({
        start: chartStart,
        end: chartEnd,
        group: groupedBy,
        attentionLimit: 5
      });
      dashboardError = '';
      for (const project of dashboard.projects) openSocket(project.projectKey);
    } catch (error) {
      if (showBusy) chartError = (error as Error).message;
      if (!dashboard) dashboardError = (error as Error).message;
    } finally {
      refreshingDashboard = false;
      if (showBusy) chartBusy = false;
    }
  }

  const coverageTrend = $derived(createQualityTrendData((dashboard?.trends ?? []).map((row) => ({
    label: compactDate(row.date),
    totalScenarios: row.totalScenarios,
    passRate: row.passRate,
    automationCoverage: row.automationCoverage
  }))));

  async function refreshChart() {
    await refreshDashboard(true);
  }

  function compactDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short'
    });
  }

  function statusLabel(status: QualityHealthStatus): string {
    if (status === 'HEALTHY') return 'Healthy';
    if (status === 'NEEDS_REVIEW') return 'Needs review';
    if (status === 'HIGH_RISK') return 'High risk';
    if (status === 'CRITICAL') return 'Critical';
    if (status === 'NO_RUNS') return 'No runs';
    return 'Neutral';
  }

  function statusTone(status: QualityHealthStatus): 'neutral' | 'success' | 'warning' | 'danger' {
    if (status === 'HEALTHY') return 'success';
    if (status === 'NEEDS_REVIEW') return 'warning';
    if (status === 'HIGH_RISK' || status === 'CRITICAL') return 'danger';
    return 'neutral';
  }

  function statusVariant(status: QualityHealthStatus): 'default' | 'success' | 'warning' | 'danger' {
    const tone = statusTone(status);
    if (tone === 'neutral') return 'default';
    return tone;
  }

  function trendDirection(direction: TrendDirection): 'up' | 'down' | 'flat' | 'unknown' {
    return direction.toLowerCase() as 'up' | 'down' | 'flat' | 'unknown';
  }

  function percentageValue(metric: DashboardMetricSummary): string | number {
    if (metric.valueLabel === 'No runs') return 'No runs';
    return Math.round(metric.value);
  }

  function percentageSuffix(metric: DashboardMetricSummary): string {
    if (metric.valueLabel === 'No runs') return '';
    return '%';
  }

  function eventLabel(type: string): string {
    switch (type) {
      case 'RUN_STARTED': return 'Run started';
      case 'RUN_FINISHED': return 'Run finished';
      case 'RUN_FINISH_ACCEPTED': return 'Run closed';
      case 'RUN_DISCOVERED': return 'Scenarios discovered';
      case 'SCENARIO_RESULT_ACCEPTED': return 'Result accepted';
      default: return type.replace(/_/g, ' ').toLowerCase();
    }
  }

  function eventVariantClass(type: string): string {
    if (type === 'RUN_STARTED' || type === 'RUN_DISCOVERED') return 'ev-info';
    if (type === 'RUN_FINISHED' || type === 'RUN_FINISH_ACCEPTED') return 'ev-success';
    return 'ev-neutral';
  }

  function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }
</script>

<svelte:head>
  <title>Dashboard - Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">A snapshot of quality, automation, and release readiness.</p>
    </div>
    {#if liveRunCount > 0}
      <div class="header-right">
        <span class="live-pill">
          <span class="live-dot"></span>
          {liveRunCount} run{liveRunCount > 1 ? 's' : ''} in progress
        </span>
      </div>
    {/if}
  </div>

  {#if dashboardError}
    <AppAlert tone="error" title="Dashboard unavailable">{dashboardError}</AppAlert>
  {/if}

  <div class="metrics-row">
    {#if summary}
      <MetricCard
        label="Quality health"
        value={Math.round(summary.qualityHealth.value)}
        suffix="/100"
        statusLabel={statusLabel(summary.qualityHealth.status)}
        statusTone={statusTone(summary.qualityHealth.status)}
        deltaLabel={summary.qualityHealth.deltaLabel}
        deltaDirection={trendDirection(summary.qualityHealth.trendDirection)}
        progressValue={summary.qualityHealth.value}
        sparklineValues={(dashboard?.trends ?? []).map((point) => point.qualityHealthScore)}
        helpText="Quality health combines pass rate, automation coverage, open failures, recent test activity, and test stability."
        variant={statusVariant(summary.qualityHealth.status)}
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.6-2.9 8.3-7 10-4.1-1.7-7-5.4-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-info), transparent 86%)", color: "var(--color-info)" }}
      />
      <MetricCard
        label="Projects"
        value={summary.projects.value.toLocaleString()}
        deltaLabel={summary.projects.deltaLabel}
        deltaDirection={trendDirection(summary.projects.trendDirection)}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
        href="/projects"
        actionLabel="View projects"
        ariaLabel="Open projects"
      />
      <MetricCard
        label="Test scenarios"
        value={summary.testScenarios.value.toLocaleString()}
        deltaLabel={summary.testScenarios.deltaLabel}
        deltaDirection={trendDirection(summary.testScenarios.trendDirection)}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9 3V5M12 3V5M15 3V5M13 9H9M15 13H9M8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V7.2C19 6.0799 19 5.51984 18.782 5.09202C18.5903 4.71569 18.2843 4.40973 17.908 4.21799C17.4802 4 16.9201 4 15.8 4H8.2C7.0799 4 6.51984 4 6.09202 4.21799C5.71569 4.40973 5.40973 4.71569 5.21799 5.09202C5 5.51984 5 6.07989 5 7.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.07989 21 8.2 21Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
        href="/coverage-overview"
        ariaLabel="Open scenario coverage overview"
      />
      <MetricCard
        label="Automation coverage"
        value={percentageValue(summary.automationCoverage)}
        suffix={percentageSuffix(summary.automationCoverage)}
        deltaLabel={summary.automationCoverage.deltaLabel}
        deltaDirection={trendDirection(summary.automationCoverage.trendDirection)}
        progressValue={summary.automationCoverage.value}
        sparklineValues={(dashboard?.trends ?? []).map((point) => point.automationCoverage)}
        variant="other"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 3v3"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-status-manual), transparent 86%)", color: "var(--color-status-manual)" }}
        href="/coverage-overview"
        actionLabel="View coverage"
        ariaLabel="Open automation coverage overview"
      />
      <MetricCard
        label="Pass rate"
        value={percentageValue(summary.passRate)}
        suffix={percentageSuffix(summary.passRate)}
        deltaLabel={summary.passRate.deltaLabel}
        deltaDirection={trendDirection(summary.passRate.trendDirection)}
        sparklineValues={(dashboard?.trends ?? []).map((point) => point.passRate)}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M8 12l3 3 5-6"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-success), transparent 86%)", color: "var(--color-success)" }}
        href="/coverage-overview"
        ariaLabel="Open quality overview"
      />
    {:else if !dashboardError}
      {#each Array(5) as _}
        <div class="metric-skeleton surface-card"><AppSkeleton height="116px" /></div>
      {/each}
    {/if}
  </div>

  <div class="decision-grid">
    <div class="chart-section">
      <div class="section-heading">
        <div>
          <h2 class="section-title">Quality trends</h2>
          <p class="section-subtitle">See how coverage, pass rate, and scenario volume change over time.</p>
        </div>
      <div class="chart-controls">
        <label>Start <input type="date" bind:value={chartStart} onchange={refreshChart} /></label>
        <label>End <input type="date" bind:value={chartEnd} onchange={refreshChart} /></label>
        <label>Group
          <select bind:value={groupedBy} onchange={refreshChart}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <button class="expand-btn" type="button" title="Expand chart" aria-label="Expand trends chart" onclick={() => showChartExpand = true}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          Expand
        </button>
      </div>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="chart-card surface-card"
      role="button"
      tabindex="0"
      title="Click to expand"
      onclick={() => showChartExpand = true}
      onkeydown={(e) => { if (e.key === 'Enter') showChartExpand = true; }}
    >
      {#if dashboard}
        <LazyLineChart chartData={coverageTrend} height={290} axisMode="mixed" />
      {:else}
        <div class="chart-loading" role="status" aria-label="Loading quality trends">
          <AppSkeleton height="290px" />
        </div>
      {/if}
      {#if chartBusy}<p class="chart-note">Updating trends...</p>{/if}
      {#if chartError}<p class="chart-error">{chartError}</p>{/if}
    </div>
    </div>
    <NeedsAttentionPanel
      items={dashboard?.attentionItems ?? []}
      loading={!dashboard && !dashboardError}
      unavailable={!dashboard && Boolean(dashboardError)}
    />
  </div>

  <Modal open={showChartExpand} title="Quality trends" size="full" onclose={() => showChartExpand = false}>
    <div class="expand-modal-content">
      <div class="expand-controls">
        <label>Start <input type="date" bind:value={chartStart} onchange={refreshChart} /></label>
        <label>End <input type="date" bind:value={chartEnd} onchange={refreshChart} /></label>
        <label>Group
          <select bind:value={groupedBy} onchange={refreshChart}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      <div class="expanded-chart-scroll">
        <div class="expanded-chart-frame">
          <LazyLineChart chartData={coverageTrend} axisMode="mixed" />
        </div>
      </div>
      {#if chartBusy}<p class="chart-note">Updating trends...</p>{/if}
    </div>
  </Modal>

  <!-- Always render both columns so the DOM structure is stable.
       The activity column is hidden via CSS when empty. -->
  <div class="lower-grid" class:lower-grid--active={recentActivity.length > 0}>
    <ProjectsOverviewTable
      projects={dashboard?.projects ?? []}
      {liveByProject}
      loading={!dashboard && !dashboardError}
      error={dashboard ? '' : dashboardError}
    />

    <!-- Live activity stays in the DOM and becomes visible when events arrive. -->
    <div class="activity-col">
      <div class="section">
        <h2 class="section-title">Live activity</h2>
        <div class="activity-feed">
          {#each recentActivity as event (`${event.runId}:${event.type}:${event.occurredAt}`)}
            <div class="activity-item {eventVariantClass(event.type)}">
              <div class="activity-dot"></div>
              <div class="activity-body">
                <span class="activity-label">{eventLabel(event.type)}</span>
                <span class="activity-project">{event.projectKey}</span>
                {#if event.totalScenarios != null}
                  <span class="activity-count">{event.totalScenarios} scenarios</span>
                {/if}
              </div>
              <span class="activity-time">{timeAgo(event.occurredAt)}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    max-width: min(1520px, 100%);
    min-height: calc(100vh - 80px);
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .page-subtitle {
    color: var(--color-text-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    align-self: center;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-success), transparent 85%);
    border: 1px solid color-mix(in srgb, var(--color-success), transparent 55%);
    color: var(--color-success);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  :global(.page > .app-alert) { margin-bottom: 20px; }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .metric-skeleton,
  .chart-loading {
    overflow: hidden;
    border-radius: var(--radius);
  }

  /* ── Chart section ── */
  .chart-section {
    min-width: 0;
  }

  .decision-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
    gap: 18px;
    align-items: stretch;
    margin-bottom: 32px;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--color-text);
  }

  .section-subtitle {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .chart-controls {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chart-controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .chart-controls input,
  .chart-controls select {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 7px 9px;
    font: inherit;
  }

  .expand-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
    align-self: flex-end;
    height: 36px;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
    vertical-align: middle;
    transition: border-color 0.15s, color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .expand-btn:hover,
  .expand-btn:focus-visible {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-accent-subtle);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 82%);
    outline: none;
  }

  .expand-btn svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    display: block;
  }

  .chart-card {
    background: var(--surface-card-bg, var(--color-surface));
    border: 1px solid var(--surface-card-border, var(--color-border));
    border-radius: var(--radius);
    padding: clamp(16px, 2vw, 24px);
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: box-shadow 0.15s;
    overflow: hidden;
  }

  .chart-loading { min-height: 290px; }
  .chart-card:hover {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 70%);
  }

  .chart-note,
  .chart-error {
    margin: 8px 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .chart-error { color: var(--color-danger); }

  /* ── Expand modal ── */
  .expand-modal-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    min-width: 0;
  }
  .expand-controls { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .expand-controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }
  .expand-controls input,
  .expand-controls select {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 7px 9px;
    font: inherit;
  }

  .expanded-chart-scroll {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
  }

  .expanded-chart-frame {
    min-width: 1040px;
    width: 100%;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    padding: 18px;
  }

  .expanded-chart-frame :global(.chart-wrap) {
    height: 100%;
    min-height: 0;
  }

  /* ── Lower grid ── */
  .lower-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }

  /* Activity column hidden when no events yet */
  .activity-col { display: none; }

  @media (min-width: 1100px) {
    .lower-grid--active {
      grid-template-columns: 1fr 340px;
      align-items: start;
    }
    .lower-grid--active .activity-col { display: block; }
  }

  /* Show stacked on mobile when active */
  .lower-grid--active .activity-col {
    display: block;
  }

  .section {
    margin-bottom: 0;
  }

  .activity-feed {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .activity-item {
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.8rem;
    transition: background 0.1s;
  }

  .activity-item:last-child { border-bottom: none; }
  .activity-item:hover { background: var(--color-bg); }

  .activity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    justify-self: center;
    flex-shrink: 0;
  }

  .ev-info .activity-dot { background: #6366f1; }
  .ev-success .activity-dot { background: var(--color-success); }
  .ev-neutral .activity-dot { background: var(--color-border); }

  .activity-body {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .activity-label {
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
  }

  .activity-project {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: 0.7rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .activity-count {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .activity-time {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (min-width: 1280px) {
    .chart-card { padding: 24px 28px; }
  }
  @media (max-width: 1050px) {
    .decision-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .chart-card { padding: 14px; }
    .lower-grid { grid-template-columns: 1fr; }
    .section-heading { flex-direction: column; align-items: stretch; }
    .chart-controls { flex-direction: column; align-items: stretch; }
    .chart-controls label { flex-direction: row; align-items: center; justify-content: space-between; }
    .chart-controls input,
    .chart-controls select { flex: 1; }
    .expand-btn { width: 100%; justify-content: center; align-self: stretch; }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
    .page-title { font-size: 1.25rem; }
    .col-hide-xs { display: none; }
  }
</style>

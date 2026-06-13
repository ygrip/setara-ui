<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LazyLineChart from '$lib/components/LazyLineChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { executionSocketUrl, type ExecutionEvent } from '$lib/api/realtime';
  import { getDashboardSummary, listAggregateStatisticHistory, type AggregateStatisticPoint, type DashboardSummary } from '$lib/api/statistics';
  import { MockWebSocket, isStaticMockMode } from '$lib/mock/websocket';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();

  // ── Aggregate chart state ─────────────────────────────────────
  let chartStart = $state('');
  let chartEnd = $state('');
  let groupedBy = $state<'daily' | 'weekly' | 'monthly'>('daily');
  let aggregateHistory = $state<AggregateStatisticPoint[]>([]);
  $effect(() => {
    chartStart = data.chartStart;
    chartEnd = data.chartEnd;
    groupedBy = data.groupedBy;
    aggregateHistory = data.aggregateHistory ?? [];
  });
  let chartBusy = $state(false);
  let chartError = $state('');
  let showChartExpand = $state(false);

  // ── Live summary (updated by WS RUN_FINISHED events) ─────────
  let summary = $state<DashboardSummary | null>(null);
  $effect(() => { summary = data.summary; });
  let refreshingSummary = false;

  // ── Multi-project WebSocket state ─────────────────────────────
  // One raw WebSocket per visible project so all projects report live events.
  // activeRuns: runId → event for all in-flight runs across all projects.
  let activeRuns = $state(new Map<string, ExecutionEvent>());
  let recentActivity = $state<ExecutionEvent[]>([]);
  let wsConnected = $state(0); // count of open connections

  // projectSockets held outside $state — plain JS object, not reactive.
  // In mock mode we use MockWebSocket which prints to console; otherwise real WebSocket.
  const _wsCtor: typeof WebSocket = isStaticMockMode()
    ? (MockWebSocket as unknown as typeof WebSocket)
    : WebSocket;
  const projectSockets = new Map<string, WebSocket>();

  // Derived: how many active runs per projectKey (for live badges in table).
  const liveByProject = $derived.by(() => {
    const m = new Map<string, number>();
    for (const ev of activeRuns.values()) {
      m.set(ev.projectKey, (m.get(ev.projectKey) ?? 0) + 1);
    }
    return m;
  });

  const liveRunCount = $derived(activeRuns.size);

  onMount(() => {
    for (const project of data.projects) {
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
    const ws = new _wsCtor(
      isStaticMockMode() ? projectKey : executionSocketUrl(projectKey)
    ) as WebSocket;
    projectSockets.set(projectKey, ws);

    ws.onopen = () => { wsConnected += 1; };
    ws.onclose = () => { wsConnected = Math.max(0, wsConnected - 1); };
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
      void refreshSummary();
    }
  }

  async function refreshSummary() {
    if (refreshingSummary) return;
    refreshingSummary = true;
    try {
      summary = await getDashboardSummary();
    } catch {
      // keep stale summary on error
    } finally {
      refreshingSummary = false;
    }
  }

  // ── Charts ────────────────────────────────────────────────────
  const coverageTrend = $derived({
    labels: aggregateHistory.map(row => compactDate(row.bucketDate)),
    datasets: [
      {
        type: 'bar',
        label: 'Total Scenarios',
        data: aggregateHistory.map(row => row.totalScenarios),
        backgroundColor: 'rgba(13, 148, 136, 0.55)',
        borderColor: '#0d9488',
        borderRadius: 3,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Automated',
        data: aggregateHistory.map(row => row.totalAutomated),
        backgroundColor: 'rgba(99, 102, 241, 0.65)',
        borderColor: '#6366f1',
        borderRadius: 3,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Coverage %',
        data: aggregateHistory.map(row => row.automationCoveragePercentage),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        tension: 0.4,
        pointRadius: 2,
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2,
        yAxisID: 'y1'
      },
      {
        type: 'line',
        label: 'Pass Rate %',
        data: aggregateHistory.map(row => row.overallPassRatePercentage),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.0)',
        tension: 0.4,
        pointRadius: 2,
        pointBackgroundColor: '#10b981',
        borderWidth: 2,
        borderDash: [5, 3],
        yAxisID: 'y1'
      }
    ]
  });

  async function refreshChart() {
    if (!chartStart || !chartEnd) return;
    chartBusy = true;
    chartError = '';
    try {
      aggregateHistory = await listAggregateStatisticHistory(chartStart, chartEnd, groupedBy);
    } catch (e) {
      chartError = (e as Error).message;
    } finally {
      chartBusy = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function compactDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short'
    });
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
  <title>Dashboard — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">A snapshot of test quality and automation progress across all your projects.</p>
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

  {#if data.error}
    <AppAlert tone="error" title="Could not connect to backend">{data.error}</AppAlert>
  {/if}

  <!-- Metric cards row -->
  <div class="metrics-row">
    <MetricCard
      label="Squads"
      value={summary?.totalSquads ?? '—'}
      variant="info"
      icon="M3 7h18M3 12h18M3 17h18"
      href="/coverage-overview"
      ariaLabel="Open squad coverage overview"
    />
    <MetricCard
      label="Projects"
      value={summary?.totalProjects ?? '—'}
      variant="default"
      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      href="/projects"
      ariaLabel="Open projects"
    />
    <MetricCard
      label="Test Scenarios"
      value={summary?.totalScenarios ?? '—'}
      variant="default"
      icon="M22 12h-4l-3 9L9 3l-3 9H2"
      href="/coverage-overview"
      ariaLabel="Open scenario coverage overview"
    />
    <MetricCard
      label="Pass Rate"
      value={`${Number(summary?.overallPassPercentage ?? 0).toFixed(0)}%`}
      sub={`${Number(summary?.automationCoveragePercentage ?? 0).toFixed(0)}% automated`}
      variant="default"
      icon="M12 2a10 10 0 100 20 10 10 0 000-20z"
      href="/coverage-overview"
      ariaLabel="Open quality and pass-rate overview"
    />
  </div>

  <!-- Coverage + Pass-Rate Trend -->
  <div class="chart-section">
    <div class="section-heading">
      <div>
        <h2 class="section-title">Trends</h2>
        <p class="section-subtitle">Automation coverage and test pass rate over time.</p>
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
      class="chart-card"
      role="button"
      tabindex="0"
      title="Click to expand"
      onclick={() => showChartExpand = true}
      onkeydown={(e) => { if (e.key === 'Enter') showChartExpand = true; }}
    >
      <LazyLineChart chartData={coverageTrend} height={290} />
      {#if chartBusy}<p class="chart-note">Refreshing chart…</p>{/if}
      {#if chartError}<p class="chart-error">{chartError}</p>{/if}
    </div>
  </div>

  <!-- Chart expand modal -->
  <Modal open={showChartExpand} title="Coverage &amp; Pass Rate Trend" size="full" onclose={() => showChartExpand = false}>
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
          <LazyLineChart chartData={coverageTrend} />
        </div>
      </div>
      {#if chartBusy}<p class="chart-note">Refreshing…</p>{/if}
    </div>
  </Modal>

  <!-- Always render both columns so the DOM structure is stable.
       The activity column is hidden via CSS when empty. -->
  <div class="lower-grid" class:lower-grid--active={recentActivity.length > 0}>
    <!-- Recent projects -->
    <div class="section">
      <h2 class="section-title">Recent Projects</h2>
      {#if data.projects.length === 0 && !data.error}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
            <path d="M3 7h18M3 12h18M3 17h18"/>
          </svg>
          <p>No projects yet — create your first project in the <a href="/projects">Projects section</a>.</p>
        </div>
      {:else}
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Key</th>
              <th>Project</th>
              <th class="col-hide-xs">Created</th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each data.projects as project (project.id)}
              {@const runCount = liveByProject.get(project.projectKey) ?? 0}
              <tr class:row-live={runCount > 0}>
                <td data-label="Key">
                  <div class="key-cell">
                    <span class="key-badge">{project.projectKey}</span>
                    {#if runCount > 0}
                      <span class="run-live-badge">
                        <span class="run-live-dot"></span>
                        {runCount} live
                      </span>
                    {/if}
                  </div>
                </td>
                <td data-label="Project" class="bold">{project.name}</td>
                <td data-label="Created" class="muted col-hide-xs">{formatDate(project.createdAt)}</td>
                <td data-label=""><a href="/projects/{project.projectKey}" class="link">Open →</a></td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </div>

    <!-- Live Activity Feed — always in DOM, visible only when there are events -->
    <div class="activity-col">
      <div class="section">
        <h2 class="section-title">Live Activity</h2>
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

  /* ── Chart section ── */
  .chart-section {
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
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: clamp(16px, 2vw, 24px);
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: box-shadow 0.15s;
    overflow: hidden;
  }
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

  /* ── Projects table live state ── */
  .key-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .run-live-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-success), transparent 85%);
    border: 1px solid color-mix(in srgb, var(--color-success), transparent 55%);
    color: var(--color-success);
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .run-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 1.5s infinite;
    flex-shrink: 0;
  }

  :global(tr.row-live td) {
    background: color-mix(in srgb, var(--color-success), transparent 96%);
  }

  /* ── Table ── */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .empty-state p { margin: 12px 0 0; font-size: 0.875rem; }

  .bold { font-weight: 500; }
  .muted { color: var(--color-text-muted); font-size: 0.875rem; }

  .key-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .link {
    color: var(--color-accent);
    font-size: 0.8rem;
    font-weight: 500;
  }

  @media (min-width: 1280px) {
    .chart-card { padding: 24px 28px; }
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

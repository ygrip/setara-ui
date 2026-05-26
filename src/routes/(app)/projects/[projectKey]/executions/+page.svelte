<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  // @ts-ignore — svelte-heatmap is an untyped Svelte 3 library; works via Svelte 5 compat layer
  import SvelteHeatmap from 'svelte-heatmap/src/SvelteHeatmap.svelte';
  import { wsManager } from '$lib/stores/websocket.svelte';
  import type { ExecutionEvent } from '$lib/api/realtime';
  import { listRuns } from '$lib/api/runs';
  import type { AutomationRun, HeatmapDay } from '$lib/api/runs';

  let { data }: {
    data: {
      projectKey: string;
      runs: AutomationRun[];
      nextCursor: string | null;
      heatmap: HeatmapDay[];
      error: string | null;
    }
  } = $props();

  let runs = $state<AutomationRun[]>(data.runs);
  let heatmap = $state<HeatmapDay[]>(data.heatmap);
  let liveEvents = $state<ExecutionEvent[]>([]);
  let refreshingRuns = false;

  // Dark-mode detection for heatmap theming
  let isDark = $state(false);
  onMount(() => {
    const check = () => { isDark = document.documentElement.dataset.theme === 'dark'; };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  // ── Heatmap data ────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const heatmapStart = new Date(today);
  heatmapStart.setDate(heatmapStart.getDate() - 181); // 26 weeks back

  const heatmapData = $derived(
    heatmap
      .filter(d => d.runCount > 0)
      .map(d => ({ date: new Date(d.date), value: Math.round(d.passRate) }))
  );

  // Colors: red → orange → yellow → light-green → dark-green (passRate 0→100)
  const heatmapColors = ['#ef4444', '#fb923c', '#fde68a', '#4ade80', '#16a34a'];
  const heatmapColorsDark = ['#7f1d1d', '#9a3412', '#78350f', '#14532d', '#4ade80'];

  // ── Client-side filters ─────────────────────────────────────────
  let filterStatus = $state('');
  let filterEnv = $state('');
  let filterBranch = $state('');
  let filterSearch = $state('');

  const uniqueEnvs = $derived([...new Set(runs.map(r => r.environment).filter(Boolean))] as string[]);
  const uniqueBranches = $derived([...new Set(runs.map(r => r.branch).filter(Boolean))] as string[]);

  const filteredRuns = $derived(
    runs.filter(run => {
      if (filterStatus && run.status?.toUpperCase() !== filterStatus) return false;
      if (filterEnv && run.environment !== filterEnv) return false;
      if (filterBranch && run.branch !== filterBranch) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        const haystack = `${run.runnerId} ${run.branch ?? ''} ${run.environment ?? ''} ${run.framework ?? ''} ${run.commitSha ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
  );

  const hasActiveFilter = $derived(!!(filterStatus || filterEnv || filterBranch || filterSearch.trim()));

  function clearFilters() {
    filterStatus = '';
    filterEnv = '';
    filterBranch = '';
    filterSearch = '';
  }

  // ── Pass-rate trend chart ────────────────────────────────────────
  const passRateTrend = $derived.by(() => {
    const byDate = new Map<string, { passed: number; total: number; failed: number }>();
    for (const run of runs) {
      if (run.startedAt && run.totalScenarios != null && run.totalScenarios > 0) {
        const d = run.startedAt.slice(0, 10);
        const existing = byDate.get(d) ?? { passed: 0, total: 0, failed: 0 };
        byDate.set(d, {
          passed: existing.passed + (run.passedScenarios ?? 0),
          total: existing.total + (run.totalScenarios ?? 0),
          failed: existing.failed + (run.failedScenarios ?? 0)
        });
      }
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      labels: sorted.map(([d]) => d.slice(5)),
      datasets: [
        {
          label: 'Pass Rate %',
          data: sorted.map(([, v]) => v.total > 0 ? Number(((v.passed / v.total) * 100).toFixed(1)) : 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.32,
          yAxisID: 'y1'
        },
        {
          type: 'bar' as const,
          label: 'Failed Scenarios',
          data: sorted.map(([, v]) => v.failed),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          yAxisID: 'y'
        }
      ]
    };
  });

  // ── Helpers ──────────────────────────────────────────────────────
  function runStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED': return 'success';
      case 'FAILED': return 'danger';
      case 'RUNNING': return 'info';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function duration(start: string, end: string | null): string {
    if (!end) return 'Running…';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function liveRunFromEvent(event: ExecutionEvent): AutomationRun {
    return {
      id: event.runId,
      projectId: '',
      projectKey: event.projectKey,
      runnerId: 'pending snapshot',
      jobName: null,
      environment: null,
      branch: null,
      commitSha: null,
      framework: null,
      status: event.status ?? 'RUNNING',
      startedAt: event.occurredAt,
      finishedAt: event.type === 'RUN_FINISHED' ? event.occurredAt : null,
      createdAt: event.occurredAt,
      totalScenarios: event.totalScenarios,
      durationMs: event.durationMs
    };
  }

  async function refreshRuns() {
    if (refreshingRuns) return;
    refreshingRuns = true;
    try {
      const page = await listRuns(data.projectKey);
      runs = page.items;
    } catch {
      // keep live row until next successful fetch
    } finally {
      refreshingRuns = false;
    }
  }

  function applyEvent(event: ExecutionEvent) {
    liveEvents = [event, ...liveEvents].slice(0, 5);
    if (event.projectKey !== data.projectKey) return;

    if (event.type === 'RUN_STARTED') {
      const exists = runs.some(r => r.id === event.runId);
      if (!exists) runs = [liveRunFromEvent(event), ...runs];
      void refreshRuns();
      return;
    }

    if (event.type === 'RUN_DISCOVERED' || event.type === 'SCENARIO_RESULT_ACCEPTED' || event.type === 'RUN_FINISH_ACCEPTED') {
      const exists = runs.some(r => r.id === event.runId);
      if (!exists) { runs = [liveRunFromEvent(event), ...runs]; void refreshRuns(); return; }
      runs = runs.map(run => run.id === event.runId
        ? { ...run, status: event.status ?? run.status, totalScenarios: event.totalScenarios ?? run.totalScenarios, durationMs: event.durationMs ?? run.durationMs }
        : run);
      return;
    }

    if (event.type === 'RUN_FINISHED') {
      const exists = runs.some(r => r.id === event.runId);
      if (!exists) { runs = [liveRunFromEvent(event), ...runs]; return; }
      runs = runs.map(run => run.id === event.runId
        ? { ...run, status: event.status ?? run.status, finishedAt: event.occurredAt, totalScenarios: event.totalScenarios ?? run.totalScenarios, durationMs: event.durationMs ?? run.durationMs }
        : run);
    }
  }

  let unsub: (() => void) | null = null;

  onMount(() => {
    wsManager.connect(data.projectKey);
    unsub = wsManager.addHandler(applyEvent);
  });

  onDestroy(() => {
    unsub?.();
    wsManager.disconnect();
  });
</script>

<svelte:head>
  <title>Executions — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep" aria-hidden="true">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep" aria-hidden="true">›</span>
    <span>Executions</span>
  </nav>

  <!-- Page header -->
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Executions</h1>
      <span
        class="socket-pill"
        class:socket-pill--live={wsManager.state === 'live'}
        class:socket-pill--reconnecting={wsManager.state === 'connecting'}
        aria-label="WebSocket status: {wsManager.state}"
      >{wsManager.state}</span>
    </div>
  </div>

  <!-- ── Execution activity heatmap ─────────────────────────── -->
  {#if heatmap.length > 0}
    <section class="section" aria-label="Execution activity heatmap">
      <div class="section-header">
        <h2 class="section-title">Execution Activity</h2>
        <span class="section-subtitle">Last 26 weeks · color = pass rate</span>
      </div>
      <div class="card heatmap-card">
        <div class="heatmap-inner">
          <SvelteHeatmap
            data={heatmapData}
            startDate={heatmapStart}
            endDate={today}
            colors={isDark ? heatmapColorsDark : heatmapColors}
            emptyColor={isDark ? '#1e293b' : '#e2e8f0'}
            fontColor={isDark ? '#94a3b8' : '#64748b'}
            cellSize={12}
            cellGap={3}
            cellRadius={2}
            dayLabelWidth={24}
            monthLabelHeight={14}
            fontSize={9}
          />
        </div>
        <div class="heatmap-legend">
          <span class="legend-label">Low pass rate</span>
          {#each (isDark ? heatmapColorsDark : heatmapColors) as color}
            <span class="legend-swatch" style="background:{color}"></span>
          {/each}
          <span class="legend-label">High pass rate</span>
          <span class="legend-sep"></span>
          <span class="legend-swatch" style="background:{isDark ? '#1e293b' : '#e2e8f0'}"></span>
          <span class="legend-label">No runs</span>
        </div>
      </div>
    </section>
  {/if}

  <!-- ── Filters bar ─────────────────────────────────────────── -->
  <div class="filters-bar" role="search" aria-label="Filter executions">
    <div class="filter-search-wrap">
      <input
        class="filter-search"
        type="search"
        placeholder="Search runner, branch, commit…"
        bind:value={filterSearch}
        aria-label="Search executions"
      />
    </div>
    <div class="filter-controls">
      <div class="filter-group">
        <label class="filter-label" for="filter-status">Status</label>
        <select id="filter-status" class="filter-select" bind:value={filterStatus}>
          <option value="">All</option>
          <option value="RUNNING">Running</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="QUEUED">Queued</option>
        </select>
      </div>
      {#if uniqueEnvs.length > 0}
        <div class="filter-group">
          <label class="filter-label" for="filter-env">Environment</label>
          <select id="filter-env" class="filter-select" bind:value={filterEnv}>
            <option value="">All</option>
            {#each uniqueEnvs as env}<option value={env}>{env}</option>{/each}
          </select>
        </div>
      {/if}
      {#if uniqueBranches.length > 0}
        <div class="filter-group">
          <label class="filter-label" for="filter-branch">Branch</label>
          <select id="filter-branch" class="filter-select" bind:value={filterBranch}>
            <option value="">All</option>
            {#each uniqueBranches as b}<option value={b}>{b}</option>{/each}
          </select>
        </div>
      {/if}
      {#if hasActiveFilter}
        <div class="filter-group filter-group--inline">
          <button class="clear-filter-btn" onclick={clearFilters}>✕ Clear</button>
          <span class="filter-count">{filteredRuns.length} of {runs.length}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Runs table ──────────────────────────────────────────── -->
  {#if data.error}
    <div class="error-banner" role="alert">Could not load executions — {data.error}</div>
  {:else if runs.length === 0}
    <div class="empty-state">
      <svg class="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <p class="empty-title">No runs yet for <strong>{data.projectKey}</strong></p>
      <p class="empty-sub">Set up an API key and run your automation suite to see executions here.</p>
    </div>
  {:else if filteredRuns.length === 0}
    <div class="empty-state">
      <p class="empty-title">No executions match the current filters.</p>
      <button class="link-btn" onclick={clearFilters}>Clear filters</button>
    </div>
  {:else}
    <div class="table-wrap">
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Status</th>
            <th>Runner</th>
            <th class="col-hide-sm">Branch</th>
            <th class="col-hide-md">Environment</th>
            <th class="col-hide-md">Framework</th>
            <th>Started</th>
            <th class="col-hide-sm">Duration</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each filteredRuns as run}
            <tr>
              <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
              <td class="mono">{run.runnerId}</td>
              <td class="col-hide-sm">{run.branch ?? '—'}</td>
              <td class="col-hide-md">{run.environment ?? '—'}</td>
              <td class="col-hide-md">{run.framework ?? '—'}</td>
              <td class="nowrap">{formatDate(run.startedAt)}</td>
              <td class="col-hide-sm nowrap">{duration(run.startedAt, run.finishedAt)}</td>
              <td><a href="/projects/{data.projectKey}/executions/{run.id}" class="link">View →</a></td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    </div>
  {/if}

  <!-- ── Live events feed ────────────────────────────────────── -->
  {#if liveEvents.length > 0}
    <section class="section section--live" aria-label="Live updates">
      <h2 class="section-title">Live Updates</h2>
      <div class="event-feed">
        {#each liveEvents as event}
          <div class="event-item">
            <span class="event-type">{event.type}</span>
            <span class="event-msg">{event.message ?? event.status ?? event.runId}</span>
            <span class="event-time">{formatDate(event.occurredAt)}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── Pass-rate trend chart ───────────────────────────────── -->
  {#if passRateTrend.labels.length > 0}
    <section class="section" aria-label="Pass rate trend">
      <div class="section-header">
        <h2 class="section-title">Execution Pass Rate</h2>
        <div class="chart-legend">
          <span class="legend-dot legend-dot--pass"></span>
          <span class="chart-legend-label">Pass Rate %</span>
          <span class="legend-dot legend-dot--fail"></span>
          <span class="chart-legend-label">Failed Scenarios</span>
        </div>
      </div>
      <div class="card chart-card">
        <LineChart chartData={passRateTrend} height={240} label="Pass Rate & Failed Scenarios" />
      </div>
    </section>
  {/if}
</div>

<style>
  /* ── Page shell ─────────────────────────────────────── */
  .page {
    max-width: min(1520px, 100%);
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Breadcrumb ─────────────────────────────────────── */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  /* ── Page header ────────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  .page-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .page-title {
    font-size: clamp(1.25rem, 4vw, 1.6rem);
    font-weight: 700;
    margin: 0;
  }

  .socket-pill {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 3px 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    align-self: center;
  }
  .socket-pill--live {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success), transparent 60%);
    background: color-mix(in srgb, var(--color-success), transparent 90%);
  }
  .socket-pill--reconnecting {
    color: var(--color-warning, #f59e0b);
    border-color: color-mix(in srgb, #f59e0b, transparent 60%);
    background: color-mix(in srgb, #f59e0b, transparent 90%);
  }

  /* ── Sections ───────────────────────────────────────── */
  .section {
    margin-bottom: 32px;
  }
  .section--live {
    margin-top: 8px;
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .section-subtitle {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* ── Shared card ────────────────────────────────────── */
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  /* ── Heatmap ────────────────────────────────────────── */
  .heatmap-card {
    padding: 20px 24px 16px;
    overflow-x: auto;
  }

  .heatmap-inner {
    min-width: 0;
    /* Let svelte-heatmap's SVG be responsive */
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .legend-label {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    margin: 0 2px;
  }

  .legend-swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-sep {
    display: inline-block;
    width: 10px;
  }

  /* ── Filters bar ────────────────────────────────────── */
  .filters-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px 20px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .filter-search-wrap {
    width: 100%;
  }

  .filter-search {
    width: 100%;
    max-width: 400px;
    font: inherit;
    font-size: 0.875rem;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
  }
  .filter-search:focus { outline: none; border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 85%); }

  .filter-controls {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .filter-group--inline {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .filter-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filter-select {
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: 0.875rem;
    outline: none;
    cursor: pointer;
    min-width: 120px;
  }
  .filter-select:focus { border-color: var(--color-accent); }

  .clear-filter-btn {
    font: inherit;
    font-size: 0.8rem;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .clear-filter-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

  .filter-count {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* ── Table wrapper ──────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--radius);
    margin-bottom: 32px;
  }

  /* ── Error / empty states ───────────────────────────── */
  .error-banner {
    background: color-mix(in srgb, var(--color-danger), transparent 90%);
    color: var(--color-danger);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%);
    border-radius: var(--radius);
    padding: 14px 18px;
    font-size: 0.875rem;
    margin-bottom: 24px;
  }

  .empty-state {
    text-align: center;
    padding: 64px 24px;
    color: var(--color-text-muted);
    margin-bottom: 32px;
  }
  .empty-icon { opacity: 0.25; margin-bottom: 16px; }
  .empty-title { margin: 0 0 8px; font-size: 0.925rem; color: var(--color-text); }
  .empty-title strong { color: var(--color-text); }
  .empty-sub { font-size: 0.8rem; opacity: 0.7; margin: 0; }

  .link-btn {
    font: inherit;
    font-size: 0.875rem;
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    padding: 0;
    margin-top: 10px;
    text-decoration: underline;
  }

  /* ── Table cell helpers ─────────────────────────────── */
  .mono { font-family: var(--font-mono); font-size: 0.78rem; }
  .link { color: var(--color-accent); font-size: 0.8rem; font-weight: 500; white-space: nowrap; }
  .nowrap { white-space: nowrap; }

  /* ── Live events ────────────────────────────────────── */
  .event-feed { display: grid; gap: 8px; }

  .event-item {
    display: grid;
    grid-template-columns: minmax(140px, auto) 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 0.8rem;
  }

  .event-type {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-accent);
  }

  .event-msg {
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-time { color: var(--color-text-muted); font-size: 0.72rem; white-space: nowrap; }

  /* ── Chart ──────────────────────────────────────────── */
  .chart-card {
    padding: 20px 24px;
  }

  .chart-legend {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chart-legend-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-right: 10px;
  }

  .legend-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-dot--pass { background: #10b981; }
  .legend-dot--fail { background: rgba(239, 68, 68, 0.7); }

  /* ── Responsive: tablet (≤900px) ───────────────────── */
  @media (max-width: 900px) {
    .col-hide-md { display: none; }
  }

  /* ── Responsive: mobile (≤600px) ───────────────────── */
  @media (max-width: 600px) {
    .col-hide-sm { display: none; }

    .filters-bar {
      padding: 14px 16px;
      gap: 10px;
    }

    .filter-search {
      max-width: none;
    }

    .filter-controls {
      gap: 10px;
    }

    .filter-select {
      min-width: 90px;
    }

    .heatmap-card {
      padding: 14px 14px 12px;
    }

    .chart-card {
      padding: 14px 16px;
    }

    .event-item {
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    .event-type {
      grid-column: 1 / -1;
    }

    .section-header {
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }

    .chart-legend {
      margin-top: 2px;
    }
  }
</style>

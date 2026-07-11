<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import HeatmapCalendar from '$lib/components/HeatmapCalendar.svelte';
  import { wsManager } from '$lib/stores/websocket.svelte';
  import type { ExecutionEvent } from '$lib/api/realtime';
  import { listRuns } from '$lib/api/runs';
  import type { AutomationRun, HeatmapDay } from '$lib/api/runs';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data }: {
    data: {
      projectKey: string;
      runs: AutomationRun[];
      nextCursor: string | null;
      heatmap: HeatmapDay[];
      error: string | null;
    }
  } = $props();

  let runs = $state<AutomationRun[]>([]);
  let heatmap = $state<HeatmapDay[]>([]);
  $effect(() => { runs = data.runs; heatmap = data.heatmap; });
  let liveEvents = $state<ExecutionEvent[]>([]);
  let refreshingRuns = false;

  // ── Heatmap period selector ─────────────────────────────────────
  const PERIODS = [
    { label: '1M', weeks: 5,  title: '1 month'  },
    { label: '3M', weeks: 13, title: '3 months' },
    { label: '6M', weeks: 26, title: '6 months' },
  ] as const;
  type PeriodLabel = typeof PERIODS[number]['label'];
  let activePeriod = $state<PeriodLabel>('3M');
  const heatmapWeeks = $derived(PERIODS.find(p => p.label === activePeriod)!.weeks);

  // ── Client-side filters ─────────────────────────────────────────
  let filterStatus = $state('');
  let filterEnv = $state('');
  let filterBranch = $state('');
  let filterSearch = $state('');

  let execSortBy = $state<'runnerId' | 'startedAt' | 'durationMs'>('startedAt');
  let execSortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: 'runnerId' | 'startedAt' | 'durationMs') {
    if (execSortBy === col) execSortDir = execSortDir === 'asc' ? 'desc' : 'asc';
    else { execSortBy = col; execSortDir = 'desc'; }
  }
  function sortIcon(col: string): string {
    if (execSortBy !== col) return '';
    return execSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const uniqueEnvs = $derived([...new Set(runs.map(r => r.environment).filter(Boolean))] as string[]);
  const uniqueBranches = $derived([...new Set(runs.map(r => r.branch).filter(Boolean))] as string[]);

  const filteredRuns = $derived.by(() => {
    let result = runs.filter(run => {
      if (filterStatus && run.status?.toUpperCase() !== filterStatus) return false;
      if (filterEnv && run.environment !== filterEnv) return false;
      if (filterBranch && run.branch !== filterBranch) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        const haystack = `${run.runnerId} ${run.branch ?? ''} ${run.environment ?? ''} ${run.framework ?? ''} ${run.commitSha ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return [...result].sort((a, b) => {
      let va = '', vb = '';
      if (execSortBy === 'runnerId') { va = a.runnerId ?? ''; vb = b.runnerId ?? ''; }
      else if (execSortBy === 'durationMs') { va = String(a.durationMs ?? 0); vb = String(b.durationMs ?? 0); }
      else { va = a.startedAt ?? ''; vb = b.startedAt ?? ''; }
      if (va < vb) return execSortDir === 'asc' ? -1 : 1;
      if (va > vb) return execSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  });

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
          yAxisID: 'yPercent'
        },
        {
          type: 'bar' as const,
          label: 'Failed Scenarios',
          data: sorted.map(([, v]) => v.failed),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          yAxisID: 'yVolume'
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
    if (!iso) return '-';
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
  <title>Executions - {data.projectKey} - Setara</title>
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

  <!-- ── Top charts grid ────────────────────────────────────────── -->
  <div class="charts-grid">
    <!-- Heatmap card -->
    <BentoCard title="Execution Activity" subtitle="Color = pass rate" variant="default">
      <div class="card-header-right">
        <div class="period-toggle" role="group" aria-label="Time range">
          {#each PERIODS as p}
            <button
              class="period-btn"
              class:period-btn--active={activePeriod === p.label}
              onclick={() => activePeriod = p.label}
              title={p.title}
              aria-pressed={activePeriod === p.label}
            >{p.label}</button>
          {/each}
        </div>
      </div>
      <HeatmapCalendar days={heatmap} weeks={heatmapWeeks} />
    </BentoCard>

    <!-- Pass-rate chart card -->
    <BentoCard title="Pass Rate" subtitle="Scenario pass rate per day" variant="default">
      {#if passRateTrend.labels.length > 0}
        <div class="chart-fill">
          <LineChart chartData={passRateTrend} showLegend={true} axisMode="mixed" />
        </div>
      {:else}
        <div class="chart-empty">No data yet</div>
      {/if}
    </BentoCard>
  </div>

  <!-- ── Filters bar ─────────────────────────────────────────────── -->
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

  <!-- ── Runs table ──────────────────────────────────────────────── -->
  {#if data.error}
    <AppAlert tone="error" title="Could not load executions">{data.error}</AppAlert>
  {:else if runs.length === 0}
    <EmptyState
      title="No executions yet"
      hint="Set up an API key and run your automation suite to see results here."
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </svelte:fragment>
    </EmptyState>
  {:else if filteredRuns.length === 0}
    <EmptyState
      title="No executions match the current filters"
      hint="Try adjusting your date range, status filter, or search term."
      minHeight="280px"
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
      </svelte:fragment>
      <div slot="actions">
        <button class="link-btn" onclick={clearFilters}>Clear filters</button>
      </div>
    </EmptyState>
  {:else}
    <div class="table-wrap">
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Status</th>
            <th class="th-sort" onclick={() => toggleSort('runnerId')}>Runner{sortIcon('runnerId')}</th>
            <th class="col-hide-sm">Branch</th>
            <th class="col-hide-md">Environment</th>
            <th class="col-hide-md">Framework</th>
            <th class="th-sort" onclick={() => toggleSort('startedAt')}>Started{sortIcon('startedAt')}</th>
            <th class="col-hide-sm th-sort" onclick={() => toggleSort('durationMs')}>Duration{sortIcon('durationMs')}</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each filteredRuns as run}
            <tr class="clickable-row" onclick={() => goto(`/projects/${data.projectKey}/executions/${run.id}`)}>
              <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
              <td class="mono">{run.runnerId}</td>
              <td class="col-hide-sm">{run.branch ?? '-'}</td>
              <td class="col-hide-md">{run.environment ?? '-'}</td>
              <td class="col-hide-md">{run.framework ?? '-'}</td>
              <td class="nowrap">{formatDate(run.startedAt)}</td>
              <td class="col-hide-sm nowrap">{duration(run.startedAt, run.finishedAt)}</td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    </div>
  {/if}

  <!-- ── Live events feed ────────────────────────────────────────── -->
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
    margin-bottom: 20px;
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
    margin-bottom: 24px;
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

  /* ── Charts grid ────────────────────────────────────── */
  .charts-grid {
    display: grid;
    grid-template-columns: 40fr 60fr;
    gap: 20px;
    margin-bottom: 28px;
  }

  @media (max-width: 860px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ── Shared card ────────────────────────────────────── */
  .card-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Period toggle ──────────────────────────────────── */
  .period-toggle {
    display: flex;
    gap: 2px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 2px;
    flex-shrink: 0;
  }

  .period-btn {
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 9px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .period-btn:hover:not(.period-btn--active) {
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
    color: var(--color-accent);
  }
  .period-btn--active {
    background: var(--color-accent);
    color: #fff;
  }

  /* ── Chart empty state ──────────────────────────────── */
  .chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .chart-fill {
    flex: 1;
    min-height: 140px;
    position: relative;
  }

  /* ── Sections ───────────────────────────────────────── */
  .section {
    margin-bottom: 24px;
  }
  .section--live {
    margin-top: 8px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 12px;
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
    margin-bottom: 24px;
  }

  /* ── Error / empty states ───────────────────────────── */
  :global(.page > .app-alert) { margin-bottom: 24px; }

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

    .event-item {
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    .event-type {
      grid-column: 1 / -1;
    }
  }
</style>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { wsManager } from '$lib/stores/websocket.svelte';
  import type { ExecutionEvent } from '$lib/api/realtime';
  import { listRuns } from '$lib/api/runs';
  import type { AutomationRun } from '$lib/api/runs';

  let { data }: {
    data: {
      projectKey: string;
      runs: AutomationRun[];
      nextCursor: string | null;
      error: string | null;
    }
  } = $props();

  let runs = $state<AutomationRun[]>([]);
  let liveEvents = $state<ExecutionEvent[]>([]);
  let refreshingRuns = false;

  $effect(() => {
    runs = data.runs;
  });

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
      // The live row remains visible until the next successful list fetch.
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
      if (!exists) {
        runs = [liveRunFromEvent(event), ...runs];
        void refreshRuns();
        return;
      }
      runs = runs.map(run => run.id === event.runId
        ? {
            ...run,
            status: event.status ?? run.status,
            totalScenarios: event.totalScenarios ?? run.totalScenarios,
            durationMs: event.durationMs ?? run.durationMs
          }
        : run);
      return;
    }

    if (event.type === 'RUN_FINISHED') {
      const exists = runs.some(r => r.id === event.runId);
      if (!exists) {
        runs = [liveRunFromEvent(event), ...runs];
        return;
      }
      runs = runs.map(run => run.id === event.runId
        ? {
            ...run,
            status: event.status ?? run.status,
            finishedAt: event.occurredAt,
            totalScenarios: event.totalScenarios ?? run.totalScenarios,
            durationMs: event.durationMs ?? run.durationMs
        }
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
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Executions</span>
  </nav>

  <div class="page-header">
    <h1 class="page-title">Executions</h1>
    <span
      class="socket-pill"
      class:socket-pill--live={wsManager.state === 'live'}
      class:socket-pill--reconnecting={wsManager.state === 'connecting'}
    >{wsManager.state}</span>
  </div>

  <!-- Filters bar -->
  <div class="filters-bar">
    <div class="filter-group">
      <label class="filter-label" for="filter-status">Status</label>
      <select id="filter-status" class="filter-select" disabled>
        <option>All</option>
        <option>RUNNING</option>
        <option>PASSED</option>
        <option>FAILED</option>
      </select>
    </div>
    <div class="filter-group">
      <label class="filter-label" for="filter-env">Environment</label>
      <select id="filter-env" class="filter-select" disabled>
        <option>All</option>
      </select>
    </div>
    <span class="filters-note">Filters coming soon</span>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load executions — {data.error}</div>
  {:else if runs.length === 0}
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <p>No automation runs found for {data.projectKey}.</p>
      <p class="empty-sub">Set up an API key and run your automation suite to see executions here.</p>
    </div>
  {:else}
    <DataTable>
      {#snippet head()}
        <tr>
          <th>Status</th>
          <th>Runner</th>
          <th>Branch</th>
          <th>Environment</th>
          <th>Framework</th>
          <th>Started</th>
          <th>Duration</th>
          <th></th>
        </tr>
      {/snippet}
      {#snippet body()}
        {#each runs as run}
          <tr>
            <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
            <td class="mono">{run.runnerId}</td>
            <td>{run.branch ?? '—'}</td>
            <td>{run.environment ?? '—'}</td>
            <td>{run.framework ?? '—'}</td>
            <td>{formatDate(run.startedAt)}</td>
            <td>{duration(run.startedAt, run.finishedAt)}</td>
            <td><a href="/projects/{data.projectKey}/executions/{run.id}" class="link">View →</a></td>
          </tr>
        {/each}
      {/snippet}
    </DataTable>
  {/if}

  {#if liveEvents.length > 0}
    <div class="live-panel">
      <h2 class="section-title">Live Updates</h2>
      <div class="event-feed">
        {#each liveEvents as event}
          <div class="event-item">
            <span class="event-type">{event.type}</span>
            <span>{event.message ?? event.status ?? event.runId}</span>
            <span class="event-time">{formatDate(event.occurredAt)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
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

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .page-title { font-size: 1.5rem; font-weight: 700; }

  .socket-pill {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 3px 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .socket-pill.socket-pill--live {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success), transparent 60%);
    background: color-mix(in srgb, var(--color-success), transparent 90%);
  }
  .socket-pill.socket-pill--reconnecting {
    color: var(--color-warning, #f59e0b);
    border-color: color-mix(in srgb, #f59e0b, transparent 60%);
    background: color-mix(in srgb, #f59e0b, transparent 90%);
  }

  .filters-bar {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding: 14px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .filter-group { display: flex; flex-direction: column; gap: 4px; }

  .filter-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .filter-select {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
    cursor: not-allowed;
    opacity: 0.6;
    min-width: 120px;
  }

  .filters-note {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
    align-self: center;
    padding-bottom: 2px;
  }

  .error-banner {
    background: color-mix(in srgb, var(--color-danger), transparent 90%);
    color: var(--color-danger);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%);
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
    margin-bottom: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--color-text-muted);
  }
  .empty-state p { margin: 8px 0 0; font-size: 0.875rem; }
  .empty-sub { font-size: 0.8rem !important; opacity: 0.7; }

  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .link { color: var(--color-accent); font-size: 0.8rem; font-weight: 500; }

  .live-panel { margin-top: 20px; }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .event-feed { display: grid; gap: 8px; }

  .event-item {
    display: grid;
    grid-template-columns: minmax(130px, auto) 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 9px 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 0.8rem;
  }

  .event-type {
    font-family: ui-monospace, monospace;
    color: var(--color-accent);
  }

  .event-time { color: var(--color-text-muted); font-size: 0.75rem; }
</style>

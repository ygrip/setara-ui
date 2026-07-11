<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import ReportExportMenu from '$lib/components/ReportExportMenu.svelte';
  import ScenarioResultDetail from '$lib/components/ScenarioResultDetail.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import AppProgress from '$lib/ui/feedback/AppProgress.svelte';
  import RunSessionTimeline from '$lib/ui/domain/RunSessionTimeline.svelte';
  import { wsManager } from '$lib/stores/websocket.svelte';
  import type { ExecutionEvent } from '$lib/api/realtime';
  import { listRunResults } from '$lib/api/runs';
  import type { AutomationRun, ScenarioRunResult } from '$lib/api/runs';
  import FailedExecutionIssueModal from '$lib/components/issues/FailedExecutionIssueModal.svelte';
  import TrackedIssuesTable from '$lib/components/issues/TrackedIssuesTable.svelte';

  let { data }: {
    data: {
      projectKey: string;
      runId: string;
      run: AutomationRun | null;
      results: ScenarioRunResult[];
      issuesEnabled: boolean;
      error: string | null;
    }
  } = $props();

  let run = $state<AutomationRun | null>(null);
  let results = $state<ScenarioRunResult[]>([]);
  let events = $state<ExecutionEvent[]>([]);
  let refreshingResults = false;
  let issueModalOpen = $state(false);
  let issuesRefreshToken = $state(0);
  let issueCreateMessage = $state('');

  // Detail panel state
  let selectedResult = $state<ScenarioRunResult | null>(null);

  $effect(() => {
    run = data.run;
    results = data.results;
  });

  // ── Status helpers ──────────────────────────────────────────────────────────

  function runStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED': return 'success';
      case 'FAILED': return 'danger';
      case 'RUNNING': return 'info';
      default: return 'neutral';
    }
  }

  function resultStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED':  return 'success';
      case 'FAILED':  return 'danger';
      case 'SKIPPED': return 'warning';
      case 'PENDING': return 'info';
      default:        return 'neutral';
    }
  }

  // ── Formatters ──────────────────────────────────────────────────────────────

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function duration(start: string, end: string | null): string {
    if (!end) return 'Running…';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function durationMs(ms: number | null): string {
    if (ms == null) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  // ── WebSocket event handler ─────────────────────────────────────────────────

  async function refreshResults() {
    if (refreshingResults) return;
    refreshingResults = true;
    try {
      results = await listRunResults(data.projectKey, data.runId);
      if (selectedResult) {
        selectedResult = results.find(r => r.id === selectedResult?.id) ?? selectedResult;
      }
    } catch {
      // Live placeholders still keep the page moving; persisted data remains authoritative.
    } finally {
      refreshingResults = false;
    }
  }

  function applyRunEvent(event: ExecutionEvent) {
    if (!run) return;
    run = {
      ...run,
      status: event.status ?? run.status,
      totalScenarios: event.totalScenarios ?? run.totalScenarios,
      durationMs: event.durationMs ?? run.durationMs,
      finishedAt: event.type === 'RUN_FINISHED' ? event.occurredAt : run.finishedAt
    };
  }

  function applyEvent(event: ExecutionEvent) {
    if (event.projectKey !== data.projectKey || event.runId !== data.runId) return;
    events = [event, ...events].slice(0, 8);

    if (event.type === 'RUN_STARTED' || event.type === 'RUN_DISCOVERED' || event.type === 'RUN_FINISH_ACCEPTED' || event.type === 'RUN_FINISHED') {
      applyRunEvent(event);
    }

    if (event.type === 'SCENARIO_RESULT_PROCESSED' && event.resultId) {
      const exists = results.some(r => r.id === event.resultId);
      if (!exists) {
        results = [{
          id: event.resultId,
          runId: event.runId,
          scenarioId: event.scenarioId,
          scenarioKey: null,
          sequenceNo: null,
          cucumberId: null,
          featureUri: null,
          featureName: null,
          scenarioName: event.message ?? 'Scenario result',
          scenarioLine: null,
          tags: null,
          status: event.status ?? 'UNKNOWN',
          startedAt: null,
          finishedAt: event.occurredAt,
          durationMs: null,
          exceptionType: null,
          exceptionMessage: null,
          stepsJson: null,
          failedStepIndex: null
        }, ...results];
      } else {
        // Update status in case it changed.
        results = results.map(r => r.id === event.resultId
          ? { ...r, status: event.status ?? r.status }
          : r);
      }
      // Refresh the detail panel if it is showing this result.
      if (selectedResult?.id === event.resultId) {
        selectedResult = results.find(r => r.id === event.resultId) ?? null;
      }
      void refreshResults();
    }
  }

  // ── Filter / sort state ─────────────────────────────────────────────────────

  let filterSearch = $state('');
  let filterStatus = $state('');
  let sortBy = $state<'sequenceNo' | 'name' | 'status' | 'duration'>('sequenceNo');
  let sortDir = $state<'asc' | 'desc'>('asc');

  function toggleSort(col: 'name' | 'status' | 'duration') {
    if (sortBy === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = col;
      sortDir = 'asc';
    }
  }

  const filteredResults = $derived.by(() => {
    let r = results;
    if (filterStatus) r = r.filter(x => x.status?.toUpperCase() === filterStatus);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      r = r.filter(x =>
        x.scenarioName?.toLowerCase().includes(q) ||
        x.featureName?.toLowerCase().includes(q)
      );
    }
    if (sortBy !== 'sequenceNo') {
      r = [...r].sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name')     cmp = (a.scenarioName ?? '').localeCompare(b.scenarioName ?? '');
        if (sortBy === 'status')   cmp = (a.status ?? '').localeCompare(b.status ?? '');
        if (sortBy === 'duration') cmp = (a.durationMs ?? 0) - (b.durationMs ?? 0);
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return r;
  });

  const STATUSES = ['PASSED', 'FAILED', 'SKIPPED', 'PENDING', 'UNKNOWN'] as const;

  function statusCount(s: string) { return results.filter(r => r.status?.toUpperCase() === s).length; }

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const totalScenarios = $derived(run?.totalScenarios ?? results.length);
  const passedScenarios = $derived(run?.passedScenarios ?? results.filter(r => r.status === 'PASSED').length);
  const failedScenarios = $derived(run?.failedScenarios ?? results.filter(r => r.status === 'FAILED').length);
  const skippedScenarios = $derived(run?.skippedScenarios ?? results.filter(r => r.status === 'SKIPPED').length);
  const passRate = $derived(totalScenarios ? Math.round((passedScenarios / totalScenarios) * 100) : 0);
  const shortRunId = $derived(data.runId.slice(0, 8));
  const reportPath = $derived(`/api/projects/${data.projectKey}/runs/${data.runId}/report`);
  const reportFilename = $derived(`setara-execution-${data.projectKey}-${data.runId}`);
  const isRunning = $derived(run?.status?.toUpperCase() === 'RUNNING');
  const failedScenarioResults = $derived(results.filter(result => result.status?.toUpperCase() === 'FAILED'));
  const canQuickCreateIssue = $derived(
    data.issuesEnabled && run?.status?.toUpperCase() === 'FAILED' && failedScenarioResults.length > 0
  );
  const runDonut = $derived({
    labels: ['Passed', 'Failed', 'Skipped'],
    datasets: [{
      data: [passedScenarios, failedScenarios, skippedScenarios],
      backgroundColor: ['#0d9488', '#dc2626', '#f59e0b'],
      borderWidth: 0
    }]
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  let unsub: (() => void) | null = null;

  onMount(() => {
    // Only connect WebSocket if the run is still active (RUNNING or IN_PROGRESS)
    const initialStatus = data.run?.status?.toUpperCase();
    if (initialStatus === 'RUNNING' || initialStatus === 'IN_PROGRESS') {
      wsManager.connect(data.projectKey, data.runId);
      unsub = wsManager.addHandler(applyEvent);
    }
  });

  onDestroy(() => {
    unsub?.();
    wsManager.disconnect();
  });
</script>

<svelte:head>
  <title>Run {shortRunId} — {data.projectKey} — Setara</title>
</svelte:head>

<!-- Scenario result detail panel (slide-in from right) -->
<ScenarioResultDetail
  result={selectedResult}
  projectKey={data.projectKey}
  onclose={() => (selectedResult = null)}
/>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/executions">Executions</a>
    <span class="sep">›</span>
    <span class="mono">{shortRunId}</span>
  </nav>

  {#if data.error}
    <AppAlert tone="error" title="Could not load run">{data.error}</AppAlert>
  {:else if run}

    <!-- Header -->
    <div class="run-header">
      <div class="run-header-top">
        <Badge text={run.status} variant={runStatusVariant(run.status)} />
        <span class="run-id mono">#{shortRunId}</span>
        <span class="run-runner">{run.runnerId}</span>
        <span
          class="socket-pill"
          class:socket-pill--live={wsManager.state === 'live'}
          class:socket-pill--reconnecting={wsManager.state === 'connecting'}
        >{wsManager.state}</span>
      </div>
      <div class="export-actions">
        <ReportExportMenu reportPath={reportPath} filenameBase={reportFilename} />
      </div>
    </div>

    <!-- Metric cards -->
    <div class="metrics-row">
      <MetricCard label="Total Scenarios" value={totalScenarios} sub={wsManager.state === 'live' ? 'live updates connected' : 'from latest snapshot'} variant="default" />
      <MetricCard label="Passed"  value={passedScenarios}  variant="success" />
      <MetricCard label="Failed"  value={failedScenarios}  variant="danger" />
      <MetricCard label="Skipped" value={skippedScenarios} variant="warning" />
    </div>

    <div class="section">
      <div class="panel visual-panel">
        <div class="visual-text">
          <h2 class="section-title">Result Composition</h2>
          <p class="visual-desc">{passedScenarios} passed · {failedScenarios} failed · {skippedScenarios} skipped</p>
          <p class="visual-desc">Pass rate: <strong>{passRate}%</strong></p>
        </div>
        <div class="chart-layout">
          <DonutChart chartData={runDonut} size={460} />
          <div class="chart-legend" aria-label="Execution result legend">
            <span><i class="dot passed"></i>Passed <strong>{passedScenarios}</strong></span>
            <span><i class="dot failed"></i>Failed <strong>{failedScenarios}</strong></span>
            <span><i class="dot skipped"></i>Skipped <strong>{skippedScenarios}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress -->
    <div class="section">
      <h2 class="section-title">Progress</h2>
      <div class="progress-row">
        <AppProgress value={passRate} max={100} label="Pass rate" tone={failedScenarios > 0 ? 'warning' : 'success'} showValue />
        <span class="duration-chip">{duration(run.startedAt, run.finishedAt)}</span>
      </div>
    </div>

    <!-- Run metadata -->
    <div class="section">
      <h2 class="section-title">Run Details</h2>
      <div class="panel">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Environment</span>
            <span class="meta-value">{run.environment ?? '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Branch</span>
            <span class="meta-value">{run.branch ?? '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Commit SHA</span>
            <span class="meta-value mono">{run.commitSha ? run.commitSha.slice(0, 8) : '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Framework</span>
            <span class="meta-value">{run.framework ?? '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Job</span>
            <span class="meta-value">{run.jobName ?? '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Build</span>
            {#if run.buildId}
              <a class="meta-value link" href="/projects/{data.projectKey}/builds/{run.buildId}">
                {run.buildName ?? run.buildKey ?? run.buildId}
              </a>
            {:else}
              <span class="meta-value">Unassigned</span>
            {/if}
          </div>
          <div class="meta-item">
            <span class="meta-label">Started At</span>
            <span class="meta-value">{formatDate(run.startedAt)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Finished At</span>
            <span class="meta-value">{formatDate(run.finishedAt)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Duration</span>
            <span class="meta-value">{duration(run.startedAt, run.finishedAt)}</span>
          </div>
        </div>
      </div>
    </div>

    {#if data.issuesEnabled}
      <div class="section">
        <TrackedIssuesTable
          context="execution"
          projectKey={data.projectKey}
          executionId={data.runId}
          enabled={data.issuesEnabled}
          refreshToken={issuesRefreshToken}
          quickCreate={canQuickCreateIssue ? () => (issueModalOpen = true) : undefined}
          notice={issueCreateMessage}
        />
      </div>
    {/if}

    <!-- Live indicator + event feed -->
    {#if isRunning || events.length > 0}
      <div class="section">
        <div class="panel">
          <div class="live-section">
            {#if isRunning}
              <div class="live-indicator">
                <span class="live-dot"></span>
                <span class="live-label">Execution in progress · {wsManager.state}</span>
              </div>
            {:else}
              <div class="complete-indicator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Complete</span>
              </div>
            {/if}
            <p class="live-note">
              Scenario results update as the execution worker processes queued automation events.
            </p>
            {#if events.length > 0}
              <RunSessionTimeline {events} />
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Scenario results table -->
    <div class="section">
      <div class="results-header">
        <h2 class="section-title">Scenario Results</h2>
        {#if results.length > 0}
          <span class="results-hint">Click a row for detail</span>
        {/if}
      </div>

      {#if results.length > 0}
        <!-- Filter controls -->
        <div class="filter-bar">
          <div class="filter-search-wrap">
            <svg class="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              class="filter-search-input"
              type="search"
              placeholder="Search by name or feature…"
              bind:value={filterSearch}
              aria-label="Search scenarios"
            />
            {#if filterSearch}
              <button class="filter-search-clear" onclick={() => filterSearch = ''} aria-label="Clear search">×</button>
            {/if}
          </div>

          <div class="status-tabs" role="group" aria-label="Filter by status">
            <button
              class="status-tab"
              class:active={filterStatus === ''}
              onclick={() => filterStatus = ''}
            >All <span class="tab-count">{results.length}</span></button>
            {#each STATUSES as s}
              {@const count = statusCount(s)}
              {#if count > 0}
                <button
                  class="status-tab status-tab--{s.toLowerCase()}"
                  class:active={filterStatus === s}
                  onclick={() => filterStatus = filterStatus === s ? '' : s}
                >{s[0] + s.slice(1).toLowerCase()} <span class="tab-count">{count}</span></button>
              {/if}
            {/each}
          </div>

          {#if filteredResults.length !== results.length}
            <span class="filter-count">{filteredResults.length} of {results.length}</span>
          {/if}
        </div>
      {/if}

      <DataTable>
        {#snippet head()}
          <tr>
            <th>
              <button class="sort-btn" onclick={() => toggleSort('name')}>
                Scenario
                {#if sortBy === 'name'}<span class="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="sort-arrow sort-arrow--idle">↕</span>{/if}
              </button>
            </th>
            <th>
              <button class="sort-btn" onclick={() => toggleSort('status')}>
                Status
                {#if sortBy === 'status'}<span class="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="sort-arrow sort-arrow--idle">↕</span>{/if}
              </button>
            </th>
            <th>
              <button class="sort-btn" onclick={() => toggleSort('duration')}>
                Duration
                {#if sortBy === 'duration'}<span class="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="sort-arrow sort-arrow--idle">↕</span>{/if}
              </button>
            </th>
            <th>Exception</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#if results.length === 0}
            <tr>
              <td colspan="4" class="placeholder-row">
                Scenarios will appear here once the execution worker processes results.
              </td>
            </tr>
          {:else if filteredResults.length === 0}
            <tr>
              <td colspan="4" class="placeholder-row">
                No scenarios match the current filters.
              </td>
            </tr>
          {:else}
            {#each filteredResults as result}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <tr
                class="result-row"
                class:result-row--selected={selectedResult?.id === result.id}
                class:result-row--failed={result.status?.toUpperCase() === 'FAILED'}
                tabindex="0"
                role="button"
                aria-pressed={selectedResult?.id === result.id}
                onclick={() => selectedResult = selectedResult?.id === result.id ? null : result}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedResult = selectedResult?.id === result.id ? null : result; } }}
              >
                <td>
                  <strong class="scenario-name">{result.scenarioName}</strong>
                  {#if result.featureName}<span class="muted-line">{result.featureName}</span>{/if}
                  {#if result.tags && result.tags.length > 0}
                    <span class="tags-inline">
                      {#each result.tags.slice(0, 3) as tag}
                        <span class="tag-mini">@{tag}</span>
                      {/each}
                      {#if result.tags.length > 3}
                        <span class="tag-more">+{result.tags.length - 3}</span>
                      {/if}
                    </span>
                  {/if}
                </td>
                <td><Badge text={result.status} variant={resultStatusVariant(result.status)} /></td>
                <td class="mono-cell">{durationMs(result.durationMs)}</td>
                <td class="exception-cell">
                  {#if result.exceptionType || result.exceptionMessage}
                    <span class="exception-snippet" title={result.exceptionMessage ?? ''}>
                      {result.exceptionType ?? 'Error'}
                    </span>
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        {/snippet}
      </DataTable>
    </div>
  {/if}
</div>

{#if run && canQuickCreateIssue}
  <FailedExecutionIssueModal
    open={issueModalOpen}
    projectKey={data.projectKey}
    executionId={data.runId}
    {run}
    failedResults={failedScenarioResults}
    onclose={() => (issueModalOpen = false)}
    oncreated={(response) => {
      issuesRefreshToken += 1;
      issueCreateMessage = `Created tracked issue ${response.created.map(issue => issue.issueKey).join(', ')}.`;
    }}
  />
{/if}

<style>
  .page { max-width: min(100%); }

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
  .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }

  :global(.page > .app-alert) { margin-bottom: 20px; }

  /* ── Run header ────────────────────────────────────────────── */
  .run-header {
    margin-bottom: 24px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .run-header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .export-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

  .run-id    { color: var(--color-text-muted); font-size: 0.875rem; }
  .run-runner {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
  }

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
    color: #f59e0b;
    border-color: color-mix(in srgb, #f59e0b, transparent 60%);
    background: color-mix(in srgb, #f59e0b, transparent 90%);
  }

  /* ── Metrics ───────────────────────────────────────────────── */
  .metrics-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }

  /* ── Sections ──────────────────────────────────────────────── */
  .section { margin-bottom: 28px; }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }

  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .visual-panel {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(480px, auto);
    align-items: center;
    gap: 32px;
  }

  .visual-text { flex: 1; min-width: 160px; }

  .chart-layout {
    display: grid;
    grid-template-columns: auto minmax(160px, 220px);
    align-items: center;
    justify-content: end;
    gap: 24px;
  }

  .chart-legend {
    display: grid;
    gap: 10px;
  }

  .chart-legend span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--color-text-muted);
    font-size: 0.84rem;
  }

  .chart-legend strong { color: var(--color-text); }
  .dot { width: 10px; height: 10px; border-radius: 999px; flex: 0 0 auto; }
  .dot.passed { background: #0d9488; }
  .dot.failed { background: #dc2626; }
  .dot.skipped { background: #f59e0b; }

  .visual-desc {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .visual-desc strong { color: var(--color-text); }

  /* ── Run meta grid ─────────────────────────────────────────── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
  }

  .meta-item { display: flex; flex-direction: column; gap: 2px; }

  .meta-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .meta-value {
    font-size: 0.875rem;
    color: var(--color-text);
    font-weight: 500;
  }

  /* ── Progress ──────────────────────────────────────────────── */
  .progress-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .progress-row :global(.app-progress) {
    flex: 1;
  }

  .duration-chip {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
    background: var(--color-accent-subtle);
    padding: 3px 10px;
    border-radius: 12px;
  }

  /* ── Live section ──────────────────────────────────────────── */
  .live-section { display: flex; flex-direction: column; gap: 10px; }

  .live-indicator { display: flex; align-items: center; gap: 8px; }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  .live-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-success);
  }

  .complete-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .live-note {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .live-section :global(.app-timeline) { margin-top: 4px; }


  /* ── Filter bar ────────────────────────────────────────────── */
  .filter-bar {
    display: flex; flex-wrap: wrap; align-items: center;
    gap: 10px; margin-bottom: 12px;
  }
  .filter-search-wrap {
    position: relative; display: flex; align-items: center;
    flex: 1; min-width: 180px; max-width: 280px;
  }
  .filter-search-icon {
    position: absolute; left: 10px; color: var(--color-text-muted); pointer-events: none;
  }
  .filter-search-input {
    width: 100%; padding: 6px 28px 6px 32px;
    border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-surface); color: var(--color-text);
    font: inherit; font-size: 0.82rem; outline: none;
    transition: border-color 0.15s;
  }
  .filter-search-input:focus { border-color: var(--color-accent); }
  .filter-search-clear {
    position: absolute; right: 8px; border: none; background: transparent;
    color: var(--color-text-muted); cursor: pointer; font-size: 1rem; padding: 0;
    line-height: 1; display: flex; align-items: center;
  }
  .filter-search-clear:hover { color: var(--color-text); }

  .status-tabs {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .status-tab {
    padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
    border: 1px solid var(--color-border); background: var(--color-surface);
    color: var(--color-text-muted); cursor: pointer; transition: all 0.12s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .status-tab:hover { border-color: var(--color-accent); color: var(--color-text); }
  .status-tab.active {
    background: var(--color-accent); border-color: var(--color-accent); color: #fff;
  }
  .status-tab--passed.active  { background: var(--color-success, #16a34a); border-color: var(--color-success, #16a34a); }
  .status-tab--failed.active  { background: var(--color-danger,  #dc2626); border-color: var(--color-danger,  #dc2626); }
  .status-tab--skipped.active { background: var(--color-warning, #d97706); border-color: var(--color-warning, #d97706); }
  .tab-count {
    background: rgba(255,255,255,0.25); border-radius: 10px;
    padding: 0 5px; font-size: 0.68rem;
  }
  .status-tab:not(.active) .tab-count {
    background: var(--color-bg); color: var(--color-text-muted);
  }
  .filter-count {
    font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap;
  }

  .sort-btn {
    background: none; border: none; cursor: pointer;
    color: inherit; font: inherit; font-weight: 600; font-size: 0.82rem;
    padding: 0; display: inline-flex; align-items: center; gap: 4px;
    white-space: nowrap;
  }
  .sort-btn:hover { color: var(--color-accent); }
  .sort-arrow { font-size: 0.7rem; }
  .sort-arrow--idle { opacity: 0.3; }

  /* ── Results table ─────────────────────────────────────────── */
  .results-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 14px;
  }

  .results-header .section-title { margin-bottom: 0; }

  .results-hint {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .result-row {
    cursor: pointer;
    transition: background 0.12s;
  }

  .result-row:hover { background: var(--color-accent-subtle) !important; }

  .result-row:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .result-row--selected { background: color-mix(in srgb, var(--color-accent), transparent 88%) !important; }

  .result-row--failed td:first-child { border-left: 3px solid var(--color-danger); }

  .scenario-name {
    display: block;
    font-size: 0.83rem;
    font-weight: 600;
  }

  .muted-line,
  .muted {
    display: block;
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .tags-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }

  .tag-mini {
    font-size: 0.68rem;
    font-family: ui-monospace, monospace;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 72%);
    border-radius: 3px;
    padding: 1px 5px;
  }

  .tag-more {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    padding: 1px 4px;
  }

  .mono-cell {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .exception-cell { max-width: 200px; }

  .exception-snippet {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger), transparent 90%);
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    max-width: 180px;
  }

  .placeholder-row {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    padding: 32px !important;
    font-style: italic;
  }

  @media (max-width: 800px) {
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 820px) {
    .visual-panel,
    .chart-layout {
      grid-template-columns: 1fr;
      justify-items: start;
    }
  }
</style>

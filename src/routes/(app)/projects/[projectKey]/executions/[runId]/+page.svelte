<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

  let { data } = $props();

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
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function duration(start: string, end: string | null): string {
    if (!end) return 'Running…';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const shortRunId = $derived(data.runId.slice(0, 8));
  const isRunning = $derived(data.run?.status?.toUpperCase() === 'RUNNING');
</script>

<svelte:head>
  <title>Run {shortRunId} — {data.projectKey} — Setara</title>
</svelte:head>

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
    <div class="error-banner">Could not load run — {data.error}</div>
  {:else if data.run}
    {@const run = data.run}

    <!-- Header -->
    <div class="run-header">
      <div class="run-header-top">
        <Badge text={run.status} variant={runStatusVariant(run.status)} />
        <span class="run-id mono">#{shortRunId}</span>
        <span class="run-runner">{run.runnerId}</span>
      </div>
    </div>

    <!-- Metric cards -->
    <div class="metrics-row">
      <MetricCard label="Total Scenarios" value="—" sub="pending worker" variant="default" />
      <MetricCard label="Passed" value="—" variant="success" />
      <MetricCard label="Failed" value="—" variant="danger" />
      <MetricCard label="Skipped" value="—" variant="warning" />
    </div>

    <!-- Progress -->
    <div class="section">
      <h2 class="section-title">Progress</h2>
      <div class="progress-row">
        <div class="progress-bar-wrap" aria-label="Pass rate">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <span class="progress-label">0% pass rate</span>
        </div>
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

    <!-- Live indicator -->
    <div class="section">
      <div class="panel">
        <div class="live-section">
          {#if isRunning}
            <div class="live-indicator">
              <span class="live-dot"></span>
              <span class="live-label">Execution in progress</span>
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
            Scenario results will populate here as the execution worker processes events from the NATS stream.
          </p>
        </div>
      </div>
    </div>

    <!-- Scenario results placeholder -->
    <div class="section">
      <h2 class="section-title">Scenario Results</h2>
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Scenario</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Error</th>
          </tr>
        {/snippet}
        {#snippet body()}
          <tr>
            <td colspan="4" class="placeholder-row">
              Scenarios will appear here once the execution worker is implemented.
            </td>
          </tr>
        {/snippet}
      </DataTable>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1000px; }

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

  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
    margin-bottom: 20px;
  }

  .run-header {
    margin-bottom: 24px;
  }

  .run-header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .run-id {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .run-runner {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }

  .section {
    margin-bottom: 28px;
  }

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

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

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

  .progress-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    max-width: 400px;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-success);
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  .progress-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .duration-chip {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
    background: var(--color-accent-subtle);
    padding: 3px 10px;
    border-radius: 12px;
  }

  .live-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
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

  .placeholder-row {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    padding: 32px !important;
    font-style: italic;
  }
</style>

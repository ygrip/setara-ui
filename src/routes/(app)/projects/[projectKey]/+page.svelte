<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import QualityGateBadge from '$lib/components/QualityGateBadge.svelte';
  import { type ApiKey } from '$lib/api/apikeys';

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

  const activeApiKeys = $derived(data.apiKeys.filter((k: ApiKey) => !k.revokedAt).length);
  const recentRuns = $derived(data.runs.slice(0, 5));
  const lastRunStatus = $derived(data.runs[0]?.status ?? 'No runs');
  const lastRunVariant = $derived(runStatusVariant(lastRunStatus));
</script>

<svelte:head>
  <title>{data.project?.name ?? data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <!-- Breadcrumb -->
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <span>{data.projectKey}</span>
  </nav>

  {#if data.error}
    <div class="error-banner">Could not load project — {data.error}</div>
  {:else if data.project}
    <!-- Project header -->
    <div class="project-header">
      <div class="header-top">
        <h1 class="project-name">{data.project.name}</h1>
        <Badge text={data.project.projectKey} variant="neutral" />
      </div>
      {#if data.project.description}
        <p class="project-desc">{data.project.description}</p>
      {/if}
    </div>

    <!-- Metric cards -->
    <div class="metrics-row">
      <MetricCard
        label="Total Runs"
        value={data.runs.length}
        variant="info"
        icon="M22 12h-4l-3 9L9 3l-3 9H2"
      />
      <MetricCard
        label="Active API Keys"
        value={activeApiKeys}
        variant="default"
        icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
      <div class="last-run-card">
        <span class="last-run-label">Last Run Status</span>
        {#if data.runs.length > 0}
          <Badge text={lastRunStatus} variant={lastRunVariant} />
        {:else}
          <span class="no-runs">No runs yet</span>
        {/if}
      </div>
      <MetricCard
        label="Scenarios"
        value="—"
        sub="coming soon"
        variant="default"
        icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </div>

    <!-- Quality Gate -->
    <div class="section">
      <div class="panel">
        <h2 class="panel-title">Quality Gate</h2>
        <QualityGateBadge status="UNKNOWN" size="md" />
        <p class="qg-note">Run tests and configure a release plan to see your quality gate.</p>
      </div>
    </div>

    <!-- Recent Runs -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Recent Runs</h2>
        <a href="/projects/{data.projectKey}/executions" class="section-link">View all →</a>
      </div>
      {#if recentRuns.length === 0}
        <p class="empty-text">No automation runs yet. <a href="/projects/{data.projectKey}/settings/api-keys">Set up an API key</a> to start ingesting results.</p>
      {:else}
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Status</th>
              <th>Runner</th>
              <th>Branch</th>
              <th>Started</th>
              <th>Duration</th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each recentRuns as run}
              <tr>
                <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
                <td class="mono">{run.runnerId}</td>
                <td>{run.branch ?? '—'}</td>
                <td>{formatDate(run.startedAt)}</td>
                <td>{duration(run.startedAt, run.finishedAt)}</td>
                <td><a href="/projects/{data.projectKey}/executions/{run.id}" class="link">View →</a></td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </div>

    <!-- Quick links -->
    <div class="section">
      <h2 class="section-title">Quick Links</h2>
      <div class="quick-links">
        <a href="/projects/{data.projectKey}/repository" class="quick-link-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/>
          </svg>
          <span class="ql-label">Test Repository</span>
          <span class="ql-arrow">→</span>
        </a>
        <a href="/projects/{data.projectKey}/release-plans" class="quick-link-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span class="ql-label">Release Plans</span>
          <span class="ql-arrow">→</span>
        </a>
        <a href="/projects/{data.projectKey}/coverage" class="quick-link-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <span class="ql-label">Coverage</span>
          <span class="ql-arrow">→</span>
        </a>
        <a href="/projects/{data.projectKey}/settings" class="quick-link-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <span class="ql-label">Settings</span>
          <span class="ql-arrow">→</span>
        </a>
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

  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
    margin-bottom: 20px;
  }

  .project-header {
    margin-bottom: 24px;
  }

  .header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .project-name {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .project-desc {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }

  .last-run-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .last-run-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  .no-runs {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .section {
    margin-bottom: 28px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 14px;
  }

  .section-header .section-title {
    margin: 0;
  }

  .section-link {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-accent);
  }

  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 14px;
  }

  .qg-note {
    margin: 12px 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .empty-text {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    padding: 16px 0;
  }

  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }

  .link {
    color: var(--color-accent);
    font-size: 0.8rem;
    font-weight: 500;
  }

  .quick-links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .quick-link-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--color-text);
    font-weight: 500;
    font-size: 0.875rem;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .quick-link-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow);
    text-decoration: none;
    color: var(--color-accent);
  }

  .quick-link-card svg {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .quick-link-card:hover svg {
    color: var(--color-accent);
  }

  .ql-label {
    flex: 1;
  }

  .ql-arrow {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
</style>

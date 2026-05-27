<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { type ApiKey } from '$lib/api/apikeys';

  let copiedField = $state<string | null>(null);

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedField = field;
      setTimeout(() => { copiedField = null; }, 1500);
    } catch {
      // fallback: ignore
    }
  }

  function buildStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'VERIFIED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'INITIATED': return 'warning';
      default: return 'neutral';
    }
  }

  function planStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'CLOSED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'OPEN': return 'warning';
      default: return 'neutral';
    }
  }

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
  const automationDonut = $derived({
    labels: ['Automated', 'Remaining'],
    datasets: [{
      data: [
        data.statistic?.totalAutomated ?? 0,
        Math.max((data.statistic?.totalAutomatable ?? data.statistic?.totalScenarios ?? 0) - (data.statistic?.totalAutomated ?? 0), 0)
      ],
      backgroundColor: ['#0f766e', '#d1d5db'],
      borderWidth: 0
    }]
  });
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
      <div>
        <div class="header-top">
          <h1 class="project-name">{data.project.name}</h1>
          <Badge text={data.project.projectKey} variant="neutral" />
        </div>
        {#if data.project.description}
          <p class="project-desc">{data.project.description}</p>
        {/if}
      </div>
      <a href="/projects/{data.projectKey}/settings" class="settings-entry">Project Settings</a>
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
        value={data.statistic?.totalScenarios ?? 0}
        sub={`${data.statistic?.totalAutomated ?? 0} automated`}
        variant="default"
        icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
      <MetricCard
        label="Total Builds"
        value={data.builds.length}
        variant="default"
        icon="M4 7l8-4 8 4-8 4-8-4z M4 12l8 4 8-4 M4 17l8 4 8-4"
      />
    </div>

    <!-- Latest Build & Plan info -->
    {#if data.latestBuild || data.latestPlan}
    <div class="latest-row">
      {#if data.latestBuild}
      <a href="/projects/{data.projectKey}/builds/{data.latestBuild.id}" class="latest-card">
        <div class="latest-card-header">
          <span class="latest-label">Latest Build</span>
          <Badge text={data.latestBuild.status} variant={buildStatusVariant(data.latestBuild.status)} />
        </div>
        <div class="latest-card-name">{data.latestBuild.name}</div>
        <div class="latest-card-meta">
          <span class="mono-chip">
            {data.latestBuild.buildKey}
            <button class="copy-btn" onclick={(e) => { e.preventDefault(); copyToClipboard(data.latestBuild!.buildKey, 'buildKey'); }} title="Copy build key">
              {copiedField === 'buildKey' ? '✓' : '⧉'}
            </button>
          </span>
          {#if data.latestBuild.version}
          <span class="mono-chip">
            {data.latestBuild.version}
            <button class="copy-btn" onclick={(e) => { e.preventDefault(); copyToClipboard(data.latestBuild!.version!, 'version'); }} title="Copy version">
              {copiedField === 'version' ? '✓' : '⧉'}
            </button>
          </span>
          {/if}
        </div>
      </a>
      {/if}

      {#if data.latestPlan}
      <a href="/squads/{data.latestPlan.squadId}/release-plans/{data.latestPlan.id}" class="latest-card">
        <div class="latest-card-header">
          <span class="latest-label">Latest Plan</span>
          <Badge text={data.latestPlan.status} variant={planStatusVariant(data.latestPlan.status)} />
        </div>
        <div class="latest-card-name">{data.latestPlan.name}</div>
        {#if data.latestPlan.releaseVersion}
        <div class="latest-card-meta">
          <span class="mono-chip">{data.latestPlan.releaseVersion}</span>
        </div>
        {/if}
      </a>
      {/if}
    </div>
    {/if}

    <div class="section">
      <div class="panel visual-panel">
        <div class="coverage-copy">
          <h2 class="panel-title">Automation Coverage</h2>
          <p class="qg-note">
            {Number(data.statistic?.coveragePercentage ?? 0).toFixed(0)}% covered within this project.
          </p>
          <div class="coverage-breakdown">
            <span><strong>{data.statistic?.totalAutomated ?? 0}</strong> automated</span>
            <span><strong>{data.statistic?.totalAutomatable ?? 0}</strong> automatable</span>
            <span><strong>{data.statistic?.totalScenarios ?? 0}</strong> live scenarios</span>
          </div>
        </div>
        <div class="chart-layout">
          <DonutChart chartData={automationDonut} size={460} />
          <div class="chart-legend" aria-label="Automation coverage legend">
            <span><i class="dot automated"></i>Automated <strong>{data.statistic?.totalAutomated ?? 0}</strong></span>
            <span><i class="dot remaining"></i>Remaining <strong>{Math.max((data.statistic?.totalAutomatable ?? data.statistic?.totalScenarios ?? 0) - (data.statistic?.totalAutomated ?? 0), 0)}</strong></span>
          </div>
        </div>
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
        <a href="/projects/{data.projectKey}/builds" class="quick-link-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>
          </svg>
          <span class="ql-label">Builds</span>
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
  .page { max-width: min(1520px, 100%); }

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

  .project-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }

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

  .settings-entry {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 8px 14px;
    border: 1px solid var(--color-accent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
    color: var(--color-accent);
    font-size: 0.82rem;
    font-weight: 800;
    text-decoration: none;
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }

  .metric-link {
    color: inherit;
    text-decoration: none;
    display: block;
    min-width: 0;
  }

  .metric-link:hover {
    text-decoration: none;
    filter: brightness(1.04);
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

  .visual-panel {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(480px, auto);
    align-items: center;
    gap: 28px;
  }

  .chart-layout {
    display: grid;
    grid-template-columns: auto minmax(170px, 240px);
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
  .dot.automated { background: #0f766e; }
  .dot.remaining { background: #d1d5db; }

  .coverage-copy { min-width: 0; }
  .coverage-breakdown { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .coverage-breakdown span { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; color: var(--color-text-muted); font-size: 0.82rem; }
  .coverage-breakdown strong { color: var(--color-text); }

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

  .latest-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }

  .latest-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .latest-card:hover { border-color: var(--color-accent); box-shadow: var(--shadow); text-decoration: none; }

  .latest-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .latest-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; color: var(--color-text-muted); }
  .latest-card-name { font-size: 0.925rem; font-weight: 600; color: var(--color-text); }
  .latest-card-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .mono-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-family: var(--font-mono, monospace); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 2px 6px; color: var(--color-text-muted); }
  .copy-btn { display: inline-flex; align-items: center; background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 0.7rem; padding: 0; }

  @media (max-width: 800px) {
    .visual-panel { grid-template-columns: 1fr; gap: 16px; }
    .chart-layout { grid-template-columns: 1fr; justify-content: center; }
    .chart-layout > :first-child { margin: 0 auto; max-width: 320px; }
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
    .latest-row { grid-template-columns: 1fr; }
    .quick-links { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
    .quick-links { grid-template-columns: 1fr; }
    .project-header { flex-direction: column; }
  }

  .latest-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .latest-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .latest-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .latest-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; color: var(--color-text-muted); }
  .latest-card-name { font-size: 0.95rem; font-weight: 700; color: var(--color-text); }
  .latest-card-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .mono-chip { display: inline-flex; align-items: center; gap: 4px; font-family: ui-monospace, monospace; font-size: 0.78rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 2px 8px; }
  .copy-btn { border: 0; background: transparent; cursor: pointer; font-size: 0.78rem; color: var(--color-text-muted); padding: 0 2px; }
  .copy-btn:hover { color: var(--color-accent); }
  .latest-link { font-size: 0.8rem; font-weight: 600; color: var(--color-accent); text-decoration: none; margin-top: 4px; }

  @media (max-width: 760px) {
    .metrics-row { grid-template-columns: 1fr; }
    .visual-panel,
    .chart-layout {
      grid-template-columns: 1fr;
      justify-items: start;
    }
  }
</style>

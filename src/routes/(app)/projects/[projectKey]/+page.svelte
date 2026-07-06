<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import ActionCard from '$lib/components/ActionCard.svelte';
  import StatusCard from '$lib/components/StatusCard.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import { type ApiKey } from '$lib/api/apikeys';

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
    <AppAlert tone="error" title="Could not load project">{data.error}</AppAlert>
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
      <Button variant="secondary" href="/projects/{data.projectKey}/settings">Project Settings</Button>
    </div>

    <!-- Metric cards -->
    <div class="metrics-row">
      <MetricCard
        label="Total Runs"
        value={data.runs.length}
        variant="info"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-info), transparent 86%)", color: "var(--color-info)" }}
      />
      <MetricCard
        label="Active API Keys"
        value={activeApiKeys}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-warning), transparent 86%)", color: "var(--color-warning)" }}
      />
      <StatusCard
        label="Last Run Status"
        status={data.runs.length > 0 ? lastRunStatus : 'No runs yet'}
        variant={data.runs.length > 0 ? lastRunVariant : 'neutral'}
        detail={data.runs.length > 0 ? 'Latest automation session' : 'Waiting for first automation result'}
      />
      <MetricCard
        label="Scenarios"
        value={data.statistic?.totalScenarios ?? 0}
        sub={`${data.statistic?.totalAutomated ?? 0} automated`}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
      />
      <MetricCard
        label="Total Builds"
        value={data.builds.length}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l8-4 8 4-8 4-8-4z M4 12l8 4 8-4 M4 17l8 4 8-4"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
      />
    </div>

    <!-- Latest Build & Plan -->
    {#if data.latestBuild || data.latestPlan}
    <div class="latest-row">
      {#if data.latestBuild}
      <a class="latest-card surface-card" href="/projects/{data.projectKey}/builds/{data.latestBuild.id}" aria-label="Open latest build {data.latestBuild.name}">
        <div class="latest-card-top">
          <span class="latest-card-label">Latest Build</span>
          <Badge text={data.latestBuild.status} variant={buildStatusVariant(data.latestBuild.status)} />
        </div>
        <span class="latest-card-name">{data.latestBuild.name}</span>
        {#if data.latestBuild.version}
          <span class="latest-card-meta">v{data.latestBuild.version}</span>
        {/if}
      </a>
      {/if}
      {#if data.latestPlan}
      <a class="latest-card surface-card" href="/squads/{data.latestPlan.squadId}/release-plans/{data.latestPlan.id}" aria-label="Open latest plan {data.latestPlan.name}">
        <div class="latest-card-top">
          <span class="latest-card-label">Latest Plan</span>
          <Badge text={data.latestPlan.status.replace('_', ' ')} variant={planStatusVariant(data.latestPlan.status)} />
        </div>
        <span class="latest-card-name">{data.latestPlan.name}</span>
        {#if data.latestPlan.releaseVersion}
          <span class="latest-card-meta">{data.latestPlan.releaseVersion}</span>
        {/if}
        {#if data.latestPlan.squadName}
          <span class="latest-card-squad">{data.latestPlan.squadName}</span>
        {/if}
      </a>
      {/if}
    </div>
    {/if}

    <div class="section">
    <BentoCard title="Automation Coverage" subtitle="{Number(data.statistic?.coveragePercentage ?? 0).toFixed(0)}% covered within this project" variant="default">
      <div class="coverage-layout">
        <div class="chart-layout">
          <DonutChart chartData={automationDonut} size={400} />
          <div class="chart-legend" aria-label="Automation coverage legend">
            <span><i class="dot automated"></i>Automated <strong>{data.statistic?.totalAutomated ?? 0}</strong></span>
            <span><i class="dot remaining"></i>Remaining <strong>{Math.max((data.statistic?.totalAutomatable ?? data.statistic?.totalScenarios ?? 0) - (data.statistic?.totalAutomated ?? 0), 0)}</strong></span>
          </div>
        </div>
        <div class="coverage-breakdown">
          <span><strong>{data.statistic?.totalAutomated ?? 0}</strong> automated</span>
          <span><strong>{data.statistic?.totalAutomatable ?? 0}</strong> automatable</span>
          <span><strong>{data.statistic?.totalScenarios ?? 0}</strong> live scenarios</span>
        </div>
      </div>
    </BentoCard>
    </div>

    <!-- Quick links -->
    <div class="section">
      <h2 class="section-title">Quick Links</h2>
      <div class="quick-links">
        <ActionCard title="Test Repository" href="/projects/{data.projectKey}/repository" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/></svg>' />
        <ActionCard title="Executions" href="/projects/{data.projectKey}/executions" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>' />
        <ActionCard title="Release Plans" href="/projects/{data.projectKey}/release-plans" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' />
        <ActionCard title="Builds" href="/projects/{data.projectKey}/builds" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/></svg>' />
        <ActionCard title="Coverage" href="/projects/{data.projectKey}/coverage" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' />
        <ActionCard title="Settings" href="/projects/{data.projectKey}/settings" icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' />
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
            </tr>
          {/snippet}
          {#snippet body()}
            {#each recentRuns as run}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <tr
                class="clickable-row"
                onclick={() => window.location.href = `/projects/${data.projectKey}/executions/${run.id}`}
              >
                <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
                <td class="mono">{run.runnerId}</td>
                <td>{run.branch ?? '—'}</td>
                <td>{formatDate(run.startedAt)}</td>
                <td>{duration(run.startedAt, run.finishedAt)}</td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
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

  :global(.page > .app-alert) { margin-bottom: 20px; }

  .project-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }

  .header-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .project-name { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .project-desc { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }

  .latest-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }
  .latest-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 20px;
    background: var(--surface-card-bg, var(--color-surface));
    border: 1px solid var(--surface-card-border, var(--color-border));
    border-radius: var(--radius);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .latest-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .latest-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .latest-card-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .latest-card-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .latest-card-meta {
    font-size: 0.8rem;
    color: var(--color-accent);
    font-family: var(--font-mono, monospace);
  }
  .latest-card-squad {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .section { margin-bottom: 28px; }

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

  .section-header .section-title { margin: 0; }

  .section-link { font-size: 0.8rem; font-weight: 500; color: var(--color-accent); }

  .coverage-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .chart-layout {
    display: grid;
    grid-template-columns: auto minmax(170px, 240px);
    align-items: center;
    justify-content: center;
    gap: 24px;
  }

  .chart-legend { display: grid; gap: 10px; }

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

  .coverage-breakdown { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
  .coverage-breakdown span {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }
  .coverage-breakdown strong { color: var(--color-text); }

  .empty-text {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    padding: 16px 0;
  }

  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }

  .clickable-row { cursor: pointer; }
  .clickable-row:hover td { background: color-mix(in srgb, var(--color-accent), transparent 94%); }

  .quick-links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  @media (max-width: 800px) {
    .metrics-row { grid-template-columns: repeat(3, 1fr); }
    .latest-row { grid-template-columns: 1fr; }
    .chart-layout { grid-template-columns: 1fr; justify-content: center; }
    .chart-layout > :first-child { margin: 0 auto; max-width: 320px; }
    .quick-links { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
    .quick-links { grid-template-columns: 1fr; }
    .project-header { flex-direction: column; }
    .project-header :global(.btn) { width: 100%; justify-content: center; }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>

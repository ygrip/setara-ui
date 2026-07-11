<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import ActionCard from '$lib/components/ActionCard.svelte';
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
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec.toString().padStart(2, '0')}s`;
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }

  const activeApiKeys = $derived(data.apiKeys.filter((k: ApiKey) => !k.revokedAt).length);
  const recentRuns = $derived(data.runs.slice(0, 8));
  const lastRun = $derived(data.runs[0] ?? null);

  const recentSlice = $derived(data.runs.slice(0, 10));
  const recentPassed = $derived(recentSlice.filter((r: { status: string }) => r.status === 'PASSED').length);
  const recentFailed = $derived(recentSlice.filter((r: { status: string }) => r.status === 'FAILED').length);
  const coveragePct = $derived(data.statistic?.coveragePercentage ?? null);
  const notAutomated = $derived(
    data.statistic
      ? Math.max((data.statistic.totalAutomatable ?? data.statistic.totalScenarios) - data.statistic.totalAutomated, 0)
      : null
  );

  const healthInfo = $derived.by(() => {
    if (data.runs.length === 0) {
      return { status: 'no_runs', label: 'No Runs Yet', message: 'Run your first automation session to see quality signals.', cssClass: 'neutral' };
    }
    if (!data.statistic || data.statistic.totalScenarios === 0) {
      return { status: 'no_scenarios', label: 'No Scenarios', message: 'Create test scenarios to track automation coverage.', cssClass: 'warning' };
    }
    if (lastRun?.status === 'FAILED') {
      if (recentFailed >= 5) {
        return { status: 'high_risk', label: 'High Risk', message: `${recentFailed} of the last ${recentSlice.length} runs failed.`, cssClass: 'danger' };
      }
      return { status: 'needs_attention', label: 'Needs Attention', message: 'Latest run failed.', cssClass: 'warning' };
    }
    if (coveragePct !== null && coveragePct < 50) {
      return { status: 'low_coverage', label: 'Needs Attention', message: `Automation coverage is low at ${coveragePct.toFixed(0)}%.`, cssClass: 'warning' };
    }
    return { status: 'healthy', label: 'Healthy', message: 'Latest run passed and coverage looks good.', cssClass: 'success' };
  });

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

  const completedRecentRuns = $derived(
    recentSlice.filter((r: { status: string }) => ['PASSED', 'FAILED'].includes(r.status))
  );

  const passRatePct = $derived.by(() => {
    const total = completedRecentRuns.length;
    if (total === 0) return null;
    return Math.round((recentPassed / total) * 100);
  });

  const healthClass = $derived(healthInfo.cssClass ?? 'neutral');

  const passRateDeg = $derived(`${((passRatePct ?? 0) / 100) * 360}deg`);
</script>

<svelte:head>
  <title>{data.project?.name ?? data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <span>{data.projectKey}</span>
  </nav>

  {#if data.error}
    <AppAlert tone="error" title="Could not load project">{data.error}</AppAlert>
  {:else if data.project}
    <!-- Header -->
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
    </div>

<!-- Project Health Hero -->
<section class="health-hero health-hero--{healthClass}" aria-label="Project health summary">
  <div class="health-hero__icon" aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none">
      <path
        d="M32 5.5 54.1 18.25v25.5L32 56.5 9.9 43.75v-25.5L32 5.5Z"
        stroke="currentColor"
        stroke-width="2"
      />

      {#if healthClass === 'success'}
        <circle cx="32" cy="32" r="11" fill="currentColor" opacity="0.12" />
        <path d="M25.5 32.5 30 37l9-10" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      {:else if healthClass === 'danger'}
        <circle cx="32" cy="32" r="11" fill="currentColor" />
        <path d="M32 24.5v10" stroke="white" stroke-width="3.2" stroke-linecap="round" />
        <path d="M32 40h.01" stroke="white" stroke-width="4" stroke-linecap="round" />
      {:else if healthClass === 'warning'}
        <circle cx="32" cy="32" r="11" fill="currentColor" opacity="0.12" />
        <path d="M32 25v10" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
        <path d="M32 40h.01" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      {:else}
        <circle cx="32" cy="32" r="11" fill="currentColor" opacity="0.12" />
        <path d="M32 26v7" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        <path d="M32 39h.01" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      {/if}
    </svg>
  </div>

  <div class="health-hero__content">
    <div class="health-hero__label">Project Health</div>

    <h2 class="health-hero__title">{healthInfo.label}</h2>

    <p class="health-hero__message">{healthInfo.message}</p>

    {#if data.runs.length > 0}
      <div class="health-hero__signals">
        <span class="health-signal">
          <span class="health-signal__dot health-signal__dot--muted"></span>
          {recentSlice.length} recent runs
        </span>

        <span class="health-signal">
          <span class="health-signal__dot health-signal__dot--danger"></span>
          {recentFailed} failed
        </span>

        <span class="health-signal">
          <span class="health-signal__dot health-signal__dot--success"></span>
          {recentPassed} passed
        </span>

        {#if notAutomated !== null}
          <span class="health-signal">
            <span class="health-signal__dot health-signal__dot--warning"></span>
            {notAutomated} scenarios not automated
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="health-hero__actions">
    {#if lastRun?.status === 'FAILED'}
      <a class="health-action health-action--danger" href="/projects/{data.projectKey}/executions/{lastRun.id}">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 3.5 16.5 6v4.8c0 3.1-2 5.8-6.5 7.7-4.5-1.9-6.5-4.6-6.5-7.7V6L10 3.5Z" stroke="currentColor" stroke-width="1.7" />
          <path d="M10 7.2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M10 14h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
        View Failed Run
      </a>
    {/if}

    <a class="health-action" href="/projects/{data.projectKey}/coverage">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 13.5 8 9.5l3 3L16 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 16.5h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      Open Coverage
    </a>
  </div>
</section>

    <!-- Metric cards (task: setara-l3ja) -->
    <div class="metrics-row">
      <MetricCard
        label="Total Runs"
        value={data.runs.length}
        sub={data.runs.length > 0 ? `Last: ${relativeTime(lastRun?.startedAt ?? null)}` : 'No runs yet'}
        variant="info"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-info), transparent 86%)", color: "var(--color-info)" }}
      />
      <MetricCard
        label="Automation Coverage"
        value={coveragePct !== null ? `${coveragePct.toFixed(0)}%` : 'N/A'}
        sub={data.statistic ? `${data.statistic.totalAutomated} / ${data.statistic.totalScenarios} automated` : ''}
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4l3 3"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-accent), transparent 86%)", color: "var(--color-accent)" }}
      />
      <MetricCard
        label="Active API Keys"
        value={activeApiKeys}
        sub="Live ingestion keys"
        variant="default"
        iconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>'
        iconFrame={{ size: "40px", padding: "6px", border: "1px solid color-mix(in srgb, var(--color-border), transparent 75%)", radius: "10px", background: "color-mix(in srgb, var(--color-warning), transparent 86%)", color: "var(--color-warning)" }}
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
        sub={data.latestBuild ? `Latest: ${data.latestBuild.status}` : 'No builds yet'}
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
        {#if data.latestBuild.version}<span class="latest-card-meta">v{data.latestBuild.version}</span>{/if}
        <span class="latest-card-cta">Open build →</span>
      </a>
      {/if}
      {#if data.latestPlan}
      <a class="latest-card surface-card" href="/squads/{data.latestPlan.squadId}/release-plans/{data.latestPlan.id}" aria-label="Open latest plan {data.latestPlan.name}">
        <div class="latest-card-top">
          <span class="latest-card-label">Latest Plan</span>
          <Badge text={data.latestPlan.status.replace('_', ' ')} variant={planStatusVariant(data.latestPlan.status)} />
        </div>
        <span class="latest-card-name">{data.latestPlan.name}</span>
        {#if data.latestPlan.releaseVersion}<span class="latest-card-meta">{data.latestPlan.releaseVersion}</span>{/if}
        {#if data.latestPlan.squadName}<span class="latest-card-squad">{data.latestPlan.squadName}</span>{/if}
        <span class="latest-card-cta">Open plan →</span>
      </a>
      {/if}
    </div>
    {/if}

    <!-- Automation Coverage + Quality Signals (tasks: setara-fuxs) -->
    <div class="section">
      <div class="coverage-quality-grid">
        <BentoCard title="Automation Coverage" subtitle="{Number(coveragePct ?? 0).toFixed(0)}% of scenarios automated" variant="default">
          <div class="compact-coverage">
            <div class="donut-host-compact">
              <DonutChart chartData={automationDonut} size={300} legendPosition="bottom" />
              {#if coveragePct !== null}
                <div class="donut-center-compact">
                  <strong>{coveragePct.toFixed(0)}%</strong>
                  <span>coverage</span>
                </div>
              {/if}
            </div>
            <div class="coverage-stats">
              <div class="cov-stat">
                <strong>{data.statistic?.totalAutomated ?? 0}</strong>
                <span>automated</span>
              </div>
              <div class="cov-stat">
                <strong>{data.statistic?.totalAutomatable ?? data.statistic?.totalScenarios ?? 0}</strong>
                <span>automatable</span>
              </div>
              <div class="cov-stat">
                <strong>{notAutomated ?? 0}</strong>
                <span>remaining</span>
              </div>
            </div>
          </div>
        </BentoCard>

        <BentoCard title="Quality Signals" subtitle="Based on recent execution history" variant="default">
          <div class="signals-grid">
            <div class="signal-item">
              <span class="signal-label">Pass rate</span>
              <strong class="signal-value {passRatePct !== null && passRatePct < 70 ? 'signal-value--danger' : passRatePct !== null && passRatePct >= 90 ? 'signal-value--success' : ''}">
                {passRatePct !== null ? `${passRatePct}%` : 'N/A'}
              </strong>
              <span class="signal-context">{recentSlice.length > 0 ? `${recentPassed}/${recentSlice.length} recent runs` : 'No runs yet'}</span>
            </div>
            <div class="signal-item">
              <span class="signal-label">Latest run</span>
              <strong class="signal-value {lastRun ? (lastRun.status === 'FAILED' ? 'signal-value--danger' : lastRun.status === 'PASSED' ? 'signal-value--success' : '') : ''}">
                {lastRun ? lastRun.status : 'No runs'}
              </strong>
              <span class="signal-context">{lastRun ? formatDate(lastRun.startedAt) : '—'}</span>
            </div>
            <div class="signal-item">
              <span class="signal-label">Last activity</span>
              <strong class="signal-value">{relativeTime(lastRun?.startedAt ?? null)}</strong>
              <span class="signal-context">{lastRun?.branch ? `on ${lastRun.branch}` : '—'}</span>
            </div>
            <div class="signal-item">
              <span class="signal-label">Not automated</span>
              <strong class="signal-value {(notAutomated ?? 0) > 0 ? 'signal-value--warning' : 'signal-value--success'}">{notAutomated ?? '—'}</strong>
              <span class="signal-context">scenarios remaining</span>
            </div>
          </div>
          {#if lastRun}
            <a class="signal-link" href="/projects/{data.projectKey}/executions/{lastRun.id}">
              View latest run →
            </a>
          {/if}
        </BentoCard>
      </div>
    </div>

    <!-- Quick Actions (task: setara-n052) -->
    <div class="section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="quick-actions">
        <ActionCard
          title="Test Repository"
          description="Browse and manage all test scenarios"
          href="/projects/{data.projectKey}/repository"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/></svg>'
        />
        <ActionCard
          title="Executions"
          description="View automation run history and results"
          href="/projects/{data.projectKey}/executions"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        />
        <ActionCard
          title="Coverage"
          description="Explore automation coverage by scenario"
          href="/projects/{data.projectKey}/coverage"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
        />
        <ActionCard
          title="Builds"
          description="Track builds and release verification"
          href="/projects/{data.projectKey}/builds"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/></svg>'
        />
        <ActionCard
          title="Release Plans"
          description="Manage and validate release readiness"
          href="/projects/{data.projectKey}/release-plans"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>'
        />
        <ActionCard
          title="Settings"
          description="Configure project, API keys, and integrations"
          href="/projects/{data.projectKey}/settings"
          icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'
        />
      </div>
    </div>

    <!-- Recent Runs (task: setara-ztr2) -->
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
              <tr class="run-row" onclick={() => goto(`/projects/${data.projectKey}/executions/${run.id}`)}>
                <td><Badge text={run.status} variant={runStatusVariant(run.status)} /></td>
                <td class="mono">{run.runnerId}</td>
                <td>
                  {#if run.branch}
                    <span class="branch-chip">{run.branch}</span>
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
                <td>{formatDate(run.startedAt)}</td>
                <td class="mono">{duration(run.startedAt, run.finishedAt)}</td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { max-width: min(100%); display: flex; flex-direction: column; gap: 1.25rem; }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  /* Header */
  .project-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .header-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .project-name { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .project-desc { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

  /* Project Health Hero */
.health-hero {
  --health-color: var(--color-text-muted);
  --health-bg: color-mix(in srgb, var(--health-color) 5%, var(--color-surface));
  --health-border: color-mix(in srgb, var(--health-color) 28%, var(--color-border));
  --health-button-bg: var(--color-surface);
  --health-button-border: var(--color-border);

  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1.5rem;

  min-height: 138px;
  padding: 1.45rem 1.85rem;

  border: 1px solid var(--health-border);
  border-radius: 1rem;

  background:
    radial-gradient(
      circle at 8% 50%,
      color-mix(in srgb, var(--health-color) 8%, transparent),
      transparent 34%
    ),
    linear-gradient(
      90deg,
      var(--health-bg),
      var(--color-surface)
    );
}

/* Status variants */
.health-hero--success {
  --health-color: var(--color-success);
}

.health-hero--warning {
  --health-color: var(--color-warning);
}

.health-hero--danger {
  --health-color: var(--color-danger);
}

.health-hero--neutral {
  --health-color: var(--color-text-muted);
}

/* Hexagon icon */
.health-hero__icon {
  width: 76px;
  height: 76px;
  flex: 0 0 auto;
  color: var(--health-color);
}

.health-hero__icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Main content */
.health-hero__content {
  min-width: 0;
}

.health-hero__label {
  margin-bottom: 0.35rem;

  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.045em;

  color: var(--color-text-muted);
}

.health-hero__title {
  margin: 0;

  font-size: 1.35rem;
  font-weight: 850;
  line-height: 1.2;
  letter-spacing: -0.025em;

  color: var(--health-color);
}

.health-hero__message {
  margin: 0.35rem 0 0;

  font-size: 0.88rem;
  font-weight: 650;
  line-height: 1.35;

  color: var(--color-text);
}

/* Signals */
.health-hero__signals {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;

  margin-top: 0.85rem;
}

.health-signal {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.2;

  color: var(--color-text-muted);
  white-space: nowrap;
}

.health-signal__dot {
  width: 0.44rem;
  height: 0.44rem;
  flex: 0 0 auto;

  border-radius: 999px;
  background: var(--color-text-muted);
}

.health-signal__dot--success {
  background: var(--color-success);
}

.health-signal__dot--danger {
  background: var(--color-danger);
}

.health-signal__dot--warning {
  background: var(--color-warning);
}

.health-signal__dot--muted {
  background: color-mix(in srgb, var(--color-text-muted) 55%, transparent);
}

/* Actions */
.health-hero__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.health-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;

  min-height: 42px;
  padding: 0.65rem 1.15rem;

  border: 1px solid var(--health-button-border);
  border-radius: 0.55rem;

  background: var(--health-button-bg);
  color: var(--color-text);

  font-size: 0.84rem;
  font-weight: 750;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;

  box-shadow: 0 1px 2px color-mix(in srgb, var(--color-text) 5%, transparent);

  transition:
    transform 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.health-action:hover {
  transform: translateY(-1px);
  color: var(--color-primary, #00a99d);
  border-color: color-mix(in srgb, var(--color-primary, #00a99d) 36%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary, #00a99d) 4%, var(--color-surface));
  box-shadow: 0 6px 14px color-mix(in srgb, var(--color-primary, #00a99d) 8%, transparent);
}

.health-action svg {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.health-action--danger {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 3%, var(--color-surface));
}

.health-action--danger:hover {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 44%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface));
  box-shadow: 0 6px 14px color-mix(in srgb, var(--color-danger) 9%, transparent);
}

/* Tablet */
@media (max-width: 860px) {
  .health-hero {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 1rem;
  }

  .health-hero__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    padding-top: 0.25rem;
  }
}

/* Mobile */
@media (max-width: 560px) {
  .health-hero {
    grid-template-columns: 1fr;
    gap: 1rem;

    min-height: unset;
    padding: 1.15rem;

    border-radius: 1rem;

    background:
      radial-gradient(
        circle at 18% 8%,
        color-mix(in srgb, var(--health-color) 9%, transparent),
        transparent 36%
      ),
      linear-gradient(
        180deg,
        var(--health-bg),
        var(--color-surface)
      );
  }

  .health-hero__icon {
    width: 58px;
    height: 58px;
  }

  .health-hero__label {
    margin-bottom: 0.32rem;
    font-size: 0.68rem;
  }

  .health-hero__title {
    font-size: 1.35rem;
    line-height: 1.15;
  }

  .health-hero__message {
    margin-top: 0.4rem;
    font-size: 0.95rem;
    line-height: 1.35;
  }

  .health-hero__signals {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.55rem;

    margin-top: 0.9rem;
  }

  .health-signal {
    align-items: center;

    font-size: 0.86rem;
    line-height: 1.25;

    white-space: normal;
  }

  .health-hero__actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.65rem;

    width: 100%;
    margin-top: 0.35rem;
  }

  .health-action {
    width: 100%;
    min-height: 46px;
    padding: 0.75rem 1rem;

    border-radius: 0.7rem;

    font-size: 0.9rem;
    line-height: 1;

    white-space: nowrap;
  }
}

/* Small mobile */
@media (max-width: 380px) {
  .health-hero {
    padding: 1rem;
  }

  .health-hero__icon {
    width: 54px;
    height: 54px;
  }

  .health-hero__title {
    font-size: 1.2rem;
  }

  .health-hero__message {
    font-size: 0.9rem;
  }

  .health-signal {
    font-size: 0.82rem;
  }

  .health-action {
    min-height: 44px;
    font-size: 0.86rem;
  }
}

  /* Metrics */
  .metrics-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
  }

  /* Latest Build/Plan */
  .latest-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
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
  .latest-card:hover { border-color: var(--color-accent); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .latest-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .latest-card-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .latest-card-name { font-size: 1rem; font-weight: 700; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .latest-card-meta { font-size: 0.8rem; color: var(--color-accent); font-family: var(--font-mono, monospace); }
  .latest-card-squad { font-size: 0.78rem; color: var(--color-text-muted); }
  .latest-card-cta { font-size: 0.76rem; color: var(--color-accent); font-weight: 600; margin-top: auto; }

  /* Coverage + Quality Signals */
  .coverage-quality-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  .compact-coverage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .donut-host-compact {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .donut-center-compact {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    pointer-events: none;
    text-align: center;
    line-height: 1;
  }
  .donut-center-compact strong { font-size: 1.7rem; font-weight: 800; color: var(--color-text); letter-spacing: -0.02em; }
  .donut-center-compact span { font-size: 0.66rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-text-muted); }

  .coverage-stats { display: flex; justify-content: center; gap: 1.5rem; }
  .cov-stat { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
  .cov-stat strong { font-size: 1.1rem; font-weight: 700; color: var(--color-text); }
  .cov-stat span { font-size: 0.7rem; color: var(--color-text-muted); }

  .signals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .signal-item { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.7rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-bg); }
  .signal-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
  .signal-value { font-size: 1.05rem; font-weight: 800; color: var(--color-text); }
  .signal-value--success { color: var(--color-success); }
  .signal-value--warning { color: var(--color-warning); }
  .signal-value--danger { color: var(--color-danger); }
  .signal-context { font-size: 0.7rem; color: var(--color-text-muted); }
  .signal-link { display: inline-block; margin-top: 0.75rem; font-size: 0.76rem; font-weight: 600; color: var(--color-accent); text-decoration: none; }
  .signal-link:hover { text-decoration: underline; }

  /* Section */
  .section { display: flex; flex-direction: column; gap: 0.75rem; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 0; }
  .section-link { font-size: 0.8rem; font-weight: 500; color: var(--color-accent); text-decoration: none; }

  /* Quick Actions */
  .quick-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

  /* Recent Runs */
  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .muted { color: var(--color-text-muted); }

  .run-row:hover td { background: color-mix(in srgb, var(--color-accent) 5%, transparent) !important; }

  .branch-chip {
    display: inline-block;
    padding: 0.16rem 0.5rem;
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border));
    border-radius: 999px;
    font-size: 0.7rem;
    font-family: ui-monospace, monospace;
    color: var(--color-accent);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-col { text-align: right; }
  .run-link {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .run-link:hover { text-decoration: underline; }

  @media (max-width: 1100px) {
    .metrics-row { grid-template-columns: repeat(3, 1fr); }
    .coverage-quality-grid { grid-template-columns: 1fr; }
    .quick-actions { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 800px) {
    .latest-row { grid-template-columns: 1fr; }
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
    .signals-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .quick-actions { grid-template-columns: 1fr; }
    .project-header { flex-direction: column; }
    .project-header :global(.btn) { width: 100%; justify-content: center; }
    .health-hero { flex-direction: column; align-items: flex-start; }
    .hero-actions { align-self: stretch; }
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>

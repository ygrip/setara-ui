<script lang="ts">
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

  const passRatePct = $derived.by(() => {
    const total = recentSlice.length;
    if (total === 0) return null;
    return Math.round((recentPassed / total) * 100);
  });
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
      <Button variant="secondary" href="/projects/{data.projectKey}/settings">Project Settings</Button>
    </div>

    <!-- Health Hero (task: setara-cpwb) -->
    <div class="health-hero health-hero--{healthInfo.cssClass}">
      <div class="hero-left">
        <div class="hero-label">Project Health</div>
        <div class="hero-status-badge health-badge--{healthInfo.cssClass}">{healthInfo.label}</div>
        <p class="hero-message">{healthInfo.message}</p>
        {#if data.runs.length > 0}
          <div class="hero-signals">
            <span class="signal signal--pass">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2"/><path d="M3.5 6l1.8 1.8 3.2-3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {recentPassed} passed
            </span>
            <span class="signal signal--fail">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2"/><path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              {recentFailed} failed
            </span>
            {#if notAutomated !== null}
              <span class="signal signal--neutral">{notAutomated} not automated</span>
            {/if}
          </div>
        {/if}
      </div>
      <div class="hero-actions">
        {#if lastRun?.status === 'FAILED'}
          <Button href="/projects/{data.projectKey}/executions/{lastRun.id}" variant="secondary">View Failed Run</Button>
        {/if}
        <Button href="/projects/{data.projectKey}/coverage" variant="secondary">Open Coverage</Button>
      </div>
    </div>

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
              <DonutChart chartData={automationDonut} size={220} legendPosition="bottom" />
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
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each recentRuns as run}
              <tr class="run-row run-row--{runStatusVariant(run.status)}">
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
                <td class="action-col">
                  <a
                    class="run-link"
                    href="/projects/{data.projectKey}/executions/{run.id}"
                    aria-label="Open run {run.id}"
                  >
                    Open →
                  </a>
                </td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { max-width: min(1520px, 100%); display: flex; flex-direction: column; gap: 1.25rem; }

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

  /* Health Hero */
  .health-hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.4rem;
    border-radius: 0.9rem;
    border: 1px solid var(--hero-border, var(--color-border));
    background: var(--hero-bg, var(--color-surface));
    flex-wrap: wrap;
  }
  .health-hero--success {
    --hero-bg: color-mix(in srgb, var(--color-success) 6%, var(--color-surface));
    --hero-border: color-mix(in srgb, var(--color-success) 28%, var(--color-border));
  }
  .health-hero--warning {
    --hero-bg: color-mix(in srgb, var(--color-warning) 6%, var(--color-surface));
    --hero-border: color-mix(in srgb, var(--color-warning) 28%, var(--color-border));
  }
  .health-hero--danger {
    --hero-bg: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface));
    --hero-border: color-mix(in srgb, var(--color-danger) 28%, var(--color-border));
  }
  .health-hero--neutral {
    --hero-bg: var(--color-surface);
    --hero-border: var(--color-border);
  }

  .hero-left { display: flex; flex-direction: column; gap: 0.4rem; }
  .hero-label { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-text-muted); }
  .hero-status-badge {
    display: inline-block;
    padding: 0.22rem 0.7rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 700;
    width: fit-content;
  }
  .health-badge--success { background: color-mix(in srgb, var(--color-success) 18%, transparent); color: var(--color-success); }
  .health-badge--warning { background: color-mix(in srgb, var(--color-warning) 18%, transparent); color: var(--color-warning); }
  .health-badge--danger { background: color-mix(in srgb, var(--color-danger) 18%, transparent); color: var(--color-danger); }
  .health-badge--neutral { background: color-mix(in srgb, var(--color-text-muted) 14%, transparent); color: var(--color-text-muted); }

  .hero-message { margin: 0; font-size: 0.85rem; color: var(--color-text-muted); }
  .hero-signals { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .signal { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; }
  .signal--pass { color: var(--color-success); }
  .signal--fail { color: var(--color-danger); }
  .signal--neutral { color: var(--color-text-muted); }
  .hero-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }

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

  .run-row--danger td { background: color-mix(in srgb, var(--color-danger) 4%, transparent); }
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
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>

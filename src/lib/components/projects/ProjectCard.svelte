<script lang="ts">
  import type { ProjectOverviewItem } from '$lib/api/projects';
  import { formatNumber, formatPercent } from '$lib/utils/format';
  import ProjectMetricProgress from './ProjectMetricProgress.svelte';
  import ProjectStatusBadge from './ProjectStatusBadge.svelte';

  let { project }: { project: ProjectOverviewItem } = $props();

  const accent = $derived.by(() => {
    if (project.healthStatus === 'HEALTHY') return 'success';
    if (project.healthStatus === 'NEEDS_REVIEW') return 'warning';
    if (project.healthStatus === 'NO_RUNS') return 'neutral';
    return 'danger';
  });

  function relativeTime(value: string | null): string {
    if (!value) return 'Never';
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
</script>

<a
  class="project-card"
  data-tone={accent}
  href={`/projects/${project.projectKey}`}
  aria-label={`Open ${project.name}`}
>
  <div class="card-heading">
    <div class="identity">
      <span class="project-key">{project.projectKey}</span>
      <h2>{project.name}</h2>
      {#if project.domain}<span class="domain">{project.domain}</span>{/if}
    </div>
    <ProjectStatusBadge status={project.healthStatus} />
  </div>

  <div class="metrics">
    <div class="metric">
      <span class="metric-label">Scenarios</span>
      <strong>{formatNumber(project.totalScenarios)}</strong>
    </div>
    <div class="metric">
      <span class="metric-label">Coverage</span>
      <strong>{project.totalScenarios > 0 ? formatPercent(project.coveragePercent) : 'N/A'}</strong>
      <ProjectMetricProgress
        label={`${project.name} automation coverage`}
        value={project.totalScenarios > 0 ? project.coveragePercent : null}
      />
    </div>
    <div class="metric">
      <span class="metric-label">Pass rate</span>
      <strong>{project.passRatePercent == null ? 'No runs yet' : formatPercent(project.passRatePercent)}</strong>
      <ProjectMetricProgress label={`${project.name} pass rate`} value={project.passRatePercent} />
    </div>
    <div class="metric">
      <span class="metric-label">Open failures</span>
      <strong>{project.openFailures == null ? 'Not available' : formatNumber(project.openFailures)}</strong>
    </div>
  </div>

  <div class="card-footer">
    <span title={project.lastExecutionAt ? new Date(project.lastExecutionAt).toLocaleString() : 'No completed runs'}>
      Last run {relativeTime(project.lastExecutionAt)}
    </span>
    <span class="open-action">Open <span aria-hidden="true">→</span></span>
  </div>
</a>

<style>
  .project-card {
    --project-accent: var(--color-text-muted);
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 15rem;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    padding: 1rem;
    border-radius: var(--radius-lg, 0.875rem);
    background: var(--surface-card-bg, var(--color-surface));
    border: 1px solid var(--surface-card-border, var(--color-border));
    box-shadow: var(--shadow-sm);
    color: inherit;
    text-decoration: none;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .project-card::before {
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
    background: var(--project-accent);
    content: '';
  }

  .project-card:hover { transform: translateY(-2px); border-color: var(--project-accent); box-shadow: var(--shadow-md); }
  .project-card:focus-visible { outline: 3px solid color-mix(in srgb, var(--project-accent) 35%, transparent); outline-offset: 2px; }
  [data-tone='success'] { --project-accent: var(--color-success); }
  [data-tone='warning'] { --project-accent: var(--color-warning); }
  [data-tone='danger'] { --project-accent: var(--color-danger); }

  .card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
  .identity { display: grid; min-width: 0; gap: 0.2rem; }
  .project-key { color: var(--project-accent); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; }
  h2 { overflow: hidden; margin: 0; color: var(--color-text); font-size: 1.05rem; text-overflow: ellipsis; white-space: nowrap; }
  .domain { color: var(--color-text-muted); font-size: 0.76rem; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem 1rem; }
  .metric { display: grid; min-width: 0; gap: 0.3rem; }
  .metric-label { color: var(--color-text-muted); font-size: 0.68rem; font-weight: 700; }
  .metric strong { overflow: hidden; color: var(--color-text); font-size: 0.92rem; text-overflow: ellipsis; white-space: nowrap; }
  .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: auto; color: var(--color-text-muted); font-size: 0.75rem; }
  .open-action { color: var(--project-accent); font-weight: 750; }
</style>

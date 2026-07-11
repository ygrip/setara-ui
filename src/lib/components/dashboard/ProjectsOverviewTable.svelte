<script lang="ts">
  import type { DashboardProjectOverview } from '$lib/api/dashboard';
  import { AppSkeleton } from '$lib/ui/display';
  import InlineProgress from './InlineProgress.svelte';
  import QualityStatusBadge from './QualityStatusBadge.svelte';

  let {
    projects,
    liveByProject = new Map<string, number>(),
    loading = false,
    unavailable = false,
    error = ''
  }: {
    projects: DashboardProjectOverview[];
    liveByProject?: Map<string, number>;
    loading?: boolean;
    unavailable?: boolean;
    error?: string;
  } = $props();

  function failureTone(count: number): 'none' | 'warning' | 'danger' {
    if (count === 0) return 'none';
    if (count < 5) return 'warning';
    return 'danger';
  }

  function formatActivity(value: string | null): string {
    if (!value) return 'No activity';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  }
</script>

<section class="projects-card surface-card" aria-labelledby="projects-overview-title">
  <div class="projects-header">
    <div>
      <h2 id="projects-overview-title">Projects needing attention</h2>
      <p>Up to 10 projects ranked by health score - worst first.</p>
    </div>
    <a href="/projects">View projects <span aria-hidden="true">→</span></a>
  </div>

  {#if loading}
    <div class="projects-loading" role="status" aria-label="Loading project health">
      <AppSkeleton height="42px" lines={4} />
    </div>
  {:else if error}
    <div class="projects-state projects-state--error">
      <strong>Could not load project health</strong>
      <span>{error}</span>
    </div>
  {:else if unavailable}
    <div class="projects-state">
      <strong>Project health unavailable</strong>
      <span>Metrics will appear when dashboard history is available.</span>
    </div>
  {:else if projects.length === 0}
    <div class="projects-state">
      <strong>No projects yet</strong>
      <span>Create a project to start tracking quality and automation.</span>
    </div>
  {:else}
    <div class="projects-scroll">
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Scenarios</th>
            <th>Automation</th>
            <th>Pass rate</th>
            <th>Open failures</th>
            <th>Status</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {#each projects as project (project.projectId)}
            {@const liveRuns = liveByProject.get(project.projectKey) ?? 0}
            <tr class:row-live={liveRuns > 0}>
              <td>
                <a class="project-link" href="/projects/{project.projectKey}">
                  <span class="project-name">{project.projectName}</span>
                  <span class="project-key">{project.projectKey}</span>
                </a>
                {#if liveRuns > 0}
                  <span class="live-badge"><span aria-hidden="true"></span>{liveRuns} live</span>
                {/if}
              </td>
              <td class="number-cell">{project.totalScenarios.toLocaleString()}</td>
              <td>
                <InlineProgress
                  value={project.automationCoverage}
                  label="{project.projectName} automation coverage"
                />
              </td>
              <td class="number-cell">
                {#if project.finishedExecutions === 0}
                  <span class="no-runs">No runs</span>
                {:else}
                  {Math.round(project.passRate)}%
                {/if}
              </td>
              <td>
                <span class="failure-count failure-count--{failureTone(project.openFailures)}">
                  {project.openFailures}
                  <span class="sr-only"> open {project.openFailures === 1 ? 'failure' : 'failures'}</span>
                </span>
              </td>
              <td><QualityStatusBadge status={project.status} /></td>
              <td class="activity-cell">{formatActivity(project.lastActivityAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .projects-card {
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius);
  }

  .projects-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px 14px;
  }

  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 750;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .projects-header > a {
    display: inline-flex;
    gap: 5px;
    color: var(--color-accent);
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .projects-scroll {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 920px;
    border-collapse: collapse;
  }

  th {
    padding: 11px 16px;
    border-top: 1px solid color-mix(in srgb, var(--color-border), transparent 25%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border), transparent 25%);
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-bg), transparent 18%);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    padding: 13px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border), transparent 40%);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 550;
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: color-mix(in srgb, var(--color-accent), transparent 96%); }
  .row-live td { background: color-mix(in srgb, var(--color-info), transparent 96%); }

  .project-link {
    display: inline-flex;
    flex-direction: column;
    color: inherit;
    text-decoration: none;
  }

  .project-link:hover .project-name,
  .project-link:focus-visible .project-name { color: var(--color-accent); }

  .project-name {
    color: var(--color-text);
    font-weight: 750;
  }

  .project-key {
    margin-top: 2px;
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .number-cell { color: var(--color-text); font-weight: 700; font-variant-numeric: tabular-nums; }
  .no-runs { color: var(--color-text-muted); font-weight: 600; }
  .activity-cell { white-space: nowrap; }

  .failure-count {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .failure-count--none { color: var(--color-success); }
  .failure-count--warning { color: var(--color-warning); }
  .failure-count--danger { color: var(--color-danger); }

  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    color: var(--color-info);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .live-badge > span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-info);
  }

  .projects-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 190px;
    padding: 28px;
    text-align: center;
  }

  .projects-loading {
    min-height: 190px;
    padding: 16px 20px 22px;
  }

  .projects-state strong { color: var(--color-text); font-size: 0.86rem; }
  .projects-state span { margin-top: 4px; color: var(--color-text-muted); font-size: 0.76rem; }
  .projects-state--error strong { color: var(--color-danger); }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

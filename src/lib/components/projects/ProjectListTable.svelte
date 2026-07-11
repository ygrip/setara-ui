<script lang="ts">
  import type { ProjectOverviewItem } from '$lib/api/projects';
  import { formatNumber, formatPercent } from '$lib/utils/format';
  import ProjectStatusBadge from './ProjectStatusBadge.svelte';

  let { projects }: { projects: ProjectOverviewItem[] } = $props();

  function activity(value: string | null): string {
    if (!value) return 'Never';
    const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
    if (days === 0) return 'Today';
    return `${days}d ago`;
  }
</script>

<div class="table-shell">
  <table>
    <thead><tr><th>Project</th><th>Domain</th><th>Scenarios</th><th>Coverage</th><th>Pass rate</th><th>Failures</th><th>Status</th><th>Last run</th></tr></thead>
    <tbody>
      {#each projects as project (project.id)}
        <tr>
          <td><a href={`/projects/${project.projectKey}`}><strong>{project.name}</strong><span>{project.projectKey}</span></a></td>
          <td>{project.domain ?? 'Not set'}</td>
          <td>{formatNumber(project.totalScenarios)}</td>
          <td>{project.totalScenarios > 0 ? formatPercent(project.coveragePercent) : 'N/A'}</td>
          <td>{project.passRatePercent == null ? 'No runs' : formatPercent(project.passRatePercent)}</td>
          <td class:has-failures={(project.openFailures ?? 0) > 0}>{project.openFailures ?? 'Not available'}</td>
          <td><ProjectStatusBadge status={project.healthStatus} /></td>
          <td title={project.lastExecutionAt ? new Date(project.lastExecutionAt).toLocaleString() : 'No completed runs'}>{activity(project.lastExecutionAt)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-shell { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg, 0.875rem); background: var(--color-surface); }
  table { width: 100%; min-width: 62rem; border-collapse: collapse; }
  th, td { padding: 0.8rem; border-bottom: 1px solid var(--color-border); text-align: left; font-size: 0.78rem; white-space: nowrap; }
  th { color: var(--color-text-muted); font-size: 0.68rem; letter-spacing: 0.03em; text-transform: uppercase; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: color-mix(in srgb, var(--color-accent-subtle), transparent 45%); }
  td a { display: grid; gap: 0.1rem; color: var(--color-text); text-decoration: none; }
  td a:hover strong { color: var(--color-accent); }
  td a span { color: var(--color-text-muted); font-size: 0.68rem; }
  .has-failures { color: var(--color-danger); font-weight: 750; }
</style>

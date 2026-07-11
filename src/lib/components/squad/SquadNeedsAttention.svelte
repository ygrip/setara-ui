<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  let { overview }: { overview: SquadQualityOverview } = $props();
  const categories = $derived([{ key: 'lowCoverage', title: 'Low coverage', description: 'Below the coverage target.', tone: 'warning' }, { key: 'noRecentRun', title: 'No recent run', description: `No run in ${overview.thresholds.recentRunWindowDays} days.`, tone: 'warning' }, { key: 'noScenarios', title: 'No scenarios', description: 'Projects without scenarios.', tone: 'neutral' }, { key: 'highFailureRate', title: 'High failure rate', description: 'Pass rate below the risk threshold.', tone: 'danger' }, { key: 'flakyTests', title: 'Flaky tests', description: 'Repeated pass and fail transitions.', tone: 'warning' }] as const);
</script>

<section><h2>Needs attention</h2>{#if overview.summary.projectsAtRisk === 0}<EmptyState title="All good" hint="No projects require attention." minHeight="220px"><svelte:fragment slot="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 12 4 4L19 6"/></svg></svelte:fragment></EmptyState>{:else}<div class="attention-grid">{#each categories as category}<article data-tone={category.tone}><strong>{overview.attention[category.key].length}</strong><h3>{category.title}</h3><p>{category.description}</p></article>{/each}</div>{/if}</section>

<style>
  h2 { margin: 0 0 0.75rem; color: var(--color-text); font-size: 1rem; }
  .attention-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.75rem; }
  article { padding: 0.9rem; border: 1px solid var(--color-border); border-left: 3px solid var(--attention-color, var(--color-text-muted)); border-radius: 0.7rem; background: var(--color-surface); }
  [data-tone='warning'] { --attention-color: var(--color-warning); } [data-tone='danger'] { --attention-color: var(--color-danger); }
  article strong { color: var(--attention-color); font-size: 1.3rem; } h3 { margin: 0.2rem 0; color: var(--color-text); font-size: 0.82rem; } article p { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; }
  @media (max-width: 1100px) { .attention-grid { grid-template-columns: repeat(2, 1fr); } } @media (max-width: 600px) { .attention-grid { grid-template-columns: 1fr; } }
</style>

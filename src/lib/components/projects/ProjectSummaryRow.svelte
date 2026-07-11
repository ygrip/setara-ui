<script lang="ts">
  import type { ProjectOverviewSummary } from '$lib/api/projects';
  import MetricCard from '$lib/components/MetricCard.svelte';

  let { summary }: { summary: ProjectOverviewSummary } = $props();
</script>

<section class="summary-row" aria-label="Project health summary">
  <MetricCard label="Total projects" value={summary.totalProjects} variant="info" sub="Active projects" />
  <MetricCard label="Healthy" value={summary.healthy} variant="success" sub="Quality on track" />
  <MetricCard label="Needs review" value={summary.needsReview} variant="warning" sub="Worth a closer look" />
  <MetricCard
    label="High risk and critical"
    value={summary.highRisk + summary.critical}
    variant="danger"
    sub="Prioritize these projects"
  />
  <MetricCard label="No runs" value={summary.noRuns} sub="No execution evidence" />
</section>

<style>
  .summary-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.75rem; }
  @media (max-width: 1100px) { .summary-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .summary-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 430px) { .summary-row { grid-template-columns: 1fr; } }
</style>

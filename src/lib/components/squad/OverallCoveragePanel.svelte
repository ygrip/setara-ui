<script lang="ts">
  import BentoCard from '$lib/components/BentoCard.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import QualityStatusBadge from '$lib/components/dashboard/QualityStatusBadge.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  import { formatPercent } from '$lib/utils/format';
  let { overview }: { overview: SquadQualityOverview } = $props();
  const available = $derived(overview.summary.coveragePercent != null);
  const donut = $derived({ labels: ['Automated', 'Not automated'], datasets: [{ data: available ? [overview.summary.automatedScenarios, Math.max(overview.summary.totalScenarios - overview.summary.automatedScenarios, 0)] : [1], backgroundColor: available ? ['#0d9488', '#d1d5db'] : ['#d1d5db'], borderWidth: 0 }] });
</script>

<BentoCard title="Overall coverage" subtitle={available ? `${overview.summary.automatedScenarios} / ${overview.summary.totalScenarios} automated` : 'No scenarios available'}>
  {#snippet headerActions()}<QualityStatusBadge status={overview.summary.healthStatus} />{/snippet}
  <div class="coverage-body">
    <DonutChart chartData={donut} size={190} />
    <div class="coverage-copy"><strong>{available ? formatPercent(overview.summary.coveragePercent) : 'N/A'}</strong><span>{available ? `Target: ${overview.thresholds.coverageTargetPercent}%` : 'No scenarios yet'}</span></div>
  </div>
</BentoCard>

<style>
  .coverage-body { display: grid; place-items: center; gap: 0.4rem; }
  .coverage-copy { display: grid; justify-items: center; gap: 0.2rem; }
  .coverage-copy strong { color: var(--color-text); font-size: 1.7rem; }
  .coverage-copy span { color: var(--color-text-muted); font-size: 0.78rem; }
</style>

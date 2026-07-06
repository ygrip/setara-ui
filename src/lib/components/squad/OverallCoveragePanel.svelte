<script lang="ts">
  import BentoCard from '$lib/components/BentoCard.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import QualityStatusBadge from '$lib/components/dashboard/QualityStatusBadge.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  import { formatPercent } from '$lib/utils/format';
  let { overview }: { overview: SquadQualityOverview } = $props();
  const available = $derived(overview.summary.coveragePercent != null);
  const donut = $derived({
    labels: ['Automated', 'Not automated'],
    datasets: [{
      data: available
        ? [overview.summary.automatedScenarios, Math.max(overview.summary.totalScenarios - overview.summary.automatedScenarios, 0)]
        : [1],
      backgroundColor: available ? ['#0d9488', '#d1d5db'] : ['#d1d5db'],
      borderWidth: 0
    }]
  });
  const pctLabel = $derived(available ? formatPercent(overview.summary.coveragePercent) : 'N/A');
  const targetLabel = $derived(available ? `${overview.thresholds.coverageTargetPercent}% target` : 'No scenarios yet');
</script>

<BentoCard title="Overall coverage" subtitle="{overview.summary.automatedScenarios} / {overview.summary.totalScenarios} automated">
  {#snippet headerActions()}<QualityStatusBadge status={overview.summary.healthStatus} />{/snippet}
  <div class="coverage-body">
    <div class="donut-host">
      <DonutChart chartData={donut} size={260} legendPosition="bottom" />
      <div class="donut-center">
        <strong class="center-pct">{pctLabel}</strong>
        <span class="center-sub">{available ? 'coverage' : ''}</span>
      </div>
    </div>
    <p class="target-label">{targetLabel}</p>
  </div>
</BentoCard>

<style>
  .coverage-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .donut-host {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .donut-center {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    pointer-events: none;
    line-height: 1;
    text-align: center;
  }

  .center-pct {
    font-size: 1.9rem;
    font-weight: 800;
    color: var(--color-text);
    letter-spacing: -0.03em;
  }

  .center-sub {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .target-label {
    margin: 0;
    font-size: 0.76rem;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>

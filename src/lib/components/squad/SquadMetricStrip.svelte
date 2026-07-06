<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  import { formatNumber, formatPercent } from '$lib/utils/format';
  let { overview }: { overview: SquadQualityOverview } = $props();

  function delta(value: number | null, unit = ''): string {
    if (value == null) return 'No previous data';
    return `${value >= 0 ? '+' : ''}${value.toFixed(unit ? 1 : 0)}${unit} vs previous period`;
  }

  function direction(value: number | null): 'up' | 'down' | 'flat' | 'unknown' {
    if (value == null) return 'unknown';
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'flat';
  }

  function activity(value: string | null): string {
    if (!value) return 'Never';
    const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  }
</script>

<section class="metric-grid" aria-label="Squad quality metrics">
  <MetricCard label="Total scenarios" value={formatNumber(overview.summary.totalScenarios)} deltaLabel={delta(overview.deltas.totalScenarios)} deltaDirection={direction(overview.deltas.totalScenarios)} />
  <MetricCard label="Automated" value={formatNumber(overview.summary.automatedScenarios)} variant="info" deltaLabel={delta(overview.deltas.automatedScenarios)} deltaDirection={direction(overview.deltas.automatedScenarios)} />
  <MetricCard label="Automation coverage" value={overview.summary.coveragePercent == null ? 'N/A' : formatPercent(overview.summary.coveragePercent)} variant="success" sub={`Target: ${overview.thresholds.coverageTargetPercent}%`} deltaLabel={delta(overview.deltas.coveragePercent, ' pts')} deltaDirection={direction(overview.deltas.coveragePercent)} />
  <MetricCard label="Pass rate" value={overview.summary.passRatePercent == null ? 'No runs' : formatPercent(overview.summary.passRatePercent)} variant="success" deltaLabel={delta(overview.deltas.passRatePercent, ' pts')} deltaDirection={direction(overview.deltas.passRatePercent)} />
  <MetricCard label="Projects at risk" value={overview.summary.projectsAtRisk} variant={overview.summary.projectsAtRisk > 0 ? 'warning' : 'success'} deltaLabel={delta(overview.deltas.projectsAtRisk)} deltaDirection={direction(overview.deltas.projectsAtRisk)} deltaPositive={(overview.deltas.projectsAtRisk ?? 0) <= 0} />
  <MetricCard label="Last execution" value={activity(overview.summary.lastExecutionAt)} sub={overview.summary.lastExecutionAt ? new Date(overview.summary.lastExecutionAt).toLocaleString() : 'No execution data'} />
</section>

<style>
  .metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.8rem; }
  @media (max-width: 1280px) { .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 700px) { .metric-grid { grid-template-columns: 1fr; } }
</style>

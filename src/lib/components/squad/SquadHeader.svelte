<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import QualityStatusBadge from '$lib/components/dashboard/QualityStatusBadge.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  import { formatNumber, formatPercent } from '$lib/utils/format';

  let { overview }: { overview: SquadQualityOverview } = $props();
</script>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="/coverage-overview">Squads</a><span aria-hidden="true">/</span>
  {#if overview.squad.tribeName}<span>{overview.squad.tribeName}</span>{/if}
</nav>
<header>
  <div>
    <div class="title-row"><h1>{overview.squad.name}</h1><QualityStatusBadge status={overview.summary.healthStatus} /></div>
    <p>
      {overview.squad.tribeName ?? 'Independent'} squad · {formatNumber(overview.summary.totalScenarios)} scenarios ·
      {overview.summary.coveragePercent == null ? 'Coverage unavailable' : `${formatPercent(overview.summary.coveragePercent)} coverage`}
    </p>
  </div>
  <Button variant="primary" href={`/squads/${overview.squad.id}/release-plans`}>Release plans</Button>
</header>

<style>
  .breadcrumb { display: flex; gap: 0.4rem; margin-bottom: 0.8rem; color: var(--color-text-muted); font-size: 0.78rem; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .title-row { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
  h1 { margin: 0; color: var(--color-text); font-size: 1.75rem; letter-spacing: -0.025em; }
  p { margin: 0.35rem 0 0; color: var(--color-text-muted); font-size: 0.88rem; }
</style>

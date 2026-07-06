<script lang="ts">
  import BentoCard from '$lib/components/BentoCard.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  export type SquadRange = '7d' | '30d' | '90d' | 'custom';
  let { overview, range, group, start, end, onRange, onGroup, onCustom }: { overview: SquadQualityOverview; range: SquadRange; group: 'daily' | 'weekly' | 'monthly'; start: string; end: string; onRange: (range: SquadRange) => void; onGroup: (group: 'daily' | 'weekly' | 'monthly') => void; onCustom: (start: string, end: string) => void } = $props();
  const values = $derived(overview.trend.flatMap((point) => [point.coveragePercent, point.passRatePercent]).filter((value): value is number => value != null));
  const minimum = $derived(values.length > 0 && Math.min(...values) >= 80 ? 75 : 0);
  const chartData = $derived({ labels: overview.trend.map((point) => point.date.slice(5)), datasets: [{ label: 'Coverage %', data: overview.trend.map((point) => point.coveragePercent), borderColor: '#14b8a6', backgroundColor: '#14b8a6', fill: false, tension: 0.35, yAxisID: 'y' }, { label: 'Pass rate %', data: overview.trend.map((point) => point.passRatePercent), borderColor: '#6366f1', backgroundColor: '#6366f1', fill: false, tension: 0.35, yAxisID: 'y', spanGaps: false }] });
  const insight = $derived.by(() => {
    if (overview.trend.length < 2) return 'Not enough trend data yet.';
    const first = overview.trend[0].coveragePercent;
    const last = overview.trend.at(-1)?.coveragePercent ?? null;
    if (first == null || last == null) return 'Coverage evidence is unavailable for this period.';
    const change = last - first;
    if (Math.abs(change) < 0.01) return `Coverage stayed at ${last.toFixed(0)}%.`;
    return `Coverage ${change > 0 ? 'improved' : 'dropped'} by ${Math.abs(change).toFixed(1)} points.`;
  });
</script>

<BentoCard title="Quality trend" subtitle="Coverage and pass rate over the selected period">
  {#snippet headerActions()}<div class="controls"><div class="presets">{#each ['7d', '30d', '90d', 'custom'] as option}<button class:active={range === option} onclick={() => onRange(option as SquadRange)}>{option === 'custom' ? 'Custom' : option.toUpperCase()}</button>{/each}</div><select aria-label="Group trend" value={group} onchange={(event) => onGroup(event.currentTarget.value as typeof group)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>{/snippet}
  {#if range === 'custom'}<div class="custom"><label>Start<input type="date" value={start} onchange={(event) => onCustom(event.currentTarget.value, end)} /></label><label>End<input type="date" value={end} onchange={(event) => onCustom(start, event.currentTarget.value)} /></label></div>{/if}
  {#if overview.trend.length > 0}<LineChart {chartData} height={250} label="Squad quality trend" percentMinimum={minimum} />{:else}<p class="empty">No trend data yet.</p>{/if}
  <p class="insight">{insight}</p>
</BentoCard>

<style>
  .controls, .presets, .custom { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  button, select, input { min-height: 2rem; border: 1px solid var(--color-border); border-radius: 0.4rem; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.72rem; }
  button { padding: 0 0.55rem; cursor: pointer; } button.active { background: var(--color-accent-subtle); color: var(--color-accent); }
  .custom { margin-bottom: 0.7rem; } .custom label { display: grid; gap: 0.2rem; color: var(--color-text-muted); font-size: 0.68rem; }
  .insight, .empty { margin: 0; color: var(--color-text-muted); font-size: 0.78rem; }
</style>

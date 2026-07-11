<script lang="ts">
  import BentoCard from '$lib/components/BentoCard.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import type { SquadQualityOverview } from '$lib/api/statistics';
  export type SquadRange = '7d' | '30d' | '90d' | 'custom';

  let { overview, range, group, start, end, onRange, onGroup, onCustom }: {
    overview: SquadQualityOverview;
    range: SquadRange;
    group: 'daily' | 'weekly' | 'monthly';
    start: string;
    end: string;
    onRange: (range: SquadRange) => void;
    onGroup: (group: 'daily' | 'weekly' | 'monthly') => void;
    onCustom: (start: string, end: string) => void;
  } = $props();

  const values = $derived(
    overview.trend.flatMap((p) => [p.coveragePercent, p.passRatePercent]).filter((v): v is number => v != null)
  );
  const minimum = $derived(values.length > 0 && Math.min(...values) >= 80 ? 75 : 0);
  const chartData = $derived({
    labels: overview.trend.map((p) => p.date.slice(5)),
    datasets: [
      {
        label: 'Coverage %',
        data: overview.trend.map((p) => p.coveragePercent),
        borderColor: '#14b8a6',
        backgroundColor: '#14b8a6',
        fill: 'origin',
        tension: 0.38,
        yAxisID: 'y'
      },
      {
        label: 'Pass rate %',
        data: overview.trend.map((p) => p.passRatePercent),
        borderColor: '#6366f1',
        backgroundColor: '#6366f1',
        fill: 'origin',
        tension: 0.38,
        yAxisID: 'y',
        spanGaps: false
      }
    ]
  });

  const insight = $derived.by(() => {
    if (overview.trend.length < 2) return 'Not enough trend data for this period.';
    const first = overview.trend[0].coveragePercent;
    const last = overview.trend.at(-1)?.coveragePercent ?? null;
    if (first == null || last == null) return 'Coverage evidence is unavailable for this period.';
    const change = last - first;
    if (Math.abs(change) < 0.01) return `Coverage held steady at ${last.toFixed(0)}%.`;
    return `Coverage ${change > 0 ? 'improved' : 'dropped'} by ${Math.abs(change).toFixed(1)} points over this period.`;
  });
</script>

<BentoCard title="Quality trend" subtitle="Coverage and pass rate over the selected period">
  <div class="toolbar">
    <div class="presets">
      {#each (['7d', '30d', '90d', 'custom'] as const) as opt}
        <button class:active={range === opt} onclick={() => onRange(opt)}>
          {opt === 'custom' ? 'Custom' : opt.toUpperCase()}
        </button>
      {/each}
    </div>
    <div class="toolbar-right">
      {#if range === 'custom'}
        <div class="date-fields">
          <label class="date-field">
            <span>From</span>
            <input
              type="date"
              value={start}
              max={end || undefined}
              onchange={(e) => onCustom(e.currentTarget.value, end)}
            />
          </label>
          <label class="date-field">
            <span>To</span>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onchange={(e) => onCustom(start, e.currentTarget.value)}
            />
          </label>
        </div>
      {/if}
      <select
        aria-label="Group by period"
        value={group}
        onchange={(e) => onGroup(e.currentTarget.value as typeof group)}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
  </div>

  {#if overview.trend.length > 0}
    <LineChart {chartData} height={240} label="" percentMinimum={minimum} />
  {:else}
    <p class="empty">No trend data yet for this period.</p>
  {/if}

  <div class="insight-bar">
    <svg class="insight-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
    <span class="insight-label">Trend insight</span>
    <span class="insight-sep" aria-hidden="true">·</span>
    <span class="insight-text">{insight}</span>
  </div>
</BentoCard>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding: 0.45rem 0.6rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.6rem;
  }

  .presets {
    display: flex;
    gap: 0.25rem;
  }

  .presets button {
    padding: 0.28rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .presets button.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  }

  .presets button:hover:not(.active) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .date-fields {
    display: flex;
    gap: 0.4rem;
  }

  .date-field {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .date-field input {
    height: 1.9rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.7rem;
    padding: 0 0.4rem;
  }

  select {
    height: 1.9rem;
    padding: 0 0.55rem;
    border: 1px solid var(--color-border);
    border-radius: 0.35rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.7rem;
    cursor: pointer;
  }

  .empty {
    margin: 1.5rem 0;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .insight-bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.6rem;
    padding: 0.5rem 0.7rem;
    background: color-mix(in srgb, var(--color-info) 7%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-info) 20%, var(--color-border));
    border-radius: 0.45rem;
  }

  .insight-icon {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    color: var(--color-info);
  }

  .insight-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-info);
    white-space: nowrap;
  }

  .insight-sep {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .insight-text {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }
</style>

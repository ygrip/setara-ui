<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, Svg, Calendar } from 'layerchart';
  import type { HeatmapDay } from '$lib/api/runs';

  let { days = [], weeks = 26 }: { days: HeatmapDay[]; weeks?: number } = $props();

  const CELL = 11;
  const GAP = 3;
  const CELL_TOTAL = CELL + GAP; // 14
  const CHART_HEIGHT = 7 * CELL_TOTAL + 24; // 122px

  // Date helpers
  function parseLocalDate(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Build start/end dates reactively so `weeks` prop is tracked
  const endDate = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    const daysToSat = (6 - end.getDay() + 7) % 7;
    end.setDate(end.getDate() + daysToSat);
    return end;
  });

  const startDate = $derived.by(() => {
    const start = new Date(endDate);
    start.setDate(start.getDate() - weeks * 7 + 1);
    return start;
  });

  // Build chart data: parse dates as local midnight to match d3 timeDays
  const chartData = $derived(
    days.map(d => ({
      date: parseLocalDate(d.date),
      runCount: d.runCount,
      passedRuns: d.passedRuns,
      failedRuns: d.failedRuns,
      passRate: d.passRate
    }))
  );

  // Dark mode detection
  let isDark = $state(false);
  onMount(() => {
    const check = () => { isDark = document.documentElement.dataset.theme === 'dark'; };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  const emptyColor = $derived(isDark ? '#1e293b' : '#e2e8f0');

  function cellColor(data: unknown): string {
    if (!data || typeof data !== 'object') return emptyColor;
    const d = data as Record<string, unknown>;
    if (!('runCount' in d) || (d.runCount as number) === 0) return emptyColor;
    const rate = d.passRate as number;
    if (rate >= 85) return '#16a34a';
    if (rate >= 65) return '#4ade80';
    if (rate >= 45) return '#fde68a';
    if (rate >= 20) return '#fb923c';
    return '#ef4444';
  }

  function cellTitle(data: unknown): string {
    if (!data || typeof data !== 'object') return '';
    const d = data as Record<string, unknown>;
    if (!('runCount' in d) || (d.runCount as number) === 0) return 'No runs';
    return `${d.runCount} run(s) · ${Math.round(d.passRate as number)}% pass rate`;
  }

  // Day labels: Mon=1, Wed=3, Fri=5 → y positions in 0-indexed day (Sun=0)
  const dayLabels = [
    { label: 'Mon', day: 1 },
    { label: 'Wed', day: 3 },
    { label: 'Fri', day: 5 },
  ];
</script>

<div class="heatmap-root">
  <div class="chart-wrap" style="height: {CHART_HEIGHT}px">
    <Chart
      data={chartData}
      x={(d: { date: Date }) => d.date}
      padding={{ top: 22, left: 30, right: 4, bottom: 4 }}
    >
      <Svg>
        <!-- Day-of-week labels -->
        {#each dayLabels as { label, day }}
          <text
            x={-6}
            y={day * CELL_TOTAL + CELL / 2 + 3}
            class="day-label"
            fill={isDark ? '#94a3b8' : '#64748b'}
            text-anchor="end"
            dominant-baseline="middle"
            font-size="9"
            font-family="inherit"
          >{label}</text>
        {/each}

        <!-- Calendar cells -->
        <Calendar start={startDate} end={endDate} cellSize={CELL_TOTAL} monthPath={true} let:cells>
          {#each cells as cell}
            <rect
              x={cell.x + GAP / 2}
              y={cell.y + GAP / 2}
              width={CELL}
              height={CELL}
              rx={2}
              ry={2}
              fill={cellColor(cell.data)}
            >
              <title>{cellTitle(cell.data)}</title>
            </rect>
          {/each}
        </Calendar>
      </Svg>
    </Chart>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="legend-swatch" style="background: {emptyColor}"></span>
    <span class="legend-label">No runs</span>
    <span class="legend-sep"></span>
    <span class="legend-label legend-label--dim">Low</span>
    <span class="legend-swatch" style="background: #ef4444"></span>
    <span class="legend-swatch" style="background: #fb923c"></span>
    <span class="legend-swatch" style="background: #fde68a"></span>
    <span class="legend-swatch" style="background: #4ade80"></span>
    <span class="legend-swatch" style="background: #16a34a"></span>
    <span class="legend-label legend-label--dim">High pass rate</span>
  </div>
</div>

<style>
  .heatmap-root {
    width: 100%;
    overflow-x: auto;
  }

  .chart-wrap {
    position: relative;
    width: 100%;
    min-width: 360px;
  }

  /* layerchart Text component renders month labels with class="text-xs" which may not have Tailwind,
     so we style SVG text globally within our component via :global */
  .chart-wrap :global(.layercake-layout-svg text) {
    font-family: inherit;
    font-size: 9px;
    fill: #64748b;
  }

  .chart-wrap :global(.text-xs) {
    font-size: 9px;
  }

  .day-label {
    pointer-events: none;
    user-select: none;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .legend-label {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    margin: 0 2px;
  }

  .legend-label--dim {
    opacity: 0.8;
  }

  .legend-swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-sep {
    display: inline-block;
    width: 10px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, Svg, Calendar } from 'layerchart';
  import { timeWeek, timeMonths } from 'd3-time';
  import { format } from 'date-fns';
  import type { HeatmapDay } from '$lib/api/runs';

  let { days = [], weeks = 26 }: { days: HeatmapDay[]; weeks?: number } = $props();

  const TOP_PAD  = 20;
  const LEFT_PAD = 28;

  // ── Fixed vertical metrics → card height NEVER changes ───────────
  // Row height is constant regardless of selected period.
  const CELL_H = 13;           // cell height (px), fixed
  const GAP_H  = 3;            // vertical gap between rows, fixed
  const CTH    = CELL_H + GAP_H; // row pitch = 16 px, fixed
  const CHART_H = TOP_PAD + 7 * CTH; // = 132 px — constant for all periods

  // ── Variable horizontal metrics → columns fill the card width ────
  // Cell width expands/shrinks so that numWeeks columns fill the container.
  // Only the column width changes when the period selector is toggled.
  const GAP_W = 2; // horizontal gap between columns
  let containerWidth = $state(0);

  // ── Date range ──────────────────────────────────────────────────
  const startDate = $derived.by(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = new Date(t);
    d.setDate(d.getDate() - weeks * 7);
    d.setDate(d.getDate() - d.getDay()); // snap to Sunday
    return d;
  });

  const endDate = $derived.by(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = new Date(t);
    d.setDate(d.getDate() + (6 - d.getDay())); // snap to Saturday
    return d;
  });

  const numWeeks = $derived(timeWeek.count(startDate, endDate) + 1);

  // CTW = column pitch derived from measured container width.
  // Min 10 px so 6 M cells never become invisible.
  // Falls back to 16 during SSR / before first measure.
  const CTW = $derived.by(() => {
    if (containerWidth <= LEFT_PAD + 20) return 16;
    const available = containerWidth - LEFT_PAD - 4;
    return Math.max(10, Math.floor(available / numWeeks));
  });
  const CELL_W = $derived(CTW - GAP_W);

  // ── Data ────────────────────────────────────────────────────────
  function localDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const chartData = $derived(
    days.map(d => ({
      date:       localDate(d.date),
      runCount:   d.runCount,
      passedRuns: d.passedRuns,
      failedRuns: d.failedRuns,
      passRate:   d.passRate
    }))
  );

  // Month labels — x position uses CTW, y is fixed in the top-pad area
  const monthLabels = $derived(
    timeMonths(startDate, endDate).map((md: Date) => ({
      label: format(md, 'MMM'),
      col:   timeWeek.count(startDate, md)
    }))
  );

  // ── Dark mode ────────────────────────────────────────────────────
  let isDark = $state(false);
  onMount(() => {
    const sync = () => { isDark = document.documentElement.dataset.theme === 'dark'; };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  // ── Colour helpers ───────────────────────────────────────────────
  const EMPTY    = $derived(isDark ? '#1e293b' : '#e2e8f0');
  const FONT_CLR = $derived(isDark ? '#94a3b8' : '#64748b');

  function cellColor(data: unknown): string {
    if (!data || typeof data !== 'object') return EMPTY;
    const d = data as Record<string, unknown>;
    if (!('runCount' in d) || (d.runCount as number) === 0) return EMPTY;
    const r = d.passRate as number;
    if (r >= 85) return '#16a34a';
    if (r >= 65) return '#4ade80';
    if (r >= 45) return '#fde68a';
    if (r >= 20) return '#fb923c';
    return '#ef4444';
  }

  function cellTitle(data: unknown, date: Date): string {
    const ds = date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    if (!data || typeof data !== 'object') return `${ds} — No runs`;
    const d = data as Record<string, unknown>;
    if (!('runCount' in d) || (d.runCount as number) === 0) return `${ds} — No runs`;
    return `${ds}\n${d.runCount} run(s) · ${Math.round(d.passRate as number)}% pass`;
  }

  // Day-of-week labels; show Mon/Wed/Fri only
  const DOW_LABELS = [
    { label: 'Mon', row: 1 },
    { label: 'Wed', row: 3 },
    { label: 'Fri', row: 5 }
  ];
</script>

<div class="heatmap-root">
  <!--
    CHART_H is a plain constant (132 px) so the card height is the same
    for 1 M, 3 M and 6 M. Only the column width changes.
  -->
  <div class="chart-wrap" style="height: {CHART_H}px" bind:clientWidth={containerWidth}>
    <Chart
      data={chartData}
      x={(d: { date: Date }) => d.date}
      padding={{ top: TOP_PAD, left: LEFT_PAD, right: 2, bottom: 2 }}
    >
      <Svg>
        <!-- Month labels — x keyed to CTW so they track column width -->
        {#each monthLabels as ml}
          <text
            x={ml.col * CTW + CTW / 2}
            y={-5}
            font-size="9"
            fill={FONT_CLR}
            text-anchor="middle"
            dominant-baseline="auto"
            font-family="inherit"
          >{ml.label}</text>
        {/each}

        <!-- Day-of-week labels — y keyed to fixed CTH -->
        {#each DOW_LABELS as { label, row }}
          <text
            x={-5}
            y={row * CTH + CTH / 2}
            font-size="9"
            fill={FONT_CLR}
            text-anchor="end"
            dominant-baseline="middle"
            font-family="inherit"
          >{label}</text>
        {/each}

        <!--
          Calendar provides the InternMap-keyed cells array.
          We override every cell's position: col uses CTW (variable width),
          row uses CTH (fixed height). Cross-year positioning is correct
          because we count weeks from our own startDate, not timeYear(date).
        -->
        <Calendar start={startDate} end={endDate} cellSize={CTH} let:cells>
          {#each cells as cell}
            {@const d = (cell.data as Record<string, unknown>).date as Date}
            {@const col = Math.max(0, timeWeek.count(startDate, d))}
            {@const row = d.getDay()}
            <rect
              x={col * CTW + 1}
              y={row * CTH + 1}
              width={CELL_W}
              height={CELL_H}
              rx={2}
              ry={2}
              fill={cellColor(cell.data)}
            ><title>{cellTitle(cell.data, d)}</title></rect>
          {/each}
        </Calendar>
      </Svg>
    </Chart>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="swatch" style="background:{EMPTY}"></span>
    <span class="leg-label">No runs</span>
    <span class="leg-sep"></span>
    <span class="leg-label leg-dim">Low</span>
    {#each ['#ef4444','#fb923c','#fde68a','#4ade80','#16a34a'] as c}
      <span class="swatch" style="background:{c}"></span>
    {/each}
    <span class="leg-label leg-dim">High pass</span>
  </div>
</div>

<style>
  .heatmap-root {
    width: 100%;
    min-width: 0;
  }

  .chart-wrap {
    position: relative;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }

  /* layerchart renders an inner div with class layercake-layout-svg */
  .chart-wrap :global(.layercake-layout-svg text) {
    font-family: inherit;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .leg-label {
    font-size: 0.67rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    margin: 0 2px;
  }

  .leg-dim { opacity: 0.75; }

  .leg-sep { display: inline-block; width: 8px; }

  .swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex-shrink: 0;
  }
</style>

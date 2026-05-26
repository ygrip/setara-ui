<script lang="ts">
  export interface HeatmapDay {
    date: string;       // YYYY-MM-DD
    runCount: number;
    passedRuns: number;
    failedRuns: number;
    passRate: number;   // 0–100
  }

  let {
    days = [],
    weeks = 26
  }: {
    days: HeatmapDay[];
    weeks?: number;
  } = $props();

  // Fast date→data lookup
  const dayMap = $derived(new Map(days.map(d => [d.date, d])));

  // Build week columns (Mon–Sun rows), newest week last = right side
  const weekCols = $derived.by((): Date[][] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Walk back to the Monday that starts our window
    const start = new Date(today);
    start.setDate(start.getDate() - weeks * 7 + 1);
    // Snap to previous Monday (or stay if already Monday)
    const dow = start.getDay(); // 0=Sun
    const toMon = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - toMon);

    const cols: Date[][] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(cur);
        if (day <= today) week.push(day);
        cur.setDate(cur.getDate() + 1);
      }
      if (week.length > 0) cols.push(week);
    }
    return cols;
  });

  // Month label chips: only when the month changes at the start of a week
  const monthLabels = $derived.by((): { label: string; colIndex: number }[] => {
    const labels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < weekCols.length; i++) {
      const week = weekCols[i];
      if (week.length === 0) continue;
      // Use the Monday of the week (index 0) to determine month
      const m = week[0].getMonth();
      if (m !== lastMonth) {
        labels.push({
          label: week[0].toLocaleDateString('en-GB', { month: 'short' }),
          colIndex: i
        });
        lastMonth = m;
      }
    }
    return labels;
  });

  function toIso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // Color: green intensity for all-pass, amber/orange for mixed, red for all-fail
  function cellClass(d: Date): string {
    const iso = toIso(d);
    const data = dayMap.get(iso);
    if (!data || data.runCount === 0) return 'c-none';
    if (data.failedRuns === 0) {
      // All passed — scale green by run count
      if (data.runCount >= 5) return 'c-p5';
      if (data.runCount >= 3) return 'c-p3';
      if (data.runCount >= 2) return 'c-p2';
      return 'c-p1';
    }
    // Some failures
    if (data.passRate >= 80) return 'c-mx-hi';
    if (data.passRate >= 50) return 'c-mx-lo';
    return 'c-fail';
  }

  function cellTitle(d: Date): string {
    const iso = toIso(d);
    const data = dayMap.get(iso);
    const dateStr = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
    if (!data || data.runCount === 0) return `${dateStr} — No runs`;
    const pr = data.passRate.toFixed(0);
    return `${dateStr}\n${data.runCount} run${data.runCount > 1 ? 's' : ''} · ${pr}% pass · ${data.failedRuns} failed`;
  }

  // Day-of-week labels shown on rows 1, 3, 5 (Mon, Wed, Fri)
  const rowLabels: Array<{ label: string; row: number }> = [
    { label: 'Mon', row: 1 },
    { label: 'Wed', row: 3 },
    { label: 'Fri', row: 5 }
  ];
</script>

<div class="heatmap-root">
  <!-- Month headers -->
  <div class="month-header-row">
    <!-- Empty space matching the day-label column -->
    <div class="day-label-spacer"></div>
    <!-- Month chips positioned by CSS grid -->
    <div class="month-cols" style="--n: {weekCols.length}">
      {#each monthLabels as ml}
        <span class="month-chip" style="grid-column: {ml.colIndex + 1}">{ml.label}</span>
      {/each}
    </div>
  </div>

  <!-- Heatmap body: day labels + cell grid -->
  <div class="heatmap-body">
    <!-- Day-of-week labels -->
    <div class="day-axis">
      {#each rowLabels as r}
        <span class="day-label" style="grid-row: {r.row}">{r.label}</span>
      {/each}
    </div>

    <!-- Scrollable cell grid -->
    <div class="heatmap-scroll">
      <div class="cell-grid" style="--n: {weekCols.length}">
        {#each weekCols as week, wi}
          {#each week as day, di}
            <div
              class="cell {cellClass(day)}"
              title={cellTitle(day)}
              style="grid-column: {wi + 1}; grid-row: {di + 1}"
            ></div>
          {/each}
        {/each}
      </div>
    </div>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="legend-text">No runs</span>
    <div class="cell c-none legend-cell" title="No runs"></div>
    <div class="cell c-p1 legend-cell" title="1 run, all passed"></div>
    <div class="cell c-p2 legend-cell" title="2 runs, all passed"></div>
    <div class="cell c-p3 legend-cell" title="3+ runs, all passed"></div>
    <div class="cell c-p5 legend-cell" title="5+ runs, all passed"></div>
    <span class="legend-sep"></span>
    <div class="cell c-mx-hi legend-cell" title="Mixed (≥80% pass)"></div>
    <div class="cell c-mx-lo legend-cell" title="Mixed (<80% pass)"></div>
    <span class="legend-text">Partial fail</span>
    <span class="legend-sep"></span>
    <div class="cell c-fail legend-cell" title="All failed"></div>
    <span class="legend-text">All fail</span>
  </div>
</div>

<style>
  /* ── Layout ── */
  .heatmap-root {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .month-header-row {
    display: flex;
    align-items: flex-end;
    gap: 0;
  }

  .day-label-spacer {
    width: 28px;
    flex-shrink: 0;
  }

  .month-cols {
    display: grid;
    grid-template-columns: repeat(var(--n), 15px);
    column-gap: 3px;
    flex: 1;
    overflow: hidden;
  }

  .month-chip {
    font-size: 0.62rem;
    color: var(--color-text-muted);
    font-weight: 600;
    white-space: nowrap;
    line-height: 1;
  }

  .heatmap-body {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .day-axis {
    width: 22px;
    flex-shrink: 0;
    display: grid;
    grid-template-rows: repeat(7, 12px);
    row-gap: 3px;
    align-items: center;
  }

  .day-label {
    font-size: 0.6rem;
    color: var(--color-text-muted);
    text-align: right;
    line-height: 1;
    white-space: nowrap;
  }

  .heatmap-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
  }

  .cell-grid {
    display: grid;
    grid-template-columns: repeat(var(--n), 12px);
    grid-template-rows: repeat(7, 12px);
    gap: 3px;
    width: fit-content;
  }

  /* ── Cells ── */
  .cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    cursor: default;
    transition: opacity 0.1s;
  }

  .cell:hover { opacity: 0.8; }

  /* Color classes — light mode */
  .c-none  { background: #e2e8f0; }
  /* All-pass green scale */
  .c-p1    { background: #bbf7d0; }
  .c-p2    { background: #4ade80; }
  .c-p3    { background: #16a34a; }
  .c-p5    { background: #14532d; }
  /* Mixed */
  .c-mx-hi { background: #fde68a; }
  .c-mx-lo { background: #fb923c; }
  /* All fail */
  .c-fail  { background: #ef4444; }

  /* Dark mode */
  :global([data-theme="dark"]) .c-none  { background: #1e293b; }
  :global([data-theme="dark"]) .c-p1    { background: #052e16; }
  :global([data-theme="dark"]) .c-p2    { background: #14532d; }
  :global([data-theme="dark"]) .c-p3    { background: #16a34a; }
  :global([data-theme="dark"]) .c-p5    { background: #4ade80; }
  :global([data-theme="dark"]) .c-mx-hi { background: #78350f; }
  :global([data-theme="dark"]) .c-mx-lo { background: #9a3412; }
  :global([data-theme="dark"]) .c-fail  { background: #7f1d1d; }

  /* ── Legend ── */
  .legend {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 28px;
    flex-wrap: wrap;
  }

  .legend-text {
    font-size: 0.62rem;
    color: var(--color-text-muted);
    margin: 0 2px;
    white-space: nowrap;
  }

  .legend-cell {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    cursor: default;
  }

  .legend-sep {
    display: inline-block;
    width: 6px;
  }
</style>

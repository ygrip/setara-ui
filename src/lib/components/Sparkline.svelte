<script lang="ts">
  let {
    values
  }: {
    values: number[];
  } = $props();

  const computed = $derived.by(() => {
    if (values.length < 2) return null;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum;
    const pts = values.map((value, index) => {
      const x = +((index / (values.length - 1)) * 100).toFixed(2);
      // When all values are equal, position proportionally in [0,100] so a flat
      // 100% line sits at the top and 0% sits at the bottom (not all at bottom).
      const normalized = range < 1 ? value / 100 : (value - minimum) / range;
      const y = +(26 - normalized * 22).toFixed(2);
      return { x, y };
    });
    const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const areaPath = `M ${firstX},30 ` + pts.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${lastX},30 Z`;
    return { linePoints, areaPath };
  });
</script>

{#if computed}
  <svg
    class="sparkline"
    viewBox="0 0 100 30"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path class="sparkline-area" d={computed.areaPath} />
    <polyline class="sparkline-line" points={computed.linePoints} fill="none" vector-effect="non-scaling-stroke" />
  </svg>
{/if}

<style>
  .sparkline {
    display: block;
    width: 100%;
    height: 30px;
    overflow: visible;
  }

  .sparkline-area {
    fill: currentColor;
    opacity: 0.14;
    stroke: none;
  }

  .sparkline-line {
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 3 3;
  }
</style>

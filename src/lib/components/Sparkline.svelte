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
    const range = Math.max(maximum - minimum, 1);
    const pts = values.map((value, index) => {
      const x = +((index / (values.length - 1)) * 100).toFixed(2);
      const y = +(26 - ((value - minimum) / range) * 22).toFixed(2);
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
    <defs>
      <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color: currentColor; stop-opacity: 0.22;" />
        <stop offset="100%" style="stop-color: currentColor; stop-opacity: 0;" />
      </linearGradient>
    </defs>
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
    fill: url(#sparkline-fill);
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

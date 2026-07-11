<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart, LineController, LineElement, PointElement, BarController, BarElement,
    LinearScale, CategoryScale, Tooltip, Filler, Legend
  } from 'chart.js';
  import {
    decorateCartesianData,
    chartGlowPlugin,
    createCartesianScales,
    readChartTheme,
    refreshChartTheme,
    type CartesianAxisMode,
    type ChartDataInput
  } from './chartTheme';

  Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Filler, Legend);

  let {
    chartData,
    height = undefined,
    label = '',
    showLegend = true,
    axisMode = 'percent',
    percentMinimum = 0
  }: {
    chartData: ChartDataInput;
    /** Fixed height in px. Omit (or leave undefined) to fill the parent via CSS height:100%. */
    height?: number;
    label?: string;
    showLegend?: boolean;
    axisMode?: CartesianAxisMode;
    percentMinimum?: number;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let themeObserver: MutationObserver | null = null;

  function syncChart() {
    if (!chart) return;
    const theme = readChartTheme(canvas);
    chart.data = decorateCartesianData(chartData, theme) as any;
    chart.options.scales = createCartesianScales(theme, axisMode, percentMinimum);
    refreshChartTheme(chart, theme);
    for (const scale of Object.values(chart.options.scales ?? {})) {
      if (!scale) continue;
      if (scale.ticks) scale.ticks.color = theme.text;
      if (scale.grid) scale.grid.color = theme.grid;
    }
    chart.update();
  }

  onMount(() => {
    const theme = readChartTheme(canvas);
    chart = new Chart(canvas, {
      type: 'line',
      data: decorateCartesianData(chartData, theme) as any,
      plugins: [chartGlowPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 550, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: showLegend,
            labels: { color: theme.text, boxWidth: 10, boxHeight: 10, padding: 18, usePointStyle: true }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: theme.tooltip,
            borderColor: theme.grid,
            borderWidth: 1,
            cornerRadius: 10,
            padding: 12,
            titleMarginBottom: 8,
            usePointStyle: true,
            boxPadding: 5
          }
        },
        scales: createCartesianScales(theme, axisMode, percentMinimum)
      }
    });
    themeObserver = new MutationObserver(syncChart);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => {
      themeObserver?.disconnect();
      chart?.destroy();
    };
  });

  $effect(() => {
    chartData;
    axisMode;
    percentMinimum;
    syncChart();
  });
</script>

<div class="chart-wrap" style={height !== undefined ? `height: ${height}px` : undefined}>
  {#if label}<p class="chart-label">{label}</p>{/if}
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  /* height: 100% fills parent when no inline height is set; overridden by inline style when height prop is provided */
  .chart-wrap { position: relative; width: 100%; height: 100%; margin-bottom: 16px; }
  .chart-label {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-text-muted);
    margin: 0 0 8px;
  }
</style>

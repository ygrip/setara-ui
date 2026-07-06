<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend, type Plugin } from 'chart.js';
  import {
    decorateDoughnutData,
    chartGlowPlugin,
    readChartTheme,
    refreshChartTheme,
    type ChartDataInput
  } from './chartTheme';

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  let {
    chartData,
    size = 220,
    label = '',
    legendPosition = 'bottom' as 'bottom' | 'right' | 'left' | 'top'
  }: {
    chartData: ChartDataInput;
    size?: number;
    label?: string;
    legendPosition?: 'bottom' | 'right' | 'left' | 'top';
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let themeObserver: MutationObserver | null = null;

  function syncChart() {
    if (!chart) return;
    const theme = readChartTheme(canvas);
    chart.data = decorateDoughnutData(chartData, theme) as any;
    refreshChartTheme(chart, theme);
    chart.update();
  }

  onMount(() => {
    const theme = readChartTheme(canvas);
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: decorateDoughnutData(chartData, theme) as any,
      plugins: [chartGlowPlugin as Plugin<'doughnut'>],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        animation: { duration: 650, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: legendPosition,
            labels: {
              color: theme.text,
              font: { size: 12 },
              padding: 18,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: theme.tooltip,
            borderColor: theme.grid,
            borderWidth: 1,
            cornerRadius: 10,
            padding: 12,
            usePointStyle: true,
            boxPadding: 5
          }
        }
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
    syncChart();
  });
</script>

<div class="donut-wrap" style="max-width:{size}px">
  {#if label}<p class="chart-label">{label}</p>{/if}
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
  .donut-wrap canvas {
    width: 100% !important;
    height: auto !important;
  }
  .chart-label {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0 0 12px;
  }
</style>

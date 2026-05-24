<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  let {
    chartData,
    size = 220,
    label = '',
    legendPosition = 'bottom' as 'bottom' | 'right' | 'left' | 'top'
  }: {
    chartData: { labels: string[]; datasets: object[] };
    size?: number;
    label?: string;
    legendPosition?: 'bottom' | 'right' | 'left' | 'top';
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: chartData as any,
      options: {
        responsive: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: legendPosition,
            labels: { color: '#7d9589', font: { size: 12 }, padding: 14, boxWidth: 13 }
          },
          tooltip: { enabled: true }
        }
      }
    });
    return () => chart?.destroy();
  });

  $effect(() => {
    if (!chart) return;
    chart.data = chartData as any;
    chart.update();
  });
</script>

<div class="donut-wrap">
  {#if label}<p class="chart-label">{label}</p>{/if}
  <canvas bind:this={canvas} width={size} height={size}></canvas>
</div>

<style>
  .donut-wrap { display: flex; flex-direction: column; align-items: center; }
  .chart-label {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0 0 12px;
  }
</style>

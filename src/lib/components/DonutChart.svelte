<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  let {
    chartData,
    size = 160,
    label = ''
  }: {
    chartData: { labels: string[]; datasets: object[] };
    size?: number;
    label?: string;
  } = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: chartData as any,
      options: {
        responsive: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#7d9589', font: { size: 12 }, padding: 12, boxWidth: 12 }
          },
          tooltip: { enabled: true }
        }
      }
    });
    return () => chart.destroy();
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

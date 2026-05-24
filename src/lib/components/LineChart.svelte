<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart, LineController, LineElement, PointElement, BarController, BarElement,
    LinearScale, CategoryScale, Tooltip, Filler, Legend
  } from 'chart.js';

  Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Filler, Legend);

  let {
    chartData,
    height = 200,
    label = ''
  }: {
    chartData: { labels: string[]; datasets: object[] };
    height?: number;
    label?: string;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: chartData as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#7d9589', boxWidth: 12 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#7d9589', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(125,149,137,0.12)' },
            ticks: { color: '#7d9589', font: { size: 11 } },
            min: 0
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#7d9589', font: { size: 11 }, callback: value => `${value}%` },
            min: 0,
            max: 100
          }
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

<div class="chart-wrap" style="height: {height}px">
  {#if label}<p class="chart-label">{label}</p>{/if}
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-wrap { position: relative; width: 100%; }
  .chart-label {
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-text-muted);
    margin: 0 0 8px;
  }
</style>

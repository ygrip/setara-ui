<script lang="ts">
  import { onMount } from 'svelte';
  import type { CartesianAxisMode, ChartDataInput } from './chartTheme';

  let {
    chartData,
    height = undefined,
    label = '',
    showLegend = true,
    axisMode = 'percent'
  }: {
    chartData: ChartDataInput;
    height?: number;
    label?: string;
    showLegend?: boolean;
    axisMode?: CartesianAxisMode;
  } = $props();

  let LineChartComponent = $state<any>(null);

  onMount(async () => {
    LineChartComponent = (await import('$lib/components/LineChart.svelte')).default;
  });
</script>

{#if LineChartComponent}
  <LineChartComponent {chartData} {height} {label} {showLegend} {axisMode} />
{:else}
  <div class="chart-skeleton" style={height !== undefined ? `height:${height}px` : undefined} aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
  </div>
{/if}

<style>
  .chart-skeleton {
    display: grid;
    align-items: end;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    width: 100%;
    height: 100%;
    min-height: 220px;
    padding: 18px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-surface), var(--color-border) 10%);
    overflow: hidden;
  }

  .chart-skeleton span {
    display: block;
    height: 42%;
    border-radius: 8px 8px 0 0;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--color-accent), transparent 40%),
      color-mix(in srgb, var(--color-border), transparent 45%)
    );
    animation: chart-skeleton-pulse 1.2s ease-in-out infinite;
  }

  .chart-skeleton span:nth-child(2) {
    height: 68%;
    animation-delay: 0.12s;
  }

  .chart-skeleton span:nth-child(3) {
    height: 54%;
    animation-delay: 0.24s;
  }

  @keyframes chart-skeleton-pulse {
    0%, 100% { opacity: 0.42; }
    50% { opacity: 0.78; }
  }
</style>

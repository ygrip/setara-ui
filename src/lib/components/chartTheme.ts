import type { Chart, ChartOptions, Plugin, ScriptableContext } from 'chart.js';

export type ChartDataInput = {
  labels: string[];
  datasets: Record<string, unknown>[];
};

export type ChartTheme = {
  text: string;
  grid: string;
  surface: string;
  tooltip: string;
};

export type CartesianAxisMode = 'percent' | 'mixed';

type GradientCache = {
  key: string;
  value: CanvasGradient;
};

const FALLBACK_COLORS = ['#00afa5', '#6366f1', '#f59e0b', '#22c55e', '#3b82f6'];

export const chartGlowPlugin = {
  id: 'setaraChartGlow',
  beforeDatasetDraw(chart) {
    const styles = getComputedStyle(chart.canvas);
    const accent = styles.getPropertyValue('--color-accent').trim() || '#00afa5';
    const dark = document.documentElement.dataset.theme === 'dark';
    chart.ctx.save();
    chart.ctx.shadowColor = withAlpha(accent, dark ? 0.3 : 0.17);
    chart.ctx.shadowBlur = dark ? 14 : 9;
  },
  afterDatasetDraw(chart) {
    chart.ctx.restore();
  }
} satisfies Plugin;

export function readChartTheme(canvas: HTMLCanvasElement): ChartTheme {
  const styles = getComputedStyle(canvas);
  const color = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    text: color('--color-text-muted', '#64748b'),
    grid: withAlpha(color('--color-border', '#cbd5e1'), 0.42),
    surface: color('--color-surface', '#ffffff'),
    tooltip: 'rgb(11 18 32 / 0.94)'
  };
}

export function decorateCartesianData(
  input: ChartDataInput,
  theme: ChartTheme
): ChartDataInput {
  return {
    labels: input.labels,
    datasets: input.datasets.map((dataset, index) => {
      const kind = dataset.type === 'bar' ? 'bar' : 'line';
      const borderBase = readColor(dataset.borderColor, 0) ??
        readColor(dataset.backgroundColor, 0) ??
        FALLBACK_COLORS[index % FALLBACK_COLORS.length];

      if (kind === 'bar') {
        const background = verticalGradient(borderBase, 1, 0.025);
        return {
          ...dataset,
          backgroundColor: background,
          borderColor: withAlpha(lighten(borderBase, 0.2), 0.72),
          borderWidth: dataset.borderWidth ?? 1,
          borderRadius: dataset.borderRadius ?? 6,
          borderSkipped: false,
          hoverBackgroundColor: verticalGradient(lighten(borderBase, 0.1), 1, 0.12)
        };
      }

      const fillBase = readColor(dataset.backgroundColor, 0) ?? borderBase;
      return {
        ...dataset,
        borderColor: horizontalGradient(borderBase),
        backgroundColor: verticalGradient(fillBase, 0.52, 0),
        borderWidth: dataset.borderWidth ?? 2.25,
        tension: dataset.tension ?? 0.38,
        pointRadius: dataset.pointRadius ?? 0,
        pointHoverRadius: dataset.pointHoverRadius ?? 5,
        pointHitRadius: dataset.pointHitRadius ?? 14,
        pointBackgroundColor: borderBase,
        pointBorderColor: theme.surface,
        pointBorderWidth: 2,
        pointHoverBackgroundColor: lighten(borderBase, 0.12),
        pointHoverBorderColor: theme.surface,
        pointHoverBorderWidth: 3
      };
    })
  };
}

export function decorateDoughnutData(
  input: ChartDataInput,
  theme: ChartTheme
): ChartDataInput {
  return {
    labels: input.labels,
    datasets: input.datasets.map((dataset) => {
      const source = dataset.backgroundColor;
      return {
        ...dataset,
        backgroundColor: verticalSegmentGradient(source),
        hoverBackgroundColor: verticalSegmentGradient(source, 0.1),
        borderColor: theme.surface,
        borderWidth: 3,
        borderRadius: 5,
        spacing: 2,
        hoverOffset: 7
      };
    })
  };
}

function verticalGradient(color: string, topAlpha: number, bottomAlpha: number) {
  let cache: GradientCache | undefined;
  return (context: ScriptableContext<'line' | 'bar'>): string | CanvasGradient => {
    const area = context.chart.chartArea;
    if (!area) return withAlpha(color, topAlpha);

    const key = `${area.top}:${area.bottom}:${color}:${topAlpha}:${bottomAlpha}`;
    if (cache?.key === key) return cache.value;

    const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, withAlpha(lighten(color, 0.3), topAlpha));
    gradient.addColorStop(0.1, withAlpha(lighten(color, 0.12), topAlpha * 0.96));
    gradient.addColorStop(0.56, withAlpha(color, Math.max(bottomAlpha, topAlpha * 0.5)));
    gradient.addColorStop(0.84, withAlpha(color, Math.max(bottomAlpha, topAlpha * 0.16)));
    gradient.addColorStop(1, withAlpha(darken(color, 0.18), bottomAlpha));
    cache = { key, value: gradient };
    return gradient;
  };
}

function horizontalGradient(color: string) {
  let cache: GradientCache | undefined;
  return (context: ScriptableContext<'line'>): string | CanvasGradient => {
    const area = context.chart.chartArea;
    if (!area) return color;

    const key = `${area.left}:${area.right}:${color}`;
    if (cache?.key === key) return cache.value;

    const gradient = context.chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, lighten(color, 0.16));
    gradient.addColorStop(1, lighten(color, 0.3));
    cache = { key, value: gradient };
    return gradient;
  };
}

function verticalSegmentGradient(source: unknown, lift = 0) {
  const cache = new Map<string, CanvasGradient>();
  return (context: ScriptableContext<'doughnut'>): string | CanvasGradient => {
    const color = readColor(source, context.dataIndex) ??
      FALLBACK_COLORS[context.dataIndex % FALLBACK_COLORS.length];
    const area = context.chart.chartArea;
    if (!area) return lighten(color, lift);

    const key = `${context.dataIndex}:${area.width}:${area.height}:${color}:${lift}`;
    const existing = cache.get(key);
    if (existing) return existing;

    const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, lighten(color, 0.44 + lift));
    gradient.addColorStop(0.22, lighten(color, 0.24 + lift));
    gradient.addColorStop(0.54, lighten(color, 0.08 + lift));
    gradient.addColorStop(0.78, withAlpha(color, 0.78));
    gradient.addColorStop(1, withAlpha(darken(color, 0.16), 0.28));
    cache.set(key, gradient);
    return gradient;
  };
}

function readColor(value: unknown, index: number): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  const item = value[index];
  return typeof item === 'string' ? item : undefined;
}

function withAlpha(color: string, alpha: number): string {
  const rgb = parseRgb(color);
  return rgb ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${alpha})` : color;
}

function lighten(color: string, amount: number): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * Math.min(amount, 1));
  return `rgb(${mix(rgb[0])} ${mix(rgb[1])} ${mix(rgb[2])})`;
}

function darken(color: string, amount: number): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const mix = (channel: number) => Math.round(channel * (1 - Math.min(amount, 1)));
  return `rgb(${mix(rgb[0])} ${mix(rgb[1])} ${mix(rgb[2])})`;
}

function parseRgb(color: string): [number, number, number] | undefined {
  const value = color.trim();
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) {
    return shortHex.slice(1).map((part) => parseInt(`${part}${part}`, 16)) as [number, number, number];
  }

  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i.exec(value);
  if (hex) {
    return hex.slice(1, 4).map((part) => parseInt(part, 16)) as [number, number, number];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (!rgb) return undefined;
  return rgb.slice(1, 4).map(Number) as [number, number, number];
}

export function refreshChartTheme(chart: Chart, theme: ChartTheme): void {
  const legend = chart.options.plugins?.legend;
  if (legend?.labels) legend.labels.color = theme.text;

  const tooltip = chart.options.plugins?.tooltip;
  if (tooltip) {
    tooltip.backgroundColor = theme.tooltip;
    tooltip.borderColor = theme.grid;
    tooltip.titleColor = '#ffffff';
    tooltip.bodyColor = '#e2e8f0';
  }
}

export function createCartesianScales(
  theme: ChartTheme,
  axisMode: CartesianAxisMode
): NonNullable<ChartOptions<'line'>['scales']> {
  const x = {
    grid: { display: false },
    border: { display: false },
    ticks: {
      color: theme.text,
      font: { size: 11 },
      padding: 8,
      maxRotation: 0,
      autoSkip: true,
      autoSkipPadding: 18
    }
  };
  const percentAxis = {
    type: 'linear' as const,
    border: { display: false },
    grid: { color: theme.grid, drawTicks: false },
    ticks: {
      color: theme.text,
      font: { size: 11 },
      padding: 10,
      callback: (value: string | number) => `${value}%`
    },
    min: 0,
    max: 100
  };

  if (axisMode === 'mixed') {
    return {
      x,
      yPercent: {
        ...percentAxis,
        position: 'left'
      },
      yVolume: {
        type: 'linear',
        display: 'auto',
        position: 'right',
        beginAtZero: true,
        border: { display: false },
        grid: { drawOnChartArea: false, drawTicks: false },
        ticks: {
          color: theme.text,
          font: { size: 11 },
          padding: 10,
          callback: (value: string | number) => compactChartNumber(Number(value))
        }
      }
    };
  }

  return {
    x,
    y: percentAxis,
    y1: {
      ...percentAxis,
      display: 'auto',
      position: 'right',
      grid: { drawOnChartArea: false, drawTicks: false }
    }
  };
}

export function compactChartNumber(value: number): string {
  if (Math.abs(value) < 1000) return value.toLocaleString('en-US');
  const compact = value / 1000;
  const digits = Math.abs(compact) >= 10 ? 0 : 1;
  return `${compact.toFixed(digits).replace(/\.0$/, '')}K`;
}

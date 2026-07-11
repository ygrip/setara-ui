import type { ChartDataInput } from './chartTheme';

export type QualityTrendPoint = {
  label: string;
  totalScenarios: number;
  passRate: number;
  automationCoverage: number;
};

export function createQualityTrendData(points: QualityTrendPoint[]): ChartDataInput {
  return {
    labels: points.map((point) => point.label),
    datasets: [
      {
        type: 'bar',
        label: 'Total scenarios',
        data: points.map((point) => point.totalScenarios),
        yAxisID: 'yVolume',
        backgroundColor: '#60a5fa',
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.72,
        categoryPercentage: 0.72,
        order: 3
      },
      {
        type: 'line',
        label: 'Pass rate %',
        data: points.map((point) => point.passRate),
        yAxisID: 'yPercent',
        borderColor: '#14b8a6',
        backgroundColor: '#14b8a6',
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.38,
        fill: 'origin',
        order: 1
      },
      {
        type: 'line',
        label: 'Automation coverage %',
        data: points.map((point) => point.automationCoverage),
        yAxisID: 'yPercent',
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.38,
        fill: false,
        order: 2
      }
    ]
  };
}

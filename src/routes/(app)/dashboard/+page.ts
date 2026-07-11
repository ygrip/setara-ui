import { getDashboard, type DashboardResponse } from '$lib/api/dashboard';

export const prerender = import.meta.env.VITE_MOCK === 'true';

export async function load() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  const chartStart = start.toISOString().slice(0, 10);
  const chartEnd = end.toISOString().slice(0, 10);
  try {
    const dashboard = await getDashboard({
      start: chartStart,
      end: chartEnd,
      group: 'daily',
      attentionLimit: 5
    });
    return {
      dashboard,
      chartStart,
      chartEnd,
      groupedBy: 'daily' as const,
      error: null
    };
  } catch (error) {
    return {
      dashboard: null as DashboardResponse | null,
      chartStart,
      chartEnd,
      groupedBy: 'daily' as const,
      error: (error as Error).message
    };
  }
}

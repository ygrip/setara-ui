import { listProjects, type Project } from '$lib/api/projects';
import {
  getDashboardSummary,
  listAggregateStatisticHistory,
  type AggregateStatisticPoint,
  type DashboardSummary
} from '$lib/api/statistics';

export const prerender = import.meta.env.VITE_MOCK === 'true';

export async function load() {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const startText = start.toISOString().slice(0, 10);
    const endText = end.toISOString().slice(0, 10);
    const [projectsResult, summary, aggregateHistory] = await Promise.all([
      listProjects(undefined, undefined, 'createdAt', 'desc'),
      getDashboardSummary(),
      listAggregateStatisticHistory(startText, endText, 'daily')
    ]);
    return {
      projects: projectsResult.items.slice(0, 5),
      summary,
      aggregateHistory,
      chartStart: startText,
      chartEnd: endText,
      groupedBy: 'daily' as const,
      nextCursor: projectsResult.nextCursor,
      error: null
    };
  } catch (e) {
    return {
      projects: [] as Project[],
      summary: null as DashboardSummary | null,
      aggregateHistory: [] as AggregateStatisticPoint[],
      chartStart: '',
      chartEnd: '',
      groupedBy: 'daily' as const,
      nextCursor: null,
      error: (e as Error).message
    };
  }
}

import { listProjectStatisticHistory, type ProjectStatistic } from '$lib/api/statistics';

export async function load({ params }: { params: { projectKey: string } }) {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const history = await listProjectStatisticHistory(params.projectKey, defaultStart, defaultEnd, 'daily');
    return { history, defaultStart, defaultEnd };
  } catch {
    return { history: [] as ProjectStatistic[], defaultStart, defaultEnd };
  }
}

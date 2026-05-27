import { listProjectStatisticHistory, type ProjectStatistic } from '$lib/api/statistics';

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const history = await listProjectStatisticHistory(params.projectKey, 30);
    return { history };
  } catch {
    return { history: [] as ProjectStatistic[] };
  }
}

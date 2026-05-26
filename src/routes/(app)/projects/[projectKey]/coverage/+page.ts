import { listProjectStatisticHistory, type ProjectStatistic } from '$lib/api/statistics';
import { listRuns, type AutomationRun } from '$lib/api/runs';

export async function load({ params }) {
  try {
    const [history, runsPage] = await Promise.all([
      listProjectStatisticHistory(params.projectKey, 30),
      listRuns(params.projectKey, undefined, 20)
    ]);
    return { history, runs: runsPage.items };
  } catch {
    return { history: [] as ProjectStatistic[], runs: [] as AutomationRun[] };
  }
}

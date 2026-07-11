import { getRun, listRunResults, type AutomationRun, type ScenarioRunResult } from '$lib/api/runs';
import { getIssueTrackerStatus } from '$lib/api/issues';

export async function load({ params }: { params: { projectKey: string; runId: string } }) {
  const { projectKey, runId } = params;
  try {
    const [run, results, issuesEnabled] = await Promise.all([
      getRun(projectKey, runId),
      listRunResults(projectKey, runId),
      getIssueTrackerStatus().then((s) => s.enabled).catch(() => false)
    ]);
    return { projectKey, runId, run, results, issuesEnabled, error: null };
  } catch (e) {
    return {
      projectKey,
      runId,
      run: null as AutomationRun | null,
      results: [] as ScenarioRunResult[],
      issuesEnabled: false,
      error: (e as Error).message
    };
  }
}

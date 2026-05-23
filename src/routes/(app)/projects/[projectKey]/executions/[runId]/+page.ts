import { getRun, listRunResults, type AutomationRun, type ScenarioRunResult } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string; runId: string } }) {
  const { projectKey, runId } = params;
  try {
    const [run, results] = await Promise.all([
      getRun(projectKey, runId),
      listRunResults(projectKey, runId)
    ]);
    return { projectKey, runId, run, results, error: null };
  } catch (e) {
    return {
      projectKey,
      runId,
      run: null as AutomationRun | null,
      results: [] as ScenarioRunResult[],
      error: (e as Error).message
    };
  }
}

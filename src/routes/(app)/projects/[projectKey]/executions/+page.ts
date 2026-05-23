import { listRuns, type AutomationRun } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  try {
    const runs = await listRuns(projectKey);
    return { projectKey, runs, error: null };
  } catch (e) {
    return { projectKey, runs: [] as AutomationRun[], error: (e as Error).message };
  }
}

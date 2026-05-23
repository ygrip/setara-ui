import { getRun, type AutomationRun } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string; runId: string } }) {
  const { projectKey, runId } = params;
  try {
    const run = await getRun(projectKey, runId);
    return { projectKey, runId, run, error: null };
  } catch (e) {
    return { projectKey, runId, run: null as AutomationRun | null, error: (e as Error).message };
  }
}

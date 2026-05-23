import { listRuns, type AutomationRun } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  try {
    const result = await listRuns(projectKey);
    return { projectKey, runs: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { projectKey, runs: [] as AutomationRun[], nextCursor: null, error: (e as Error).message };
  }
}

import { listRuns, type AutomationRun } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [build, runs] = await Promise.allSettled([
    import('$lib/api/builds').then(m => m.getBuild(projectKey, buildId)).catch(() => null),
    listRuns(projectKey).catch(() => ({ items: [], nextCursor: null, prevCursor: null }))
  ]);
  return {
    projectKey,
    buildId,
    build: build.status === 'fulfilled' ? build.value : null,
    runs: runs.status === 'fulfilled' ? (runs.value?.items ?? []) : [] as AutomationRun[]
  };
}

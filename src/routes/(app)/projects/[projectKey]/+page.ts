import { getProject, type Project } from '$lib/api/projects';
import { listRuns, type AutomationRun } from '$lib/api/runs';
import { listApiKeys, type ApiKey } from '$lib/api/apikeys';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;

  const [projectResult, runsResult, keysResult] = await Promise.allSettled([
    getProject(projectKey),
    listRuns(projectKey),
    listApiKeys(projectKey)
  ]);

  return {
    projectKey,
    project: projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null,
    runs: runsResult.status === 'fulfilled' ? runsResult.value.items : [] as AutomationRun[],
    apiKeys: keysResult.status === 'fulfilled' ? keysResult.value : [] as ApiKey[],
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

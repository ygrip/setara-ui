import { getProject, type Project } from '$lib/api/projects';
import { listRuns, type AutomationRun } from '$lib/api/runs';
import { listApiKeys, type ApiKey } from '$lib/api/apikeys';
import { listProjectStatisticHistory, type ProjectStatistic } from '$lib/api/statistics';
import { listBuilds, type ProjectBuild } from '$lib/api/builds';
import { listAllPlans, type ReleasePlan } from '$lib/api/plans';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;

  const [projectResult, runsResult, keysResult, statsResult, buildsResult] = await Promise.allSettled([
    getProject(projectKey),
    listRuns(projectKey),
    listApiKeys(projectKey),
    listProjectStatisticHistory(projectKey, 1),
    listBuilds(projectKey)
  ]);

  const project = projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null;
  const builds = buildsResult.status === 'fulfilled' ? buildsResult.value : [] as ProjectBuild[];
  const latestBuild = builds[0] ?? null;

  // Get latest plan for this project's squad
  let latestPlan: ReleasePlan | null = null;
  if (project?.squadId) {
    const plansResult = await listAllPlans(project.squadId).catch(() => null);
    latestPlan = plansResult?.items[0] ?? null;
  }

  return {
    projectKey,
    project,
    runs: runsResult.status === 'fulfilled' ? runsResult.value.items : [] as AutomationRun[],
    apiKeys: keysResult.status === 'fulfilled' ? keysResult.value : [] as ApiKey[],
    statistic: statsResult.status === 'fulfilled' ? (statsResult.value[0] ?? null) : null as ProjectStatistic | null,
    builds,
    latestBuild,
    latestPlan,
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

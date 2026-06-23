import { listDirectories, listScenarios, countScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;

  const [dirResult, scenariosResult, draftsResult, countResult] = await Promise.allSettled([
    listDirectories(projectKey, null, 'ACTIVE', true),
    listScenarios(projectKey, null, 'ACTIVE'),
    listScenarios(projectKey, null, 'DRAFT'),
    countScenarios(projectKey)
  ]);

  const directories = dirResult.status === 'fulfilled' ? dirResult.value : ([] as TestDirectory[]);
  const scenariosPage = scenariosResult.status === 'fulfilled' ? scenariosResult.value : { items: [] as Scenario[], nextCursor: null as string | null, prevCursor: null as string | null };
  const draftsPage = draftsResult.status === 'fulfilled' ? draftsResult.value : { items: [] as Scenario[], nextCursor: null as string | null, prevCursor: null as string | null };

  const scenarios = scenariosPage.items;
  const draftScenarios = draftsPage.items;
  const scenariosNextCursor = scenariosPage.nextCursor;
  const draftsNextCursor = draftsPage.nextCursor;
  const totalScenariosCount = countResult.status === 'fulfilled' ? countResult.value : null;

  const firstError =
    dirResult.status === 'rejected' ? (dirResult.reason as Error).message :
    scenariosResult.status === 'rejected' ? (scenariosResult.reason as Error).message :
    draftsResult.status === 'rejected' ? (draftsResult.reason as Error).message :
    null;

  return { projectKey, directories, scenarios, draftScenarios, scenariosNextCursor, draftsNextCursor, totalScenariosCount, error: firstError };
}

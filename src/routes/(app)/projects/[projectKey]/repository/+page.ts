import { listDirectories, listScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';

async function listRepositoryDirectories(projectKey: string, parentId: string | null = null): Promise<TestDirectory[]> {
  const directories = await listDirectories(projectKey, parentId);
  const childGroups = await Promise.all(
    directories.map((directory) => listRepositoryDirectories(projectKey, directory.id).catch(() => [] as TestDirectory[]))
  );
  return [...directories, ...childGroups.flat()];
}

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;

  const [dirResult, scenariosResult, draftsResult] = await Promise.allSettled([
    listRepositoryDirectories(projectKey),
    listScenarios(projectKey, null, 'ACTIVE'),
    listScenarios(projectKey, null, 'DRAFT')
  ]);

  const directories = dirResult.status === 'fulfilled' ? dirResult.value : ([] as TestDirectory[]);
  const scenarios = scenariosResult.status === 'fulfilled' ? scenariosResult.value : ([] as Scenario[]);
  const draftScenarios = draftsResult.status === 'fulfilled' ? draftsResult.value : ([] as Scenario[]);

  // Surface the first error encountered so the page can show an informative banner
  const firstError =
    dirResult.status === 'rejected' ? (dirResult.reason as Error).message :
    scenariosResult.status === 'rejected' ? (scenariosResult.reason as Error).message :
    draftsResult.status === 'rejected' ? (draftsResult.reason as Error).message :
    null;

  return { projectKey, directories, scenarios, draftScenarios, error: firstError };
}

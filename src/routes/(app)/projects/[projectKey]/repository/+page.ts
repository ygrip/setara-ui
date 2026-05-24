import { listDirectories, listScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';

async function listRepositoryDirectories(projectKey: string, parentId: string | null = null): Promise<TestDirectory[]> {
  const directories = await listDirectories(projectKey, parentId);
  const childGroups = await Promise.all(
    directories.map((directory) => listRepositoryDirectories(projectKey, directory.id).catch(() => [] as TestDirectory[]))
  );
  return [...directories, ...childGroups.flat()];
}

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const [directories, scenarios, draftScenarios] = await Promise.all([
      listRepositoryDirectories(params.projectKey),
      listScenarios(params.projectKey, null, 'ACTIVE'),
      listScenarios(params.projectKey, null, 'DRAFT')
    ]);
    return { projectKey: params.projectKey, directories, scenarios, draftScenarios, error: null };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      directories: [] as TestDirectory[],
      scenarios: [] as Scenario[],
      draftScenarios: [] as Scenario[],
      error: (e as Error).message
    };
  }
}

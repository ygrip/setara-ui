import { getBuild } from '$lib/api/builds';
import { listDirectories, listScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';

async function listAllDirectories(projectKey: string, parentId: string | null = null): Promise<TestDirectory[]> {
  const dirs = await listDirectories(projectKey, parentId);
  const childGroups = await Promise.all(
    dirs.map((d) => listAllDirectories(projectKey, d.id).catch(() => [] as TestDirectory[]))
  );
  return [...dirs, ...childGroups.flat()];
}

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [build, directories, scenarios] = await Promise.allSettled([
    getBuild(projectKey, buildId).catch(() => null),
    listAllDirectories(projectKey),
    listScenarios(projectKey, null, 'ACTIVE').catch(() => [] as Scenario[])
  ]);
  return {
    projectKey,
    buildId,
    build: build.status === 'fulfilled' ? build.value : null,
    directories: directories.status === 'fulfilled' ? directories.value : [] as TestDirectory[],
    scenarios: scenarios.status === 'fulfilled' ? scenarios.value : [] as Scenario[]
  };
}

import { listDirectories, type TestDirectory } from '$lib/api/testcases';
import { getProject, type Project } from '$lib/api/projects';

async function listRepositoryDirectories(projectKey: string, parentId: string | null = null): Promise<TestDirectory[]> {
  const directories = await listDirectories(projectKey, parentId);
  const childGroups = await Promise.all(
    directories.map((directory) => listRepositoryDirectories(projectKey, directory.id).catch(() => [] as TestDirectory[]))
  );
  return [...directories, ...childGroups.flat()];
}

export async function load({ params, url }: { params: { projectKey: string }; url: URL }) {
  try {
    const [directories, project] = await Promise.all([
      listRepositoryDirectories(params.projectKey),
      getProject(params.projectKey).catch(() => null as Project | null)
    ]);
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      directories,
      project,
      error: null
    };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      directories: [] as TestDirectory[],
      project: null as Project | null,
      error: (e as Error).message
    };
  }
}

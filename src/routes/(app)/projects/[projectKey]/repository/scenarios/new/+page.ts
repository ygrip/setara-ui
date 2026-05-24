import { listDirectories, type TestDirectory } from '$lib/api/testcases';

async function listRepositoryDirectories(projectKey: string, parentId: string | null = null): Promise<TestDirectory[]> {
  const directories = await listDirectories(projectKey, parentId);
  const childGroups = await Promise.all(
    directories.map((directory) => listRepositoryDirectories(projectKey, directory.id).catch(() => [] as TestDirectory[]))
  );
  return [...directories, ...childGroups.flat()];
}

export async function load({ params, url }: { params: { projectKey: string }; url: URL }) {
  try {
    const directories = await listRepositoryDirectories(params.projectKey);
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      directories,
      error: null
    };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      directories: [] as TestDirectory[],
      error: (e as Error).message
    };
  }
}

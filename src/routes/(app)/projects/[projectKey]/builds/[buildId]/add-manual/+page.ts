import { getBuild } from '$lib/api/builds';
import { listDirectories, type TestDirectory } from '$lib/api/testcases';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [build, directories] = await Promise.allSettled([
    getBuild(projectKey, buildId).catch(() => null),
    listDirectories(projectKey, null, 'ACTIVE').catch(() => [] as TestDirectory[])
  ]);
  return {
    projectKey,
    buildId,
    build: build.status === 'fulfilled' ? build.value : null,
    directories: directories.status === 'fulfilled' ? directories.value : [] as TestDirectory[]
  };
}

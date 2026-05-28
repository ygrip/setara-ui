import { listBuilds, type ProjectBuild } from '$lib/api/builds';
import { getProject, type Project } from '$lib/api/projects';
import type { LoadEvent } from '@sveltejs/kit';

export async function load({ params, url }: LoadEvent) {
  const { projectKey } = params as { projectKey: string };
  const sortBy = url.searchParams.get('sort_by') ?? 'createdAt';
  const sortDir = url.searchParams.get('sort_dir') ?? 'desc';
  const status = url.searchParams.get('status') ?? undefined;
  const [projectResult, buildsResult] = await Promise.allSettled([
    getProject(projectKey),
    listBuilds(projectKey, status, sortBy, sortDir)
  ]);

  return {
    projectKey,
    sortBy,
    sortDir,
    project: projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null,
    builds: buildsResult.status === 'fulfilled' ? buildsResult.value : [] as ProjectBuild[],
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

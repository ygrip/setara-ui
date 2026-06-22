import { listBuilds, type ProjectBuild, type CursorPage } from '$lib/api/builds';
import { getProject, type Project } from '$lib/api/projects';
import type { LoadEvent } from '@sveltejs/kit';

export async function load({ params, url }: LoadEvent) {
  const { projectKey } = params as { projectKey: string };
  const status = url.searchParams.get('status') ?? undefined;
  const [projectResult, buildsResult] = await Promise.allSettled([
    getProject(projectKey),
    listBuilds(projectKey, status)
  ]);

  const buildsPage: CursorPage<ProjectBuild> = buildsResult.status === 'fulfilled'
    ? buildsResult.value
    : { items: [], nextCursor: null, prevCursor: null };

  return {
    projectKey,
    project: projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null,
    buildsPage,
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

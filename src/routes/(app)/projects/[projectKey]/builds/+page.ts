import { listBuilds, type ProjectBuild } from '$lib/api/builds';
import { getProject, type Project } from '$lib/api/projects';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  const [projectResult, buildsResult] = await Promise.allSettled([
    getProject(projectKey),
    listBuilds(projectKey)
  ]);

  return {
    projectKey,
    project: projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null,
    builds: buildsResult.status === 'fulfilled' ? buildsResult.value : [] as ProjectBuild[],
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

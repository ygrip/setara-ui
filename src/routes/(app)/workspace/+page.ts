import { listProjects, type Project } from '$lib/api/projects';
import { listTribes, type Tribe } from '$lib/api/organization';

export async function load() {
  const [projectsResult, tribesResult] = await Promise.allSettled([listProjects(), listTribes()]);
  return {
    projects: projectsResult.status === 'fulfilled' ? projectsResult.value : [] as Project[],
    tribes: tribesResult.status === 'fulfilled' ? tribesResult.value : [] as Tribe[],
    error: projectsResult.status === 'rejected' ? (projectsResult.reason as Error).message : null
  };
}

import { getProject, type Project } from '$lib/api/projects';
import { listSquads, listTribes, type Squad } from '$lib/api/organization';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  const [projectResult, tribesResult] = await Promise.allSettled([
    getProject(projectKey),
    listTribes(undefined, 100, 'name', 'asc')
  ]);
  let squads: Squad[] = [];
  if (tribesResult.status === 'fulfilled') {
    const pages = await Promise.allSettled(
      tribesResult.value.items.map((tribe) => listSquads(tribe.id, undefined, 100, 'name', 'asc'))
    );
    squads = pages.flatMap((page) => page.status === 'fulfilled' ? page.value.items : []);
  }
  return {
    projectKey,
    project: projectResult.status === 'fulfilled' ? projectResult.value : null as Project | null,
    squads,
    error: projectResult.status === 'rejected' ? (projectResult.reason as Error).message : null
  };
}

import { listProjects, type Project } from '$lib/api/projects';
import { listProjectStatistics, type ProjectStatistic } from '$lib/api/statistics';

export async function load() {
  try {
    const [projectsResult, statistics] = await Promise.all([
      listProjects(undefined, undefined, 'createdAt', 'desc'),
      listProjectStatistics()
    ]);
    return { projects: projectsResult.items, statistics, nextCursor: projectsResult.nextCursor, error: null };
  } catch (e) {
    return { projects: [] as Project[], statistics: [] as ProjectStatistic[], nextCursor: null, error: (e as Error).message };
  }
}

import { listProjects, type Project } from '$lib/api/projects';
import {
  listProjectStatisticHistory,
  listProjectStatistics,
  type ProjectStatistic
} from '$lib/api/statistics';

export async function load() {
  try {
    const [projectsResult, statistics] = await Promise.all([
      listProjects(undefined, undefined, 'createdAt', 'desc'),
      listProjectStatistics()
    ]);
    const histories = await Promise.all(
      statistics.map((row) => listProjectStatisticHistory(row.projectKey, 30).catch(() => []))
    );
    return {
      projects: projectsResult.items.slice(0, 5),
      statistics,
      statisticHistory: histories.flat(),
      nextCursor: projectsResult.nextCursor,
      error: null
    };
  } catch (e) {
    return {
      projects: [] as Project[],
      statistics: [] as ProjectStatistic[],
      statisticHistory: [] as ProjectStatistic[],
      nextCursor: null,
      error: (e as Error).message
    };
  }
}

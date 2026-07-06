import {
  getProjectOverview,
  type ProjectOverviewResponse
} from '$lib/api/projects';

export async function load() {
  try {
    const overview = await getProjectOverview();
    return { overview, error: null };
  } catch (error) {
    return { overview: null as ProjectOverviewResponse | null, error: (error as Error).message };
  }
}

import { listProjects, type Project } from '$lib/api/projects';

export async function load() {
  try {
    const result = await listProjects();
    return { projects: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { projects: [] as Project[], nextCursor: null, error: (e as Error).message };
  }
}

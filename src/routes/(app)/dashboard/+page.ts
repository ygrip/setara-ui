import { listProjects, type Project } from '$lib/api/projects';

export async function load() {
  try {
    const projects = await listProjects();
    return { projects, error: null };
  } catch (e) {
    return { projects: [] as Project[], error: (e as Error).message };
  }
}

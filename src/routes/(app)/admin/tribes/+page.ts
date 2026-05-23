import { listTribes, type Tribe } from '$lib/api/organization';

export async function load() {
  try {
    const tribes = await listTribes();
    return { tribes, error: null };
  } catch (e) {
    return { tribes: [] as Tribe[], error: (e as Error).message };
  }
}

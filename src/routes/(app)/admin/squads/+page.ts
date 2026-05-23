import { listTribes, type Tribe } from '$lib/api/organization';

export async function load() {
  try {
    const result = await listTribes();
    return { tribes: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { tribes: [] as Tribe[], nextCursor: null, error: (e as Error).message };
  }
}

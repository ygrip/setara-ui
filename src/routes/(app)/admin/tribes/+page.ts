import { listTribes, type Tribe } from '$lib/api/organization';

export async function load({ url }: { url: URL }) {
  try {
    const sortBy = url.searchParams.get('sort_by') ?? 'createdAt';
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';
    const result = await listTribes(undefined, undefined, sortBy, sortDir);
    return { tribes: result.items, nextCursor: result.nextCursor, sortBy, sortDir, error: null };
  } catch (e) {
    return { tribes: [] as Tribe[], nextCursor: null, sortBy: 'createdAt', sortDir: 'asc', error: (e as Error).message };
  }
}

import { getSquad } from '$lib/api/organization';
import { listSquadPlans, type ReleasePlan } from '$lib/api/squadPlans';
import type { LoadEvent } from '@sveltejs/kit';

export async function load({ params, url }: LoadEvent) {
  const { squadId } = params as { squadId: string };
  const sortBy = url.searchParams.get('sort_by') ?? 'createdAt';
  const sortDir = url.searchParams.get('sort_dir') ?? 'desc';
  try {
    const [squad, result] = await Promise.all([
      getSquad(squadId),
      listSquadPlans(squadId, undefined, 100, sortBy, sortDir)
    ]);
    return { squadId, squad, plans: result.items, nextCursor: result.nextCursor, sortBy, sortDir, error: null };
  } catch (e) {
    return { squadId, squad: null, plans: [] as ReleasePlan[], nextCursor: null, sortBy, sortDir, error: (e as Error).message };
  }
}

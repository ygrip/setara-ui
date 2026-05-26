import { getSquad } from '$lib/api/organization';
import { listSquadPlans, type ReleasePlan } from '$lib/api/squadPlans';

export async function load({ params }: { params: { squadId: string } }) {
  const { squadId } = params;
  try {
    const [squad, result] = await Promise.all([
      getSquad(squadId),
      listSquadPlans(squadId)
    ]);
    return { squadId, squad, plans: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { squadId, squad: null, plans: [] as ReleasePlan[], nextCursor: null, error: (e as Error).message };
  }
}

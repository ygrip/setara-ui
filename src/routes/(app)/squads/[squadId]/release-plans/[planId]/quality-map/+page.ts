import { getSquadPlanQualityMap, type SetaraMap } from '$lib/api/mindmaps';

export async function load({ params }: { params: { squadId: string; planId: string } }) {
  const { squadId, planId } = params;
  try {
    const qualityMap = await getSquadPlanQualityMap(squadId, planId);
    return { squadId, planId, qualityMap, error: null };
  } catch (e) {
    return {
      squadId,
      planId,
      qualityMap: null as SetaraMap | null,
      error: (e as Error).message
    };
  }
}

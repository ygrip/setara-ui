import { getSquadQualityOverview, type SquadQualityOverview } from '$lib/api/statistics';

export async function load({ params }: { params: { squadId: string } }) {
  try {
    const overview = await getSquadQualityOverview(params.squadId);
    return { squadId: params.squadId, overview, error: null };
  } catch (error) {
    return {
      squadId: params.squadId,
      overview: null as SquadQualityOverview | null,
      error: (error as Error).message
    };
  }
}

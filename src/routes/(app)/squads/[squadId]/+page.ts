import { getSquad } from '$lib/api/organization';
import { listSquadProjectCoverage } from '$lib/api/statistics';
import type { Squad } from '$lib/api/organization';
import type { SquadProjectCoverage } from '$lib/api/statistics';

export async function load({ params }: { params: { squadId: string } }) {
  const { squadId } = params;
  const [squadResult, projectsResult] = await Promise.allSettled([
    getSquad(squadId),
    listSquadProjectCoverage(squadId, {})
  ]);
  return {
    squadId,
    squad: squadResult.status === 'fulfilled' ? squadResult.value : null as Squad | null,
    projects: projectsResult.status === 'fulfilled' ? projectsResult.value : [] as SquadProjectCoverage[],
    error: squadResult.status === 'rejected' ? (squadResult.reason as Error).message : null
  };
}

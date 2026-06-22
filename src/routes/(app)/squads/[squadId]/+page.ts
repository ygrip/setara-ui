import { getSquad } from '$lib/api/organization';
import { listSquadProjectCoverage, listSquadHistory, type SquadHistoryPoint } from '$lib/api/statistics';
import type { Squad } from '$lib/api/organization';
import type { SquadProjectCoverage } from '$lib/api/statistics';

export async function load({ params }: { params: { squadId: string } }) {
  const { squadId } = params;
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [squadResult, projectsResult, historyResult] = await Promise.allSettled([
    getSquad(squadId),
    listSquadProjectCoverage(squadId, {}),
    listSquadHistory(squadId, start, end, 'daily')
  ]);
  return {
    squadId,
    squad: squadResult.status === 'fulfilled' ? squadResult.value : null as Squad | null,
    projects: projectsResult.status === 'fulfilled' ? projectsResult.value : [] as SquadProjectCoverage[],
    squadHistory: historyResult.status === 'fulfilled' ? historyResult.value : [] as SquadHistoryPoint[],
    squadHistoryStart: start,
    squadHistoryEnd: end,
    error: squadResult.status === 'rejected' ? (squadResult.reason as Error).message : null
  };
}

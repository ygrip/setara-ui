import { getSquad } from '$lib/api/organization';
import { getSquadPlan, listSquadPlanBuilds, getSquadPlanMetrics, getSquadPlanLifecycle, type ReleasePlan, type PlanBuild, type SquadPlanMetrics, type PlanLifecycleEvent } from '$lib/api/squadPlans';

export async function load({ params }: { params: { squadId: string; planId: string } }) {
  const { squadId, planId } = params;
  try {
    const [squad, plan, builds, metrics, lifecycle] = await Promise.all([
      getSquad(squadId),
      getSquadPlan(squadId, planId),
      listSquadPlanBuilds(squadId, planId),
      getSquadPlanMetrics(squadId, planId).catch(() => null),
      getSquadPlanLifecycle(squadId, planId).catch(() => [] as PlanLifecycleEvent[])
    ]);
    return { squadId, planId, squad, plan, builds, metrics, lifecycle, error: null };
  } catch (e) {
    return {
      squadId, planId,
      squad: null,
      plan: null as ReleasePlan | null,
      builds: [] as PlanBuild[],
      metrics: null as SquadPlanMetrics | null,
      lifecycle: [] as PlanLifecycleEvent[],
      error: (e as Error).message
    };
  }
}

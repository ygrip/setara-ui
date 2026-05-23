import { getPlan, getPlanMetrics, listPlanScenarios, type PlanMetrics, type PlanScenario, type ReleasePlan } from '$lib/api/plans';
import { listRuns, listRunResults, type ScenarioRunResult } from '$lib/api/runs';
import { listScenarios, type Scenario } from '$lib/api/testcases';

export async function load({ params }: { params: { projectKey: string; planId: string } }) {
  const { projectKey, planId } = params;
  try {
    const [plan, planScenarios, metrics, liveScenarios, runsResult] = await Promise.all([
      getPlan(projectKey, planId),
      listPlanScenarios(projectKey, planId),
      getPlanMetrics(projectKey, planId),
      listScenarios(projectKey, null, 'ACTIVE'),
      listRuns(projectKey, undefined, 10, 'createdAt', 'desc')
    ]);
    const results = (await Promise.all(runsResult.items.slice(0, 5).map(run => listRunResults(projectKey, run.id)))).flat();
    return { projectKey, planId, plan, planScenarios, metrics, liveScenarios, results, error: null };
  } catch (e) {
    return {
      projectKey,
      planId,
      plan: null as ReleasePlan | null,
      planScenarios: [] as PlanScenario[],
      metrics: null as PlanMetrics | null,
      liveScenarios: [] as Scenario[],
      results: [] as ScenarioRunResult[],
      error: (e as Error).message
    };
  }
}

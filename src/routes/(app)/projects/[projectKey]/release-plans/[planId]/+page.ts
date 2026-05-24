import { getPlan, getPlanMetrics, listPlanScenarios, type PlanMetrics, type PlanScenario, type ReleasePlan } from '$lib/api/plans';
import { listRuns, listRunResults, type AutomationRun, type ScenarioRunResult } from '$lib/api/runs';
import { listDirectories, listScenarios, type Scenario, type TestDirectory } from '$lib/api/testcases';

async function listDirectoryTree(projectKey: string): Promise<TestDirectory[]> {
  const all: TestDirectory[] = [];
  async function visit(parentId: string | null) {
    const children = await listDirectories(projectKey, parentId);
    all.push(...children);
    await Promise.all(children.map(child => visit(child.id)));
  }
  await visit(null);
  return all;
}

export async function load({ params }: { params: { projectKey: string; planId: string } }) {
  const { projectKey, planId } = params;
  try {
    const [plan, planScenarios, metrics, liveScenarios, directories, runsResult] = await Promise.all([
      getPlan(projectKey, planId),
      listPlanScenarios(projectKey, planId),
      getPlanMetrics(projectKey, planId),
      listScenarios(projectKey, null, 'ACTIVE'),
      listDirectoryTree(projectKey),
      listRuns(projectKey, undefined, 10, 'createdAt', 'desc')
    ]);
    const results = (await Promise.all(runsResult.items.map(run => listRunResults(projectKey, run.id)))).flat();
    return { projectKey, planId, plan, planScenarios, metrics, liveScenarios, directories, runs: runsResult.items, results, error: null };
  } catch (e) {
    return {
      projectKey,
      planId,
      plan: null as ReleasePlan | null,
      planScenarios: [] as PlanScenario[],
      metrics: null as PlanMetrics | null,
      liveScenarios: [] as Scenario[],
      directories: [] as TestDirectory[],
      runs: [] as AutomationRun[],
      results: [] as ScenarioRunResult[],
      error: (e as Error).message
    };
  }
}

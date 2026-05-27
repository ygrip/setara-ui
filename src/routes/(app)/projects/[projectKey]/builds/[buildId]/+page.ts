import { getBuild, listBuildAudit, listBuildScenarios, type BuildAuditEvent, type BuildScenario, type ProjectBuild } from '$lib/api/builds';
import { listRuns, type AutomationRun } from '$lib/api/runs';
import type { Scenario } from '$lib/api/testcases';
import { isMockMode } from '$lib/mock/client';
import { mockScenariosByProject } from '$lib/mock/data';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [buildResult, scenariosResult, auditResult, runsResult] = await Promise.allSettled([
    getBuild(projectKey, buildId),
    listBuildScenarios(projectKey, buildId),
    listBuildAudit(projectKey, buildId),
    listRuns(projectKey)
  ]);

  // Load project scenarios for the picker (scenarios_pool)
  let scenariosPool: Scenario[] = [];
  if (isMockMode()) {
    scenariosPool = mockScenariosByProject[projectKey] ?? [];
  }

  const buildScenarios = scenariosResult.status === 'fulfilled' ? scenariosResult.value : [] as BuildScenario[];
  const existingIds = new Set(buildScenarios.map(bs => bs.scenarioId));

  return {
    projectKey,
    buildId,
    build: buildResult.status === 'fulfilled' ? buildResult.value : null as ProjectBuild | null,
    scenarios: buildScenarios,
    audit: auditResult.status === 'fulfilled' ? auditResult.value : [] as BuildAuditEvent[],
    runs: runsResult.status === 'fulfilled' ? runsResult.value.items : [] as AutomationRun[],
    scenarios_pool: scenariosPool.filter(s => s.status === 'ACTIVE' && !existingIds.has(s.id)),
    error: buildResult.status === 'rejected' ? (buildResult.reason as Error).message : null
  };
}

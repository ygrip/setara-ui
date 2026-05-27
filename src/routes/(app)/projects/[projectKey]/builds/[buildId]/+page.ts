import { getBuild, listBuildAudit, listBuildScenarios, type BuildAuditEvent, type BuildScenario, type ProjectBuild } from '$lib/api/builds';
import { listRuns, type AutomationRun } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [buildResult, scenariosResult, auditResult, runsResult] = await Promise.allSettled([
    getBuild(projectKey, buildId),
    listBuildScenarios(projectKey, buildId),
    listBuildAudit(projectKey, buildId),
    listRuns(projectKey)
  ]);

  return {
    projectKey,
    buildId,
    build: buildResult.status === 'fulfilled' ? buildResult.value : null as ProjectBuild | null,
    scenarios: scenariosResult.status === 'fulfilled' ? scenariosResult.value : [] as BuildScenario[],
    audit: auditResult.status === 'fulfilled' ? auditResult.value : [] as BuildAuditEvent[],
    runs: runsResult.status === 'fulfilled' ? runsResult.value.items : [] as AutomationRun[],
    error: buildResult.status === 'rejected' ? (buildResult.reason as Error).message : null
  };
}

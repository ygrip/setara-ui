import { getBuild, listBuildAudit, listBuildScenarios, type BuildAuditEvent, type BuildScenario, type ProjectBuild } from '$lib/api/builds';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [buildResult, scenariosResult, auditResult] = await Promise.allSettled([
    getBuild(projectKey, buildId),
    listBuildScenarios(projectKey, buildId),
    listBuildAudit(projectKey, buildId)
  ]);

  return {
    projectKey,
    buildId,
    build: buildResult.status === 'fulfilled' ? buildResult.value : null as ProjectBuild | null,
    scenarios: scenariosResult.status === 'fulfilled' ? scenariosResult.value : [] as BuildScenario[],
    audit: auditResult.status === 'fulfilled' ? auditResult.value : [] as BuildAuditEvent[],
    error: buildResult.status === 'rejected' ? (buildResult.reason as Error).message : null
  };
}

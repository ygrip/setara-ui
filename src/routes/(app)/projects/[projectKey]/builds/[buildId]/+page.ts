import { getBuild, listBuildAudit, listBuildScenarios, type BuildAuditEvent, type BuildScenario, type CursorPage, type ProjectBuild } from '$lib/api/builds';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [buildResult, scenariosResult, auditResult] = await Promise.allSettled([
    getBuild(projectKey, buildId),
    listBuildScenarios(projectKey, buildId, undefined, 20),
    listBuildAudit(projectKey, buildId, undefined, 20)
  ]);

  return {
    projectKey,
    buildId,
    build: buildResult.status === 'fulfilled' ? buildResult.value : null as ProjectBuild | null,
    scenariosPage: scenariosResult.status === 'fulfilled' ? scenariosResult.value : { items: [], nextCursor: null, prevCursor: null } as CursorPage<BuildScenario>,
    auditPage: auditResult.status === 'fulfilled' ? auditResult.value : { items: [], nextCursor: null, prevCursor: null } as CursorPage<BuildAuditEvent>,
    error: buildResult.status === 'rejected' ? (buildResult.reason as Error).message : null
  };
}

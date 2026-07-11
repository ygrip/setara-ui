import { getBuild, listBuildAudit, listBuildScenarios, type BuildAuditEvent, type BuildScenario, type CursorPage, type ProjectBuild } from '$lib/api/builds';
import { getIssueTrackerStatus } from '$lib/api/issues';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;
  const [buildResult, scenariosResult, auditResult, issuesEnabledResult] = await Promise.allSettled([
    getBuild(projectKey, buildId),
    listBuildScenarios(projectKey, buildId, undefined, 20),
    listBuildAudit(projectKey, buildId, undefined, 20),
    getIssueTrackerStatus()
  ]);

  return {
    projectKey,
    buildId,
    build: buildResult.status === 'fulfilled' ? buildResult.value : null as ProjectBuild | null,
    scenariosPage: scenariosResult.status === 'fulfilled' ? scenariosResult.value : { items: [], nextCursor: null, prevCursor: null } as CursorPage<BuildScenario>,
    auditPage: auditResult.status === 'fulfilled' ? auditResult.value : { items: [], nextCursor: null, prevCursor: null } as CursorPage<BuildAuditEvent>,
    issuesEnabled: issuesEnabledResult.status === 'fulfilled' && issuesEnabledResult.value.enabled,
    error: buildResult.status === 'rejected' ? (buildResult.reason as Error).message : null
  };
}

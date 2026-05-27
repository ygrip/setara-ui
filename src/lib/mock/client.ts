import {
  mockProjects, mockRunsByProject, mockApiKeysByProject,
  mockTribes, mockSquads, mockUsers, mockNodesByProject,
  mockScenariosByProject,
  mockBuildsByProject, mockBuildScenariosByBuild, mockBuildAuditByBuild,
  mockSquadPlans, mockPlanBuilds
} from './data';
import type { Project } from '$lib/api/projects';
import type { AutomationRun, ScenarioRunResult, HeatmapDay } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { PlanBuild, PlanMetrics, ReleasePlan } from '$lib/api/plans';
import type { BuildAuditEvent, BuildScenario, ProjectBuild } from '$lib/api/builds';
import type { Scenario, TestDirectory } from '$lib/api/testcases';
import type { ProjectStatistic, SquadProjectCoverage } from '$lib/api/statistics';
import type { CursorPage } from '$lib/api/pagination';

export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK === 'true';
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function mockListProjects(_cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<Project>> {
  await delay(150);
  return { items: mockProjects, nextCursor: null, prevCursor: null };
}

export async function mockGetProject(projectKey: string): Promise<Project> {
  await delay(100);
  const p = mockProjects.find(p => p.projectKey === projectKey);
  if (!p) throw new Error(`Project ${projectKey} not found`);
  return p;
}

export async function mockListRuns(projectKey: string, _cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<AutomationRun>> {
  await delay(150);
  return { items: mockRunsByProject[projectKey] ?? [], nextCursor: null, prevCursor: null };
}

export async function mockGetRun(projectKey: string, runId: string): Promise<AutomationRun> {
  await delay(100);
  const runs = mockRunsByProject[projectKey] ?? [];
  const run = runs.find(r => r.id === runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  return run;
}

export async function mockListRunResults(projectKey: string, runId: string): Promise<ScenarioRunResult[]> {
  await delay(100);
  return mockListScenarios(projectKey, null, 'ACTIVE').then(scenarios => scenarios.slice(0, 2).map((scenario, index) => ({
    id: `result-${runId}-${index}`,
    runId,
    scenarioId: scenario.id,
    cucumberId: scenario.cucumberId,
    featureUri: scenario.featureUri,
    featureName: scenario.featureName,
    scenarioName: scenario.name,
    scenarioLine: scenario.lineNumber,
    tags: scenario.tags,
    status: index === 0 ? 'PASSED' : 'FAILED',
    startedAt: '2026-05-23T08:00:00Z',
    finishedAt: '2026-05-23T08:02:00Z',
    durationMs: 120000,
    exceptionType: index === 0 ? null : 'AssertionError',
    exceptionMessage: index === 0 ? null : 'Expected refund state to be APPROVED'
  })));
}

export async function mockListApiKeys(projectKey: string): Promise<ApiKey[]> {
  await delay(100);
  return mockApiKeysByProject[projectKey] ?? [];
}

export async function mockCreateApiKey(
  _projectKey: string,
  body: { name: string; scopes: string[] }
): Promise<{ id: string; name: string; keyPrefix: string; rawKey: string }> {
  await delay(200);
  return {
    id: `key-mock-${Date.now()}`,
    name: body.name,
    keyPrefix: 'stk_mock_xxx',
    rawKey: 'stk_mock_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
}

export async function mockRevokeApiKey(_projectKey: string, _apiKeyId: string): Promise<void> {
  await delay(150);
}

export async function mockRotateApiKey(_projectKey: string, _apiKeyId: string): Promise<{ rawKey: string }> {
  await delay(200);
  return { rawKey: 'stk_mock_rotated_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' };
}

export async function mockListTribes(_cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<Tribe>> {
  await delay(120);
  return { items: mockTribes, nextCursor: null, prevCursor: null };
}

export async function mockListSquads(tribeId: string, _cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<Squad>> {
  await delay(100);
  return { items: mockSquads[tribeId] ?? [], nextCursor: null, prevCursor: null };
}

export async function mockListUsers(_cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<User>> {
  await delay(100);
  return { items: mockUsers, nextCursor: null, prevCursor: null };
}

export async function mockListDirectories(projectKey: string, parentId?: string | null, status = 'ACTIVE'): Promise<TestDirectory[]> {
  await delay(100);
  const nodes = mockNodesByProject[projectKey] ?? [];
  const scenarios = mockScenariosByProject[projectKey]?.filter(scenario => scenario.status === status) ?? [];
  return nodes
    .filter(node => node.nodeType === 'DIRECTORY')
    .filter(node => (parentId ? node.parentId === parentId : node.parentId === null))
    .map(node => ({
      id: node.id,
      parentId: node.parentId,
      directoryId: node.directoryId ?? node.id,
      name: node.name,
      slug: node.slug,
      path: node.path,
      createdAt: node.createdAt,
      scenarioCount: scenarios.filter(scenario => {
        const scenarioNode = nodes.find(item => item.id === scenario.nodeId);
        return scenarioNode?.path === node.path || scenarioNode?.path.startsWith(`${node.path}/`);
      }).length
    }));
}

export async function mockListScenarios(projectKey: string, nodeId?: string | null, status = 'ACTIVE'): Promise<Scenario[]> {
  await delay(120);
  const scenarios = mockScenariosByProject[projectKey] ?? [];
  const byStatus = scenarios.filter(s => s.status === status);
  const filtered = nodeId ? byStatus.filter(s => s.nodeId === nodeId) : byStatus;
  return filtered.map(scenario => ({ ...scenario, steps: scenario.steps.slice(0, 3) }));
}

export async function mockGetScenario(projectKey: string, scenarioId: string): Promise<Scenario> {
  await delay(80);
  const scenario = mockScenariosByProject[projectKey]?.find(item => item.id === scenarioId);
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);
  return structuredClone(scenario);
}

export async function mockUpdateScenario(
  projectKey: string,
  scenarioId: string,
  body: Partial<Scenario> & { steps?: Scenario['steps'] }
): Promise<Scenario> {
  await delay(120);
  const scenarios = mockScenariosByProject[projectKey] ?? [];
  const index = scenarios.findIndex(item => item.id === scenarioId);
  if (index < 0) throw new Error(`Scenario ${scenarioId} not found`);
  scenarios[index] = {
    ...scenarios[index],
    ...body,
    steps: body.steps ?? scenarios[index].steps,
    updatedAt: new Date().toISOString()
  };
  return structuredClone(scenarios[index]);
}

export async function mockListAllPlans(squadId?: string, _cursor?: string, limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<ReleasePlan>> {
  await delay(120);
  const plans = squadId
    ? mockSquadPlans.filter(p => p.squadId === squadId)
    : mockSquadPlans;
  return { items: plans.slice(0, limit || 20), nextCursor: null, prevCursor: null };
}

export async function mockGetSquadPlan(squadId: string, planId: string): Promise<ReleasePlan> {
  await delay(100);
  return mockSquadPlans.find(p => p.id === planId && p.squadId === squadId) || mockSquadPlans[0];
}

export async function mockListSquadPlanBuilds(_squadId: string, planId: string): Promise<PlanBuild[]> {
  await delay(120);
  return mockPlanBuilds[planId] || [];
}

export async function mockGetSquadPlanMetrics(_squadId: string, planId: string) {
  await delay(100);
  const builds = mockPlanBuilds[planId] || [];
  const totalBuilds = builds.length;
  const verifiedBuilds = builds.filter(b => b.status === 'VERIFIED').length;
  const inProgressBuilds = builds.filter(b => b.status === 'IN_PROGRESS').length;
  const initiatedBuilds = totalBuilds - verifiedBuilds - inProgressBuilds;
  const plan = mockSquadPlans.find(p => p.id === planId);
  const totalProjects = plan?.totalProjects ?? builds.length;

  // Aggregate scenario counts across builds
  const totalScenarios = builds.reduce((s, b) => s + (b.metrics?.totalScenarios ?? 0), 0);
  const passed = builds.reduce((s, b) => s + (b.metrics?.passed ?? 0), 0);
  const failed = builds.reduce((s, b) => s + (b.metrics?.failed ?? 0), 0);
  const blocked = builds.reduce((s, b) => s + (b.metrics?.blocked ?? 0), 0);
  const skipped = builds.reduce((s, b) => s + (b.metrics?.skipped ?? 0), 0);
  const notExecuted = Math.max(totalScenarios - passed - failed - blocked - skipped, 0);
  const passPercentage = totalScenarios > 0 ? Math.round((passed / totalScenarios) * 100 * 100) / 100 : 0;
  const executionCoverage = totalScenarios > 0 ? Math.round(((passed + failed + blocked + skipped) / totalScenarios) * 100 * 100) / 100 : 0;
  const planReadiness = totalBuilds > 0 ? Math.round((verifiedBuilds / totalBuilds) * 100 * 100) / 100 : 0;
  const scenarioPassRate = totalScenarios > 0 ? Math.round((passed / totalScenarios) * 100 * 100) / 100 : 0;

  return {
    planId, totalBuilds, verifiedBuilds, inProgressBuilds, initiatedBuilds,
    totalProjects, totalScenarios, passed, failed, blocked, skipped, notExecuted,
    passPercentage, executionCoverage, planReadiness, scenarioPassRate
  };
}

export async function mockCreateSquadPlan(
  squadId: string,
  body: { name: string; releaseVersion?: string | null; releaseDate?: string | null; description?: string | null; openedBy?: string | null }
): Promise<ReleasePlan> {
  await delay(200);
  const allSquads = Object.values(mockSquads).flat();
  const squad = allSquads.find(s => s.id === squadId);
  const plan: ReleasePlan = {
    id: `plan-${squadId}-${Date.now()}`,
    squadId,
    squadName: squad?.name ?? squadId,
    name: body.name,
    releaseVersion: body.releaseVersion ?? null,
    releaseDate: body.releaseDate ?? null,
    description: body.description ?? null,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    openedAt: new Date().toISOString(),
    openedBy: body.openedBy ?? 'mock.user@setara.local',
    inProgressAt: null,
    closedAt: null,
    closedBy: null,
    totalBuilds: 0,
    verifiedBuilds: 0,
    totalProjects: 0
  };
  mockSquadPlans.push(plan);
  return structuredClone(plan);
}

export async function mockListBuilds(projectKey: string): Promise<ProjectBuild[]> {
  await delay(120);
  return structuredClone(mockBuildsByProject[projectKey] ?? []);
}

export async function mockGetBuild(projectKey: string, buildId: string): Promise<ProjectBuild> {
  await delay(100);
  const build = mockBuildsByProject[projectKey]?.find(item => item.id === buildId);
  if (!build) throw new Error(`Build ${buildId} not found`);
  return structuredClone(build);
}

export async function mockCreateBuild(
  projectKey: string,
  body: { name: string; buildKey?: string; version?: string; description?: string; createdBy?: string }
): Promise<ProjectBuild> {
  await delay(180);
  const project = mockProjects.find(item => item.projectKey === projectKey);
  if (!project) throw new Error(`Project ${projectKey} not found`);
  const build: ProjectBuild = {
    id: `build-${projectKey.toLowerCase()}-${Date.now()}`,
    projectId: project.id,
    projectKey,
    projectName: project.name,
    squadId: project.squadId,
    squadName: null,
    name: body.name,
    buildKey: body.buildKey || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    version: body.version ?? null,
    description: body.description ?? null,
    status: 'INITIATED',
    initiatedAt: new Date().toISOString(),
    inProgressAt: null,
    verifiedAt: null,
    createdBy: body.createdBy ?? 'mock.user@setara.local',
    verifiedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metrics: {
      buildId: `build-${projectKey.toLowerCase()}-${Date.now()}`,
      totalScenarios: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      notExecuted: 0,
      passPercentage: 0,
      executionCoverage: 0
    }
  };
  build.metrics.buildId = build.id;
  mockBuildsByProject[projectKey] = [build, ...(mockBuildsByProject[projectKey] ?? [])];
  mockBuildScenariosByBuild[build.id] = [];
  mockBuildAuditByBuild[build.id] = [{
    id: `audit-${build.id}-opened`,
    eventType: 'BUILD_OPENED',
    actor: build.createdBy,
    occurredAt: build.createdAt,
    metadata: { name: build.name, buildKey: build.buildKey }
  }];
  return structuredClone(build);
}

export async function mockListBuildScenarios(_projectKey: string, buildId: string): Promise<BuildScenario[]> {
  await delay(120);
  return structuredClone(mockBuildScenariosByBuild[buildId] ?? []);
}

export async function mockAddBuildScenario(
  projectKey: string,
  buildId: string,
  body: { scenarioId: string; source?: string; addedBy?: string }
): Promise<BuildScenario> {
  await delay(160);
  const scenario = (mockScenariosByProject[projectKey] ?? []).find(item => item.id === body.scenarioId);
  if (!scenario) throw new Error(`Scenario ${body.scenarioId} not found`);
  const row: BuildScenario = {
    id: `build-scenario-${Date.now()}`,
    scenarioId: scenario.id,
    scenarioKey: scenario.scenarioKey,
    name: scenario.name,
    priority: scenario.priority,
    expectedStatus: 'PASSED',
    latestStatus: 'NOT_EXECUTED',
    source: body.source ?? 'MANUAL',
    executedBy: null,
    executedAt: null,
    addedAt: new Date().toISOString()
  };
  mockBuildScenariosByBuild[buildId] = [row, ...(mockBuildScenariosByBuild[buildId] ?? [])];
  const build = mockBuildsByProject[projectKey]?.find(item => item.id === buildId);
  if (build) {
    build.status = 'IN_PROGRESS';
    build.inProgressAt ??= new Date().toISOString();
    build.updatedAt = new Date().toISOString();
    build.metrics.totalScenarios += 1;
    build.metrics.notExecuted += 1;
  }
  mockBuildAuditByBuild[buildId] = [{
    id: `audit-${buildId}-${Date.now()}`,
    eventType: 'SCENARIO_ADDED',
    actor: body.addedBy ?? 'mock.user@setara.local',
    occurredAt: new Date().toISOString(),
    metadata: { scenarioKey: scenario.scenarioKey, source: row.source }
  }, ...(mockBuildAuditByBuild[buildId] ?? [])];
  return structuredClone(row);
}

export async function mockVerifyBuild(projectKey: string, buildId: string, body: { verifiedBy?: string; notes?: string } = {}): Promise<ProjectBuild> {
  await delay(180);
  const build = mockBuildsByProject[projectKey]?.find(item => item.id === buildId);
  if (!build) throw new Error(`Build ${buildId} not found`);
  build.status = 'VERIFIED';
  build.verifiedAt = new Date().toISOString();
  build.verifiedBy = body.verifiedBy ?? 'qa.lead@setara.local';
  build.updatedAt = build.verifiedAt;
  mockBuildAuditByBuild[buildId] = [{
    id: `audit-${buildId}-verified-${Date.now()}`,
    eventType: 'BUILD_VERIFIED',
    actor: build.verifiedBy,
    occurredAt: build.verifiedAt,
    metadata: { notes: body.notes ?? null }
  }, ...(mockBuildAuditByBuild[buildId] ?? [])];
  return structuredClone(build);
}

export async function mockListBuildAudit(_projectKey: string, buildId: string): Promise<BuildAuditEvent[]> {
  await delay(100);
  return structuredClone(mockBuildAuditByBuild[buildId] ?? []);
}

function recomputeBuildMetrics(projectKey: string, buildId: string) {
  const scenarios = mockBuildScenariosByBuild[buildId] ?? [];
  const build = mockBuildsByProject[projectKey]?.find(b => b.id === buildId);
  if (!build) return;
  const total = scenarios.length;
  const passed = scenarios.filter(s => s.latestStatus === 'PASSED').length;
  const failed = scenarios.filter(s => s.latestStatus === 'FAILED').length;
  const blocked = scenarios.filter(s => s.latestStatus === 'BLOCKED').length;
  const skipped = scenarios.filter(s => s.latestStatus === 'SKIPPED').length;
  const notExecuted = scenarios.filter(s => s.latestStatus === 'NOT_EXECUTED').length;
  build.metrics.totalScenarios = total;
  build.metrics.passed = passed;
  build.metrics.failed = failed;
  build.metrics.blocked = blocked;
  build.metrics.skipped = skipped;
  build.metrics.notExecuted = notExecuted;
  build.metrics.passPercentage = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  build.metrics.executionCoverage = total > 0 ? Number((((total - notExecuted) / total) * 100).toFixed(2)) : 0;
  build.updatedAt = new Date().toISOString();
}

export async function mockUpdateBuildScenarioResult(
  projectKey: string,
  buildId: string,
  buildScenarioId: string,
  body: { status: string; notes?: string; executedBy?: string }
): Promise<BuildScenario> {
  await delay(150);
  const scenarios = mockBuildScenariosByBuild[buildId] ?? [];
  const index = scenarios.findIndex(s => s.id === buildScenarioId);
  if (index < 0) throw new Error(`BuildScenario ${buildScenarioId} not found`);
  const previousStatus = scenarios[index].latestStatus;
  scenarios[index] = {
    ...scenarios[index],
    latestStatus: body.status,
    executedBy: body.executedBy ?? 'mock.user@setara.local',
    executedAt: new Date().toISOString()
  };
  recomputeBuildMetrics(projectKey, buildId);
  mockBuildAuditByBuild[buildId] = [{
    id: `audit-${buildId}-result-${Date.now()}`,
    eventType: 'SCENARIO_RESULT_UPDATED',
    actor: body.executedBy ?? 'mock.user@setara.local',
    occurredAt: new Date().toISOString(),
    metadata: {
      scenarioKey: scenarios[index].scenarioKey,
      previousStatus,
      newStatus: body.status,
      source: 'MANUAL',
      notes: body.notes ?? null
    }
  }, ...(mockBuildAuditByBuild[buildId] ?? [])];
  return structuredClone(scenarios[index]);
}

export async function mockRemoveBuildScenarios(
  projectKey: string,
  buildId: string,
  buildScenarioIds: string[]
): Promise<void> {
  await delay(150);
  const scenarios = mockBuildScenariosByBuild[buildId] ?? [];
  mockBuildScenariosByBuild[buildId] = scenarios.filter(s => !buildScenarioIds.includes(s.id));
  recomputeBuildMetrics(projectKey, buildId);
  mockBuildAuditByBuild[buildId] = [{
    id: `audit-${buildId}-removed-${Date.now()}`,
    eventType: 'SCENARIOS_REMOVED',
    actor: 'mock.user@setara.local',
    occurredAt: new Date().toISOString(),
    metadata: { count: buildScenarioIds.length }
  }, ...(mockBuildAuditByBuild[buildId] ?? [])];
}

export async function mockAddAutomationToBuild(
  projectKey: string,
  buildId: string,
  body: { runId: string; addedBy?: string }
): Promise<{ merged: number; updated: number }> {
  await delay(200);
  const runs = mockRunsByProject[projectKey] ?? [];
  const run = runs.find(r => r.id === body.runId);
  if (!run) throw new Error(`Run ${body.runId} not found`);
  const buildScenarios = mockBuildScenariosByBuild[buildId] ?? [];
  let merged = 0;
  let updated = 0;
  const isRunPassed = run.status === 'PASSED';
  for (const bs of buildScenarios) {
    if (bs.latestStatus === 'NOT_EXECUTED') {
      const newStatus = isRunPassed ? 'PASSED' : (merged % 4 === 0 ? 'FAILED' : 'PASSED');
      bs.latestStatus = newStatus;
      bs.executedBy = run.runnerId;
      bs.executedAt = run.finishedAt ?? new Date().toISOString();
      bs.source = 'AUTOMATION';
      updated++;
    } else {
      merged++;
    }
  }
  recomputeBuildMetrics(projectKey, buildId);
  mockBuildAuditByBuild[buildId] = [{
    id: `audit-${buildId}-automation-${Date.now()}`,
    eventType: 'AUTOMATION_RUN_ADDED',
    actor: body.addedBy ?? run.runnerId,
    occurredAt: new Date().toISOString(),
    metadata: { runId: body.runId, merged, updated }
  }, ...(mockBuildAuditByBuild[buildId] ?? [])];
  return { merged, updated };
}

export async function mockGetBuildByVersion(projectKey: string, version: string): Promise<ProjectBuild | null> {
  await delay(80);
  const builds = mockBuildsByProject[projectKey] ?? [];
  const found = builds.find(b => b.version === version);
  if (found) return structuredClone(found);
  if (builds.length > 0) {
    console.debug(`[mock] Build version "${version}" not found for ${projectKey}, falling back to latest`);
    return structuredClone(builds[0]);
  }
  return null;
}

export async function mockListSquadProjectCoverage(squadId: string): Promise<SquadProjectCoverage[]> {
  await delay(120);
  const projects = Object.values(mockProjects).filter(p => p.squadId === squadId);
  return projects.map(proj => {
    const scenarios = mockScenariosByProject[proj.projectKey] ?? [];
    const totalScenarios = scenarios.length;
    const totalAutomated = scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
    const totalAutomatable = scenarios.filter(s => s.automationStatus === 'AUTOMATED' || s.automationStatus === 'AUTOMATABLE').length;
    return {
      projectId: proj.id,
      projectKey: proj.projectKey,
      projectName: proj.name,
      totalScenarios,
      totalAutomated,
      totalAutomatable,
      coveragePercentage: totalAutomatable ? Number(((totalAutomated / totalAutomatable) * 100).toFixed(2)) : 0
    };
  });
}

export async function mockListProjectStatistics(): Promise<ProjectStatistic[]> {
  await delay(120);
  return mockProjects.map(project => {
    const scenarios = mockScenariosByProject[project.projectKey]?.filter(s => s.status === 'ACTIVE') ?? [];
    const totalAutomated = scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
    const totalAutomatable = scenarios.filter(s => s.automatable).length;
    return {
      id: `stat-${project.id}`,
      projectId: project.id,
      projectKey: project.projectKey,
      projectName: project.name,
      statDate: '2026-05-28',
      totalScenarios: scenarios.length,
      totalAutomated,
      totalAutomatable,
      coveragePercentage: totalAutomatable === 0 ? 0 : Number(((totalAutomated / totalAutomatable) * 100).toFixed(2)),
      updatedAt: '2026-05-28T00:00:00Z'
    };
  });
}

export async function mockListProjectStatisticHistory(projectKey: string, days = 30): Promise<ProjectStatistic[]> {
  await delay(120);
  const project = mockProjects.find(item => item.projectKey === projectKey);
  if (!project) return [];
  const [latest] = await mockListProjectStatistics().then(rows => rows.filter(row => row.projectKey === projectKey));
  if (!latest) return [];
  const cappedDays = Math.max(1, Math.min(days, 30));
  const baseCoverage = latest.coveragePercentage;
  return Array.from({ length: cappedDays }, (_, index) => {
    const dayOffset = index;
    const date = new Date('2026-05-28T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const coverage = Math.max(0, Math.min(100, baseCoverage - dayOffset * 1.4));
    return {
      ...latest,
      id: `${latest.id}-${date.toISOString().slice(0, 10)}`,
      statDate: date.toISOString().slice(0, 10),
      coveragePercentage: Number(coverage.toFixed(2)),
      updatedAt: date.toISOString()
    };
  });
}

export async function mockGetSquad(squadId: string): Promise<Squad> {
  await delay(80);
  const allSquads = Object.values(mockSquads).flat();
  const squad = allSquads.find(s => s.id === squadId);
  if (!squad) {
    // Return a minimal stub if not found
    return { id: squadId, tribeId: '', tribeName: null, name: squadId, createdAt: new Date().toISOString() };
  }
  // Enrich with tribe name
  const tribe = mockTribes.find(t => t.id === squad.tribeId);
  return { ...squad, tribeName: tribe?.name ?? null };
}

export async function mockListAllSquads(_cursor?: string, limit?: number): Promise<CursorPage<Squad>> {
  await delay(100);
  const allSquads = Object.values(mockSquads).flat().map(squad => {
    const tribe = mockTribes.find(t => t.id === squad.tribeId);
    return { ...squad, tribeName: tribe?.name ?? null };
  });
  return { items: allSquads.slice(0, limit ?? 100), nextCursor: null, prevCursor: null };
}

export async function mockGetRunHeatmap(projectKey: string, days = 182): Promise<HeatmapDay[]> {
  await delay(100);
  const today = new Date('2026-05-26T00:00:00Z');

  // Build a date→runs lookup from actual mock runs for this project
  const realRuns = mockRunsByProject[projectKey] ?? [];
  const realByDate = new Map<string, AutomationRun[]>();
  for (const r of realRuns) {
    const d = r.startedAt.slice(0, 10);
    if (!realByDate.has(d)) realByDate.set(d, []);
    realByDate.get(d)!.push(r);
  }

  // Deterministic pseudo-random per project key (LCG seeded by char codes)
  let seed = projectKey.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 17);
  function rng(max: number): number {
    seed = ((seed * 1664525 + 1013904223) | 0) >>> 0;
    return seed % max;
  }

  const result: HeatmapDay[] = [];
  const cur = new Date(today);
  cur.setUTCDate(cur.getUTCDate() - days + 1);

  while (cur <= today) {
    const iso = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay(); // 0=Sun 6=Sat
    const isWeekend = dow === 0 || dow === 6;

    if (realByDate.has(iso)) {
      // Use actual run data
      const runs = realByDate.get(iso)!;
      const finished = runs.filter(r => r.finishedAt);
      const passed = finished.filter(r => r.status === 'PASSED').length;
      const failed = finished.length - passed;
      const passRate = finished.length > 0 ? (passed / finished.length) * 100 : 0;
      result.push({ date: iso, runCount: runs.length, passedRuns: passed, failedRuns: failed, passRate });
    } else {
      // Simulate: weekdays ~65% chance of runs, weekends ~15%
      const threshold = isWeekend ? 15 : 65;
      const hasRuns = rng(100) < threshold;
      if (hasRuns) {
        const runCount = 1 + rng(isWeekend ? 2 : 4);
        // Occasionally inject failures (realistic ~15% failure rate)
        const allFail = rng(100) < 8; // 8% of days have all-fail runs
        const someFail = !allFail && rng(100) < 20; // 20% of remaining days have mixed
        let passedRuns: number;
        if (allFail) {
          passedRuns = 0;
        } else if (someFail) {
          passedRuns = Math.max(1, runCount - 1 - rng(Math.max(1, runCount - 1)));
        } else {
          passedRuns = runCount;
        }
        const failedRuns = runCount - passedRuns;
        const passRate = runCount > 0 ? (passedRuns / runCount) * 100 : 0;
        result.push({ date: iso, runCount, passedRuns, failedRuns, passRate });
      } else {
        result.push({ date: iso, runCount: 0, passedRuns: 0, failedRuns: 0, passRate: 0 });
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

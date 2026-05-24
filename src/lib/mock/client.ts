import {
  mockProjects, mockRunsByProject, mockApiKeysByProject,
  mockTribes, mockSquads, mockUsers, mockNodesByProject,
  mockScenariosByProject, mockPlansByProject
} from './data';
import type { Project } from '$lib/api/projects';
import type { AutomationRun, ScenarioRunResult } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { PlanMetrics, PlanScenario, ReleasePlan } from '$lib/api/plans';
import type { Scenario, TestDirectory } from '$lib/api/testcases';
import type { ProjectStatistic } from '$lib/api/statistics';
import type { CursorPage } from '$lib/api/pagination';

export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK === 'true';
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function mockListProjects(_cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<Project>> {
  await delay(150);
  return { items: mockProjects, nextCursor: null };
}

export async function mockGetProject(projectKey: string): Promise<Project> {
  await delay(100);
  const p = mockProjects.find(p => p.projectKey === projectKey);
  if (!p) throw new Error(`Project ${projectKey} not found`);
  return p;
}

export async function mockListRuns(projectKey: string, _cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<AutomationRun>> {
  await delay(150);
  return { items: mockRunsByProject[projectKey] ?? [], nextCursor: null };
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
  return { items: mockTribes, nextCursor: null };
}

export async function mockListSquads(tribeId: string, _cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<Squad>> {
  await delay(100);
  return { items: mockSquads[tribeId] ?? [], nextCursor: null };
}

export async function mockListUsers(_cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<User>> {
  await delay(100);
  return { items: mockUsers, nextCursor: null };
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
  return nodeId ? byStatus.filter(s => s.nodeId === nodeId) : byStatus;
}

export async function mockListPlans(projectKey: string, _cursor?: string, _limit?: number, _sortBy?: string, _sortDir?: string): Promise<CursorPage<ReleasePlan>> {
  await delay(120);
  return { items: mockPlansByProject[projectKey] ?? [], nextCursor: null };
}

export async function mockGetPlan(projectKey: string, planId: string): Promise<ReleasePlan> {
  await delay(100);
  const plan = mockPlansByProject[projectKey]?.find(item => item.id === planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);
  return plan;
}

export async function mockListPlanScenarios(projectKey: string, _planId: string): Promise<PlanScenario[]> {
  await delay(100);
  return (mockScenariosByProject[projectKey] ?? []).filter(scenario => scenario.status === 'ACTIVE').map((scenario, index) => ({
    id: `plan-scenario-${index}`,
    scenarioId: scenario.id,
    scenarioKey: scenario.scenarioKey,
    name: scenario.name,
    priority: scenario.priority,
    automationStatus: scenario.automationStatus,
    createdAt: scenario.createdAt
  }));
}

export async function mockGetPlanMetrics(projectKey: string, planId: string): Promise<PlanMetrics> {
  const scenarios = await mockListPlanScenarios(projectKey, planId);
  const selectedExecutions = scenarios.length ? Math.max(1, scenarios.length - 1) : 0;
  const passed = selectedExecutions;
  return {
    planId,
    totalScenarios: scenarios.length,
    selectedExecutions,
    passed,
    failed: 0,
    blocked: 0,
    skipped: 0,
    executionCoverage: scenarios.length ? Number(((selectedExecutions / scenarios.length) * 100).toFixed(2)) : 0,
    passPercentage: selectedExecutions ? 100 : 0,
    automationCoverage: scenarios.length ? Number(((scenarios.filter(s => s.automationStatus === 'AUTOMATED').length / scenarios.length) * 100).toFixed(2)) : 0,
    qualityGate: selectedExecutions === scenarios.length ? 'PASS' : 'WARNING'
  };
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

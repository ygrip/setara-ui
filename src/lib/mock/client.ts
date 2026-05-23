import {
  mockProjects, mockRunsByProject, mockApiKeysByProject,
  mockTribes, mockSquads, mockUsers, mockNodesByProject,
  mockScenariosByProject, mockPlansByProject
} from './data';
import type { Project } from '$lib/api/projects';
import type { AutomationRun } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { ReleasePlan } from '$lib/api/plans';
import type { Scenario, TestNode } from '$lib/api/testcases';
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

export async function mockListNodes(projectKey: string): Promise<TestNode[]> {
  await delay(100);
  return mockNodesByProject[projectKey] ?? [];
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

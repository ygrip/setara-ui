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

export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK === 'true';
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function mockListProjects(): Promise<Project[]> {
  await delay(150);
  return mockProjects;
}

export async function mockGetProject(projectKey: string): Promise<Project> {
  await delay(100);
  const p = mockProjects.find(p => p.projectKey === projectKey);
  if (!p) throw new Error(`Project ${projectKey} not found`);
  return p;
}

export async function mockListRuns(projectKey: string): Promise<AutomationRun[]> {
  await delay(150);
  return mockRunsByProject[projectKey] ?? [];
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

export async function mockListTribes(): Promise<Tribe[]> {
  await delay(120);
  return mockTribes;
}

export async function mockListSquads(tribeId: string): Promise<Squad[]> {
  await delay(100);
  return mockSquads[tribeId] ?? [];
}

export async function mockListUsers(): Promise<User[]> {
  await delay(100);
  return mockUsers;
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

export async function mockListPlans(projectKey: string): Promise<ReleasePlan[]> {
  await delay(120);
  return mockPlansByProject[projectKey] ?? [];
}

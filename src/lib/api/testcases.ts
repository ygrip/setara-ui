import { getApiBaseUrl } from './config';
import { isMockMode, mockListNodes, mockListScenarios } from '$lib/mock/client';

export interface TestNode {
  id: string;
  parentId: string | null;
  nodeType: 'DIRECTORY' | 'FEATURE';
  directoryId: string | null;
  name: string;
  slug: string;
  path: string;
  createdAt: string;
}

export interface Scenario {
  id: string;
  nodeId: string;
  scenarioKey: string;
  name: string;
  source: string;
  cucumberId: string | null;
  featureUri: string | null;
  featureName: string | null;
  lineNumber: number | null;
  tags: string[];
  priority: string | null;
  automationStatus: string;
  automatable: boolean;
  automationNotes: string | null;
  manualNotes: string | null;
  status: string;
  steps: ScenarioStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  id?: string;
  sequenceNo: number;
  keyword: string;
  name: string;
  description: string | null;
  expectation: string | null;
}

export interface ManualExecution {
  id: string;
  scenarioId: string;
  status: string;
  executedBy: string | null;
  environment: string | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listNodes(projectKey: string): Promise<TestNode[]> {
  if (isMockMode()) return mockListNodes(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}/nodes`);
  return res.json();
}

export async function listNodeChildren(projectKey: string, nodeId: string): Promise<TestNode[]> {
  const res = await apiFetch(`/api/projects/${projectKey}/nodes/${nodeId}/children`);
  return res.json();
}

export async function createNode(projectKey: string, body: {
  parentId?: string | null;
  nodeType: 'DIRECTORY' | 'FEATURE';
  name: string;
}): Promise<TestNode> {
  const res = await apiFetch(`/api/projects/${projectKey}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function renameNode(projectKey: string, nodeId: string, name: string): Promise<TestNode> {
  const res = await apiFetch(`/api/projects/${projectKey}/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

export async function deleteNode(projectKey: string, nodeId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/nodes/${nodeId}`, { method: 'DELETE' });
}

export async function listScenarios(projectKey: string, nodeId?: string | null, status = 'ACTIVE'): Promise<Scenario[]> {
  if (isMockMode()) return mockListScenarios(projectKey, nodeId, status);
  const params = new URLSearchParams();
  if (nodeId) params.set('nodeId', nodeId);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios${query}`);
  return res.json();
}

export async function createScenario(projectKey: string, body: {
  nodeId: string;
  name: string;
  priority?: string;
  automatable?: boolean;
  notes?: string;
  steps?: Array<Omit<ScenarioStep, 'id'>>;
}): Promise<Scenario> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function updateScenario(projectKey: string, scenarioId: string, body: {
  name?: string;
  priority?: string;
  automatable?: boolean;
  automationStatus?: string;
  automationNotes?: string;
  manualNotes?: string;
  steps?: Array<Omit<ScenarioStep, 'id'>>;
}): Promise<Scenario> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function archiveScenario(projectKey: string, scenarioId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`, { method: 'DELETE' });
}

export async function approveDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
}

export async function rejectDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
}

export async function createManualExecution(projectKey: string, scenarioId: string, body: {
  status: string;
  executedBy?: string;
  environment?: string;
  notes?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}): Promise<ManualExecution> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}/manual-executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

import { getApiBaseUrl } from './config';
import { isMockMode, mockAddBuildScenario, mockCreateBuild, mockGetBuild, mockListBuildAudit, mockListBuildScenarios, mockListBuilds, mockVerifyBuild } from '$lib/mock/client';

export interface ProjectBuild {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  squadId: string | null;
  squadName: string | null;
  name: string;
  buildKey: string;
  version: string | null;
  description: string | null;
  status: 'INITIATED' | 'IN_PROGRESS' | 'VERIFIED' | string;
  initiatedAt: string;
  inProgressAt: string | null;
  verifiedAt: string | null;
  createdBy: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: BuildMetrics;
}

export interface BuildMetrics {
  buildId: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
  passPercentage: number;
  executionCoverage: number;
}

export interface BuildScenario {
  id: string;
  scenarioId: string;
  scenarioKey: string;
  name: string;
  priority: string | null;
  expectedStatus: string;
  latestStatus: string;
  source: string;
  executedBy: string | null;
  executedAt: string | null;
  addedAt: string;
  featureName?: string | null;
  directoryPath?: string | null;
}

export interface BuildAuditEvent {
  id: string;
  eventType: string;
  actor: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listBuilds(projectKey: string, status?: string, sortBy?: string): Promise<ProjectBuild[]> {
  if (isMockMode()) return mockListBuilds(projectKey);
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sortBy) params.set('sort_by', sortBy);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/builds${qs}`);
  return res.json();
}

export async function createBuild(projectKey: string, body: {
  name: string;
  buildKey?: string;
  version?: string;
  description?: string;
  createdBy?: string;
}): Promise<ProjectBuild> {
  if (isMockMode()) return mockCreateBuild(projectKey, body);
  const res = await apiFetch(`/api/projects/${projectKey}/builds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function getBuild(projectKey: string, buildId: string): Promise<ProjectBuild> {
  if (isMockMode()) return mockGetBuild(projectKey, buildId);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}`);
  return res.json();
}

export async function listBuildScenarios(projectKey: string, buildId: string): Promise<BuildScenario[]> {
  if (isMockMode()) return mockListBuildScenarios(projectKey, buildId);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/scenarios`);
  return res.json();
}

export async function addBuildScenario(projectKey: string, buildId: string, body: { scenarioId: string; source?: string; addedBy?: string }): Promise<BuildScenario> {
  if (isMockMode()) return mockAddBuildScenario(projectKey, buildId, body);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function verifyBuild(projectKey: string, buildId: string, body: { verifiedBy?: string; notes?: string } = {}): Promise<ProjectBuild> {
  if (isMockMode()) return mockVerifyBuild(projectKey, buildId, body);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listBuildAudit(projectKey: string, buildId: string): Promise<BuildAuditEvent[]> {
  if (isMockMode()) return mockListBuildAudit(projectKey, buildId);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/audit`);
  return res.json();
}

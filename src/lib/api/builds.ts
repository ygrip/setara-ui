import { getApiBaseUrl } from './config';
import { isMockMode, mockAddBuildScenario, mockCreateBuild, mockGetBuild, mockListBuildAudit, mockListBuildScenarios, mockListBuilds, mockVerifyBuild, mockUpdateBuildScenarioResult, mockRemoveBuildScenarios, mockAddAutomationToBuild, mockGetBuildByVersion } from '$lib/mock/client';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

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
  featureName: string | null;
  directoryPath: string | null;
  priority: string | null;
  expectedStatus: string;
  latestStatus: string;
  source: string;
  executedBy: string | null;
  executedAt: string | null;
  addedAt: string;
}

export interface RunScenarioView {
  id: string;
  scenarioId: string | null;
  scenarioKey: string | null;
  scenarioName: string;
  status: string;
  cucumberId: string | null;
  featureName: string | null;
  featureUri: string | null;
  tags: string[] | null;
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

export async function listBuilds(projectKey: string, status?: string, sortBy?: string, sortDir?: string): Promise<ProjectBuild[]> {
  if (isMockMode()) return mockListBuilds(projectKey);
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sortBy) params.set('sort_by', sortBy);
  if (sortDir) params.set('sort_dir', sortDir);
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

export async function listBuildScenarios(projectKey: string, buildId: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<BuildScenario>> {
  if (isMockMode()) {
    const items = await mockListBuildScenarios(projectKey, buildId);
    return { items, nextCursor: null, prevCursor: null };
  }
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  if (sortBy) params.set('sort_by', sortBy);
  if (sortDir) params.set('sort_dir', sortDir);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/scenarios${qs}`);
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

export async function listBuildAudit(projectKey: string, buildId: string, cursor?: string, limit?: number): Promise<CursorPage<BuildAuditEvent>> {
  if (isMockMode()) {
    const items = await mockListBuildAudit(projectKey, buildId);
    return { items, nextCursor: null, prevCursor: null };
  }
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/audit${qs}`);
  return res.json();
}

export async function updateBuildScenarioResult(
  projectKey: string,
  buildId: string,
  buildScenarioId: string,
  body: { status: string; notes?: string; executedBy?: string }
): Promise<BuildScenario> {
  if (isMockMode()) return mockUpdateBuildScenarioResult(projectKey, buildId, buildScenarioId, body);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/scenarios/${buildScenarioId}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function removeBuildScenarios(
  projectKey: string,
  buildId: string,
  buildScenarioIds: string[]
): Promise<void> {
  if (isMockMode()) return mockRemoveBuildScenarios(projectKey, buildId, buildScenarioIds);
  await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/scenarios/bulk-remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: buildScenarioIds })
  });
}

export async function addAutomationToBuild(
  projectKey: string,
  buildId: string,
  body: { runId: string; addedBy?: string }
): Promise<ProjectBuild> {
  if (isMockMode()) { await mockAddAutomationToBuild(projectKey, buildId, body); return {} as ProjectBuild; }
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listRunScenarios(projectKey: string, runId: string): Promise<RunScenarioView[]> {
  if (isMockMode()) return [];
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}/scenarios`);
  return res.json();
}

export async function getBuildByVersion(projectKey: string, version: string): Promise<ProjectBuild | null> {
  if (isMockMode()) return mockGetBuildByVersion(projectKey, version);
  try {
    const res = await apiFetch(`/api/projects/${projectKey}/builds?version=${encodeURIComponent(version)}`);
    const results: ProjectBuild[] = await res.json();
    return results[0] ?? null;
  } catch {
    return null;
  }
}

import { getApiBaseUrl } from './config';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListRuns, mockGetRun, mockListRunResults, mockGetRunHeatmap } from '$lib/mock/client';

export interface HeatmapDay {
  date: string;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
}

export interface AutomationRun {
  id: string;
  projectId: string;
  projectKey: string;
  runnerId: string;
  jobName: string | null;
  environment: string | null;
  branch: string | null;
  commitSha: string | null;
  framework: string | null;
  buildId?: string | null;
  buildKey?: string | null;
  buildName?: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  totalScenarios?: number | null;
  passedScenarios?: number | null;
  failedScenarios?: number | null;
  skippedScenarios?: number | null;
  undefinedScenarios?: number | null;
  pendingScenarios?: number | null;
  durationMs?: number | null;
  notes?: string | null;
}

export interface ScenarioRunResult {
  id: string;
  runId: string;
  scenarioId: string | null;
  cucumberId: string | null;
  featureUri: string | null;
  featureName: string | null;
  scenarioName: string;
  scenarioLine: number | null;
  tags: string[] | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exceptionType: string | null;
  exceptionMessage: string | null;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listRuns(projectKey: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<AutomationRun>> {
  if (isMockMode()) return mockListRuns(projectKey, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/projects/${projectKey}/runs${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function getRun(projectKey: string, runId: string): Promise<AutomationRun> {
  if (isMockMode()) return mockGetRun(projectKey, runId);
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}`);
  return res.json();
}

export async function listRunResults(projectKey: string, runId: string): Promise<ScenarioRunResult[]> {
  if (isMockMode()) return mockListRunResults(projectKey, runId);
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}/results`);
  return res.json();
}

export async function getRunHeatmap(projectKey: string, days = 182): Promise<HeatmapDay[]> {
  if (isMockMode()) return mockGetRunHeatmap(projectKey, days);
  const params = new URLSearchParams({ days: String(days) });
  const res = await apiFetch(`/api/projects/${projectKey}/runs/heatmap?${params}`);
  return res.json();
}

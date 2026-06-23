import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
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
  reportUrl?: string | null;
  reportPath?: string | null;
}

export interface StepRunResult {
  keyword: string | null;
  name: string | null;
  line: number | null;
  status: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  description: string | null;
  expectation: string | null;
}

export interface ScenarioRunResult {
  id: string;
  runId: string;
  scenarioId: string | null;
  scenarioKey: string | null;
  cucumberId: string | null;
  featureUri: string | null;
  featureName: string | null;
  scenarioName: string;
  sequenceNo: number | null;
  scenarioLine: number | null;
  tags: string[] | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exceptionType: string | null;
  exceptionMessage: string | null;
  stepsJson: StepRunResult[] | null;
  failedStepIndex: number | null;
}

export async function listRuns(projectKey: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<AutomationRun>> {
  if (isMockMode()) return mockListRuns(projectKey, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/projects/${projectKey}/runs${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return readJsonOrThrow<CursorPage<AutomationRun>>(res);
}

export async function getRun(projectKey: string, runId: string): Promise<AutomationRun> {
  if (isMockMode()) return mockGetRun(projectKey, runId);
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}`);
  return readJsonOrThrow<AutomationRun>(res);
}

export async function listRunResults(
  projectKey: string,
  runId: string,
  opts?: { status?: string; search?: string; sortBy?: string; sortDir?: string }
): Promise<ScenarioRunResult[]> {
  if (isMockMode()) return mockListRunResults(projectKey, runId);
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search?.trim()) params.set('search', opts.search.trim());
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}/results${qs}`);
  return readJsonOrThrow<ScenarioRunResult[]>(res);
}

export async function getRunResult(projectKey: string, resultId: string): Promise<ScenarioRunResult> {
  if (isMockMode()) {
    const results = await mockListRunResults(projectKey, resultId);
    return results[0] ?? { id: resultId, runId: resultId, scenarioId: null, scenarioKey: null, cucumberId: null, featureUri: null, featureName: null, scenarioName: 'Mock Scenario', sequenceNo: 1, scenarioLine: null, tags: null, status: 'PASSED', startedAt: null, finishedAt: null, durationMs: null, exceptionType: null, exceptionMessage: null, stepsJson: null, failedStepIndex: null };
  }
  const res = await apiFetch(`/api/projects/${projectKey}/run-results/${resultId}`);
  return readJsonOrThrow<ScenarioRunResult>(res);
}

export async function getRunHeatmap(projectKey: string, days = 182): Promise<HeatmapDay[]> {
  if (isMockMode()) return mockGetRunHeatmap(projectKey, days);
  const params = new URLSearchParams({ days: String(days) });
  const res = await apiFetch(`/api/projects/${projectKey}/runs/heatmap?${params}`);
  if (!res.ok) return [];
  return res.json();
}

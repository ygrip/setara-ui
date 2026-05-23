import { getApiBaseUrl } from './config';
import { isMockMode, mockListRuns, mockGetRun } from '$lib/mock/client';

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
  status: string;
  startedAt: string;
  finishedAt: string | null;
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

export async function listRuns(projectKey: string): Promise<AutomationRun[]> {
  if (isMockMode()) return mockListRuns(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}/runs`);
  return res.json();
}

export async function getRun(projectKey: string, runId: string): Promise<AutomationRun> {
  if (isMockMode()) return mockGetRun(projectKey, runId);
  const res = await apiFetch(`/api/projects/${projectKey}/runs/${runId}`);
  return res.json();
}

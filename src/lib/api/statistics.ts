import { getApiBaseUrl } from './config';
import { isMockMode, mockListProjectStatistics } from '$lib/mock/client';

export interface ProjectStatistic {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  statDate: string;
  totalScenarios: number;
  totalAutomated: number;
  totalAutomatable: number;
  coveragePercentage: number;
  updatedAt: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listProjectStatistics(): Promise<ProjectStatistic[]> {
  if (isMockMode()) return mockListProjectStatistics();
  const res = await apiFetch('/api/statistics/projects/latest');
  return res.json();
}

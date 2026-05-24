import { getApiBaseUrl } from './config';
import {
  isMockMode,
  mockListProjectStatistics,
  mockListProjectStatisticHistory
} from '$lib/mock/client';

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

export interface DashboardSummary {
  totalSquads: number;
  totalProjects: number;
  totalScenarios: number;
  overallPassPercentage: number;
  automationCoveragePercentage: number;
}

export interface AggregateStatisticPoint {
  bucketDate: string;
  totalScenarios: number;
  totalAutomated: number;
  totalAutomatable: number;
  automationCoveragePercentage: number;
}

export interface SquadCoverage {
  squadId: string;
  squadName: string;
  tribeId: string | null;
  tribeName: string | null;
  projectCount: number;
  totalScenarios: number;
  totalAutomated: number;
  totalAutomatable: number;
  coveragePercentage: number;
}

export interface SquadProjectCoverage {
  projectId: string;
  projectKey: string;
  projectName: string;
  totalScenarios: number;
  totalAutomated: number;
  totalAutomatable: number;
  coveragePercentage: number;
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

export async function listProjectStatisticHistory(projectKey: string, days = 30): Promise<ProjectStatistic[]> {
  if (isMockMode()) return mockListProjectStatisticHistory(projectKey, days);
  const params = new URLSearchParams({ days: String(days) });
  const res = await apiFetch(`/api/statistics/projects/${projectKey}/history?${params}`);
  return res.json();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (isMockMode()) {
    const stats = await mockListProjectStatistics();
    const totalScenarios = stats.reduce((sum, row) => sum + row.totalScenarios, 0);
    const totalAutomated = stats.reduce((sum, row) => sum + row.totalAutomated, 0);
    const totalAutomatable = stats.reduce((sum, row) => sum + row.totalAutomatable, 0);
    return {
      totalSquads: 4,
      totalProjects: stats.length,
      totalScenarios,
      overallPassPercentage: 92,
      automationCoveragePercentage: totalAutomatable ? Number(((totalAutomated / totalAutomatable) * 100).toFixed(2)) : 0
    };
  }
  const res = await apiFetch('/api/statistics/dashboard/summary');
  return res.json();
}

export async function listAggregateStatisticHistory(start: string, end: string, groupedBy: 'daily' | 'weekly' | 'monthly'): Promise<AggregateStatisticPoint[]> {
  if (isMockMode()) {
    const stats = await mockListProjectStatistics();
    const totalScenarios = stats.reduce((sum, row) => sum + row.totalScenarios, 0);
    const totalAutomated = stats.reduce((sum, row) => sum + row.totalAutomated, 0);
    const totalAutomatable = stats.reduce((sum, row) => sum + row.totalAutomatable, 0);
    const days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
    return Array.from({ length: Math.min(days + 1, 60) }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      const drift = index % 7;
      const automated = Math.max(0, totalAutomated - drift);
      return {
        bucketDate: date.toISOString().slice(0, 10),
        totalScenarios,
        totalAutomated: automated,
        totalAutomatable,
        automationCoveragePercentage: totalAutomatable ? Number(((automated / totalAutomatable) * 100).toFixed(2)) : 0
      };
    });
  }
  const params = new URLSearchParams({ start, end, grouped_by: groupedBy });
  const res = await apiFetch(`/api/statistics/projects/aggregate-history?${params}`);
  return res.json();
}

export async function listSquadCoverage(params: {
  tribe?: string;
  squad?: string;
  sortBy?: 'name' | 'coverage';
  sortDir?: 'asc' | 'desc';
} = {}): Promise<SquadCoverage[]> {
  if (isMockMode()) {
    const stats = await mockListProjectStatistics();
    return [{
      squadId: 'mock-squad',
      squadName: params.squad || 'Payments Squad',
      tribeId: 'mock-tribe',
      tribeName: params.tribe || 'Commerce',
      projectCount: stats.length,
      totalScenarios: stats.reduce((sum, row) => sum + row.totalScenarios, 0),
      totalAutomated: stats.reduce((sum, row) => sum + row.totalAutomated, 0),
      totalAutomatable: stats.reduce((sum, row) => sum + row.totalAutomatable, 0),
      coveragePercentage: stats.length ? Number((stats.reduce((sum, row) => sum + row.coveragePercentage, 0) / stats.length).toFixed(2)) : 0
    }];
  }
  const query = new URLSearchParams();
  if (params.tribe) query.set('tribe', params.tribe);
  if (params.squad) query.set('squad', params.squad);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortDir) query.set('sort_dir', params.sortDir);
  const res = await apiFetch(`/api/statistics/coverage/squads?${query}`);
  return res.json();
}

export async function listSquadProjectCoverage(squadId: string, params: {
  project?: string;
  sortBy?: 'name' | 'coverage';
  sortDir?: 'asc' | 'desc';
} = {}): Promise<SquadProjectCoverage[]> {
  if (isMockMode()) {
    const stats = await mockListProjectStatistics();
    return stats.map(row => ({
      projectId: row.projectId,
      projectKey: row.projectKey,
      projectName: row.projectName,
      totalScenarios: row.totalScenarios,
      totalAutomated: row.totalAutomated,
      totalAutomatable: row.totalAutomatable,
      coveragePercentage: row.coveragePercentage
    }));
  }
  const query = new URLSearchParams();
  if (params.project) query.set('project', params.project);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortDir) query.set('sort_dir', params.sortDir);
  const res = await apiFetch(`/api/statistics/coverage/squads/${squadId}/projects?${query}`);
  return res.json();
}

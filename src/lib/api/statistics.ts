import { getApiBaseUrl } from './config';
import {
  isMockMode,
  mockListProjectStatistics,
  mockListProjectStatisticHistory
} from '$lib/mock/client';
import { mockSquads, mockTribes, mockProjects, mockScenariosByProject } from '$lib/mock/data';

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
    const totalSquads = Object.values(mockSquads).reduce((sum, arr) => sum + arr.length, 0);
    return {
      totalSquads,
      totalProjects: mockProjects.length,
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

    // Step size in days based on groupedBy
    const step = groupedBy === 'monthly' ? 30 : groupedBy === 'weekly' ? 7 : 1;

    const points: AggregateStatisticPoint[] = [];
    let currentDay = 0;
    let bucketIndex = 0;
    while (currentDay <= days && points.length < 60) {
      const date = new Date(start);
      date.setDate(date.getDate() + currentDay);
      // Add realistic variation: gradual growth + small oscillation
      const growthFactor = Math.min(1, 0.75 + (currentDay / days) * 0.25);
      const oscillation = Math.sin(bucketIndex * 0.8) * totalAutomated * 0.04;
      const automated = Math.max(0, Math.round(totalAutomated * growthFactor + oscillation));
      points.push({
        bucketDate: date.toISOString().slice(0, 10),
        totalScenarios: Math.round(totalScenarios * growthFactor),
        totalAutomated: automated,
        totalAutomatable,
        automationCoveragePercentage: totalAutomatable ? Number(((automated / totalAutomatable) * 100).toFixed(2)) : 0
      });
      currentDay += step;
      bucketIndex++;
    }
    return points;
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
    // Build a flat list of all squads, finding their tribe info
    const tribeById = new Map(mockTribes.map(t => [t.id, t]));
    const allSquads = Object.values(mockSquads).flat();

    const result: SquadCoverage[] = allSquads
      .filter(squad => {
        if (params.squad && !squad.name.toLowerCase().includes(params.squad.toLowerCase())) return false;
        if (params.tribe) {
          const tribe = tribeById.get(squad.tribeId);
          if (!tribe || !tribe.name.toLowerCase().includes(params.tribe.toLowerCase())) return false;
        }
        return true;
      })
      .map(squad => {
        const squadProjects = mockProjects.filter(p => p.squadId === squad.id);
        let total = 0, automated = 0, automatable = 0;
        for (const proj of squadProjects) {
          const scenarios = mockScenariosByProject[proj.projectKey] ?? [];
          total += scenarios.length;
          automated += scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
          automatable += scenarios.filter(s => s.automationStatus === 'AUTOMATED' || s.automationStatus === 'AUTOMATABLE').length;
        }
        const tribe = tribeById.get(squad.tribeId);
        return {
          squadId: squad.id,
          squadName: squad.name,
          tribeId: squad.tribeId,
          tribeName: tribe?.name ?? '',
          projectCount: squadProjects.length,
          totalScenarios: total,
          totalAutomated: automated,
          totalAutomatable: automatable,
          coveragePercentage: automatable ? Number(((automated / automatable) * 100).toFixed(2)) : 0
        };
      });

    if (params.sortBy === 'coverage') {
      result.sort((a, b) => params.sortDir === 'desc' ? b.coveragePercentage - a.coveragePercentage : a.coveragePercentage - b.coveragePercentage);
    } else {
      result.sort((a, b) => params.sortDir === 'desc' ? b.squadName.localeCompare(a.squadName) : a.squadName.localeCompare(b.squadName));
    }
    return result;
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
    const squadProjects = mockProjects.filter(p => p.squadId === squadId);
    const result: SquadProjectCoverage[] = squadProjects.map(proj => {
      const scenarios = mockScenariosByProject[proj.projectKey] ?? [];
      const totalScenarios = scenarios.length;
      const totalAutomated = scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
      const totalAutomatable = scenarios.filter(s => s.automationStatus === 'AUTOMATED' || s.automationStatus === 'AUTOMATABLE').length;
      return {
        projectId: proj.id,
        projectKey: proj.projectKey,
        projectName: proj.name,
        totalScenarios,
        totalAutomated,
        totalAutomatable,
        coveragePercentage: totalAutomatable ? Number(((totalAutomated / totalAutomatable) * 100).toFixed(2)) : 0
      };
    });
    return result;
  }
  const query = new URLSearchParams();
  if (params.project) query.set('project', params.project);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortDir) query.set('sort_dir', params.sortDir);
  const res = await apiFetch(`/api/statistics/coverage/squads/${squadId}/projects?${query}`);
  return res.json();
}

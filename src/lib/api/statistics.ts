import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import {
  isMockMode,
  mockListProjectStatistics,
  mockListProjectStatisticHistory
} from '$lib/mock/client';
import { mockSquads, mockTribes, mockProjects, mockScenariosByProject, mockRunsByProject, mockStatisticsOverride } from '$lib/mock/data';

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
  overallPassRatePercentage: number;
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

export async function listProjectStatistics(): Promise<ProjectStatistic[]> {
  if (isMockMode()) return mockListProjectStatistics();
  const res = await apiFetch('/api/statistics/projects/latest');
  return readJsonOrThrow(res);
}

export async function listProjectStatisticHistory(projectKey: string, start: string, end: string, groupedBy: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<ProjectStatistic[]> {
  if (isMockMode()) return mockListProjectStatisticHistory(projectKey, start, end, groupedBy);
  const params = new URLSearchParams({ start, end, grouped_by: groupedBy });
  const res = await apiFetch(`/api/statistics/projects/${projectKey}/history?${params}`);
  return readJsonOrThrow(res);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (isMockMode()) {
    // Use override stats for realistic dashboard numbers
    const allOverrides = Object.values(mockStatisticsOverride);
    const totalScenarios   = allOverrides.reduce((s, r) => s + r.totalScenarios,   0);
    const totalAutomated   = allOverrides.reduce((s, r) => s + r.totalAutomated,   0);
    const totalAutomatable = allOverrides.reduce((s, r) => s + r.totalAutomatable, 0);
    const totalSquads = Object.values(mockSquads).reduce((sum, arr) => sum + arr.length, 0);
    // Compute overall pass rate from recent runs
    const allRuns = Object.values(mockRunsByProject).flat().filter(r => r.finishedAt && r.totalScenarios);
    const recentRuns = allRuns.slice(-30);
    const totalPass = recentRuns.reduce((s, r) => s + (r.passedScenarios ?? 0), 0);
    const totalRun  = recentRuns.reduce((s, r) => s + (r.totalScenarios  ?? 0), 0);
    return {
      totalSquads,
      totalProjects: mockProjects.length,
      totalScenarios,
      overallPassPercentage: totalRun > 0 ? Number(((totalPass / totalRun) * 100).toFixed(1)) : 91.2,
      automationCoveragePercentage: totalAutomatable ? Number(((totalAutomated / totalAutomatable) * 100).toFixed(2)) : 0
    };
  }
  const res = await apiFetch('/api/statistics/dashboard/summary');
  return readJsonOrThrow(res);
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

    // Build a lookup of run pass-rate by start date for realistic pass-rate trend
    const allRuns = Object.values(mockRunsByProject).flat().filter(r => r.finishedAt);

    const points: AggregateStatisticPoint[] = [];
    let currentDay = 0;
    let bucketIndex = 0;
    while (currentDay <= days && points.length < 60) {
      const date = new Date(start);
      date.setDate(date.getDate() + currentDay);
      const bucketDateStr = date.toISOString().slice(0, 10);
      // Add realistic variation: gradual growth + small oscillation
      const growthFactor = Math.min(1, 0.75 + (currentDay / days) * 0.25);
      const oscillation = Math.sin(bucketIndex * 0.8) * totalAutomated * 0.04;
      const automated = Math.max(0, Math.round(totalAutomated * growthFactor + oscillation));
      // Pass-rate: use actual runs if any fall in this bucket, else simulate
      const bucketEnd = new Date(date);
      bucketEnd.setDate(bucketEnd.getDate() + step);
      const bucketRuns = allRuns.filter(r => {
        const d = r.startedAt.slice(0, 10);
        return d >= bucketDateStr && d < bucketEnd.toISOString().slice(0, 10);
      });
      let passRatePercentage: number;
      if (bucketRuns.length > 0) {
        const passed = bucketRuns.reduce((s, r) => s + (r.passedScenarios ?? 0), 0);
        const total = bucketRuns.reduce((s, r) => s + (r.totalScenarios ?? 0), 0);
        passRatePercentage = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 85;
      } else {
        // Simulate: gradual improvement with small oscillation around 85%
        const base = 80 + (currentDay / Math.max(days, 1)) * 10;
        passRatePercentage = Math.min(100, Math.max(50, Math.round(base + Math.sin(bucketIndex * 1.4) * 6)));
      }
      points.push({
        bucketDate: bucketDateStr,
        totalScenarios: Math.round(totalScenarios * growthFactor),
        totalAutomated: automated,
        totalAutomatable,
        automationCoveragePercentage: totalAutomatable ? Number(((automated / totalAutomatable) * 100).toFixed(2)) : 0,
        overallPassRatePercentage: passRatePercentage
      });
      currentDay += step;
      bucketIndex++;
    }
    return points;
  }
  const params = new URLSearchParams({ start, end, grouped_by: groupedBy });
  const res = await apiFetch(`/api/statistics/projects/aggregate-history?${params}`);
  return readJsonOrThrow(res);
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
          const ov = mockStatisticsOverride[proj.projectKey];
          if (ov) {
            total      += ov.totalScenarios;
            automated  += ov.totalAutomated;
            automatable+= ov.totalAutomatable;
          } else {
            const scenarios = mockScenariosByProject[proj.projectKey] ?? [];
            total      += scenarios.length;
            automated  += scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
            automatable+= scenarios.filter(s => s.automationStatus === 'AUTOMATED' || s.automationStatus === 'AUTOMATABLE').length;
          }
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
  return readJsonOrThrow(res);
}

export interface SquadHistoryPoint {
  bucketDate: string;
  totalScenarios: number;
  totalAutomated: number;
  coveragePercentage: number;
  avgPassPercentage: number | null;
}

export async function listSquadHistory(
  squadId: string,
  start: string,
  end: string,
  groupedBy: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SquadHistoryPoint[]> {
  if (isMockMode()) {
    const days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
    const step = groupedBy === 'monthly' ? 30 : groupedBy === 'weekly' ? 7 : 1;
    const points: SquadHistoryPoint[] = [];
    for (let i = 0; i <= days; i += step) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const base = 55 + (i / Math.max(days, 1)) * 25;
      const passBase = 72 + (i / Math.max(days, 1)) * 15;
      points.push({
        bucketDate: d.toISOString().slice(0, 10),
        totalScenarios: 120 + Math.round(i * 0.5),
        totalAutomated: Math.round((base / 100) * (120 + i * 0.5)),
        coveragePercentage: Math.min(100, Math.round(base + Math.sin(i * 0.7) * 4)),
        avgPassPercentage: Math.min(100, Math.round(passBase + Math.cos(i * 0.5) * 5))
      });
    }
    return points;
  }
  const params = new URLSearchParams({ start, end, grouped_by: groupedBy });
  const res = await apiFetch(`/api/statistics/coverage/squads/${squadId}/history?${params}`);
  return readJsonOrThrow(res);
}

export interface BackfillResult {
  inserted: number;
  skipped: number;
  from: string;
  to: string;
}

export async function triggerBackfill(from?: string, to?: string): Promise<BackfillResult> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const res = await apiFetch(`/api/statistics/backfill?${query}`, { method: 'POST' });
  return readJsonOrThrow(res);
}

export async function listSquadProjectCoverage(squadId: string, params: {
  project?: string;
  sortBy?: 'name' | 'coverage';
  sortDir?: 'asc' | 'desc';
} = {}): Promise<SquadProjectCoverage[]> {
  if (isMockMode()) {
    const squadProjects = mockProjects.filter(p => p.squadId === squadId);
    const result: SquadProjectCoverage[] = squadProjects.map(proj => {
      const ov = mockStatisticsOverride[proj.projectKey];
      const scenarios = mockScenariosByProject[proj.projectKey] ?? [];
      const totalScenarios   = ov?.totalScenarios   ?? scenarios.length;
      const totalAutomated   = ov?.totalAutomated   ?? scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
      const totalAutomatable = ov?.totalAutomatable ?? scenarios.filter(s => s.automationStatus === 'AUTOMATED' || s.automationStatus === 'AUTOMATABLE').length;
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
  return readJsonOrThrow(res);
}

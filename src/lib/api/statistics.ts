import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import {
  isMockMode,
  mockListProjectStatistics,
  mockListProjectStatisticHistory
} from '$lib/mock/client';
import { mockSquads, mockTribes, mockProjects, mockScenariosByProject, mockRunsByProject, mockStatisticsOverride } from '$lib/mock/data';
import type { ProjectHealthStatus } from './projects';

export type SquadQualityRequest = {
  start?: string;
  end?: string;
  group?: 'daily' | 'weekly' | 'monthly';
};

export type SquadQualityProject = {
  id: string;
  key: string;
  name: string;
  totalScenarios: number;
  automatedScenarios: number;
  coveragePercent: number | null;
  passRatePercent: number | null;
  finishedExecutions: number;
  openFailures: number | null;
  flakyTests: number;
  lastExecutionAt: string | null;
  healthScore: number;
  status: ProjectHealthStatus;
};

export type SquadQualityOverview = {
  squad: { id: string; name: string; tribeId: string | null; tribeName: string | null };
  period: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    group: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  };
  summary: {
    totalProjects: number;
    totalScenarios: number;
    automatedScenarios: number;
    coveragePercent: number | null;
    passRatePercent: number | null;
    openFailures: number | null;
    projectsAtRisk: number;
    lastExecutionAt: string | null;
    healthScore: number;
    healthStatus: ProjectHealthStatus;
  };
  deltas: {
    totalScenarios: number | null;
    automatedScenarios: number | null;
    coveragePercent: number | null;
    passRatePercent: number | null;
    projectsAtRisk: number | null;
  };
  trend: Array<{
    date: string;
    totalScenarios: number;
    automatedScenarios: number;
    totalExecutions: number;
    coveragePercent: number | null;
    passRatePercent: number | null;
  }>;
  attention: {
    lowCoverage: string[];
    noRecentRun: string[];
    noScenarios: string[];
    highFailureRate: string[];
    flakyTests: string[];
  };
  thresholds: {
    coverageTargetPercent: number;
    passRateHealthyPercent: number;
    passRateHighRiskPercent: number;
    recentRunWindowDays: number;
    flakyTestsWarningThreshold: number;
  };
};

export type SquadProjectsPage = {
  items: SquadQualityProject[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
};

export type SquadProjectsRequest = {
  start?: string;
  end?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  search?: string;
  status?: string;
  page?: number;
  size?: number;
};

export async function getSquadQualityOverview(
  squadId: string,
  request: SquadQualityRequest = {}
): Promise<SquadQualityOverview> {
  if (isMockMode()) return createMockSquadQualityOverview(squadId, request);
  const params = new URLSearchParams();
  if (request.start) params.set('start', request.start);
  if (request.end) params.set('end', request.end);
  if (request.group) params.set('group', request.group);
  const suffix = params.size > 0 ? `?${params}` : '';
  const response = await apiFetch(`/api/squads/${squadId}/quality-overview${suffix}`);
  return readJsonOrThrow<SquadQualityOverview>(response);
}

export async function createMockSquadQualityOverview(
  squadId: string,
  request: SquadQualityRequest = {}
): Promise<SquadQualityOverview> {
  const squad = Object.values(mockSquads).flat().find((item) => item.id === squadId)
    ?? Object.values(mockSquads).flat()[0];
  const tribe = mockTribes.find((item) => item.id === squad.tribeId);
  const sourceProjects = mockProjects.filter((item) => item.squadId === squad.id);
  const projects = (sourceProjects.length > 0 ? sourceProjects : mockProjects.slice(0, 5)).map((project, index) => {
    const stats = mockStatisticsOverride[project.projectKey];
    const totalScenarios = index === 4 ? 0 : (stats?.totalScenarios ?? 60 + index * 15);
    const automatedScenarios = totalScenarios === 0 ? 0 : (stats?.totalAutomated ?? Math.round(totalScenarios * (0.92 - index * 0.08)));
    const runs = mockRunsByProject[project.projectKey] ?? [];
    const latest = runs.find((run) => run.finishedAt) ?? null;
    const finished = latest?.totalScenarios ?? (index === 3 || index === 4 ? 0 : totalScenarios);
    const passed = latest?.passedScenarios ?? Math.round(finished * (0.96 - index * 0.1));
    const passRate = finished > 0 ? Number((passed * 100 / finished).toFixed(2)) : null;
    const coverage = totalScenarios > 0 ? Number((automatedScenarios * 100 / totalScenarios).toFixed(2)) : null;
    const status: ProjectHealthStatus = finished === 0 ? 'NO_RUNS'
      : passRate != null && passRate < 60 ? 'CRITICAL'
      : passRate != null && passRate < 70 ? 'HIGH_RISK'
      : passRate != null && passRate < 85 ? 'NEEDS_REVIEW'
      : 'HEALTHY';
    return {
      id: project.id,
      key: project.projectKey,
      name: project.name,
      totalScenarios,
      automatedScenarios,
      coveragePercent: coverage,
      passRatePercent: passRate,
      finishedExecutions: finished,
      openFailures: finished > 0 ? Math.max(0, finished - passed) : null,
      flakyTests: index === 2 ? 4 : 0,
      lastExecutionAt: index === 3 || index === 4 ? null : latest?.finishedAt ?? `2026-07-0${6 - index}T10:00:00Z`,
      healthScore: status === 'HEALTHY' ? 90 : status === 'NEEDS_REVIEW' ? 76 : status === 'HIGH_RISK' ? 64 : status === 'CRITICAL' ? 50 : 0,
      status
    } satisfies SquadQualityProject;
  });
  const today = request.end ?? '2026-07-06';
  const start = request.start ?? '2026-06-23';
  const history = await listSquadHistory(squadId, start, today, request.group ?? 'daily');
  const totalScenarios = projects.reduce((sum, project) => sum + project.totalScenarios, 0);
  const automatedScenarios = projects.reduce((sum, project) => sum + project.automatedScenarios, 0);
  const covered = projects.filter((project) => project.totalScenarios > 0);
  const runProjects = projects.filter((project) => project.passRatePercent != null);
  const noScenarios = projects.filter((project) => project.totalScenarios === 0).map((project) => project.id);
  const noRecentRun = projects.filter((project) => project.totalScenarios > 0 && !project.lastExecutionAt).map((project) => project.id);
  const highFailureRate = projects.filter((project) => project.passRatePercent != null && project.passRatePercent < 75).map((project) => project.id);
  const lowCoverage = projects.filter((project) => project.coveragePercent != null && project.coveragePercent < 80 && !highFailureRate.includes(project.id)).map((project) => project.id);
  const flakyTests = projects.filter((project) => project.flakyTests >= 3 && !lowCoverage.includes(project.id)).map((project) => project.id);
  const projectsAtRisk = new Set([...noScenarios, ...noRecentRun, ...highFailureRate, ...lowCoverage, ...flakyTests]).size;
  return {
    squad: { id: squad.id, name: squad.name, tribeId: squad.tribeId, tribeName: tribe?.name ?? null },
    period: { start, end: today, previousStart: '2026-06-09', previousEnd: '2026-06-22', group: (request.group ?? 'daily').toUpperCase() as 'DAILY' | 'WEEKLY' | 'MONTHLY' },
    summary: {
      totalProjects: projects.length,
      totalScenarios,
      automatedScenarios,
      coveragePercent: covered.length === 0 ? null : Number((automatedScenarios * 100 / totalScenarios).toFixed(2)),
      passRatePercent: runProjects.length === 0 ? null : Number((runProjects.reduce((sum, project) => sum + (project.passRatePercent ?? 0), 0) / runProjects.length).toFixed(2)),
      openFailures: runProjects.length === 0 ? null : runProjects.reduce((sum, project) => sum + (project.openFailures ?? 0), 0),
      projectsAtRisk,
      lastExecutionAt: projects.map((project) => project.lastExecutionAt).filter((value): value is string => value != null).sort().at(-1) ?? null,
      healthScore: projectsAtRisk === 0 ? 90 : 72,
      healthStatus: projectsAtRisk === 0 ? 'HEALTHY' : 'NEEDS_REVIEW'
    },
    deltas: { totalScenarios: 3, automatedScenarios: 5, coveragePercent: 1.2, passRatePercent: 1.8, projectsAtRisk: -1 },
    trend: history.map((point) => ({ date: point.bucketDate, totalScenarios: point.totalScenarios, automatedScenarios: point.totalAutomated, totalExecutions: 12, coveragePercent: point.totalScenarios === 0 ? null : point.coveragePercentage, passRatePercent: point.avgPassPercentage })),
    attention: { lowCoverage, noRecentRun, noScenarios, highFailureRate, flakyTests },
    thresholds: { coverageTargetPercent: 80, passRateHealthyPercent: 90, passRateHighRiskPercent: 75, recentRunWindowDays: 7, flakyTestsWarningThreshold: 3 }
  };
}

export async function getSquadProjects(
  squadId: string,
  request: SquadProjectsRequest = {}
): Promise<SquadProjectsPage> {
  if (isMockMode()) {
    const squad = Object.values(mockSquads).flat().find((item) => item.id === squadId)
      ?? Object.values(mockSquads).flat()[0];
    const sourceProjects = mockProjects.filter((item) => item.squadId === squad.id);
    let items: SquadQualityProject[] = (sourceProjects.length > 0 ? sourceProjects : mockProjects.slice(0, 5)).map((project, index) => {
      const stats = mockStatisticsOverride[project.projectKey];
      const totalScenarios = index === 4 ? 0 : (stats?.totalScenarios ?? 60 + index * 15);
      const automatedScenarios = totalScenarios === 0 ? 0 : (stats?.totalAutomated ?? Math.round(totalScenarios * (0.92 - index * 0.08)));
      const runs = mockRunsByProject[project.projectKey] ?? [];
      const latest = runs.find((run) => run.finishedAt) ?? null;
      const finished = latest?.totalScenarios ?? (index === 3 || index === 4 ? 0 : totalScenarios);
      const passed = latest?.passedScenarios ?? Math.round(finished * (0.96 - index * 0.1));
      const passRate = finished > 0 ? Number((passed * 100 / finished).toFixed(2)) : null;
      const coverage = totalScenarios > 0 ? Number((automatedScenarios * 100 / totalScenarios).toFixed(2)) : null;
      const status: ProjectHealthStatus = finished === 0 ? 'NO_RUNS'
        : passRate != null && passRate < 60 ? 'CRITICAL'
        : passRate != null && passRate < 70 ? 'HIGH_RISK'
        : passRate != null && passRate < 85 ? 'NEEDS_REVIEW'
        : 'HEALTHY';
      return {
        id: project.id,
        key: project.projectKey,
        name: project.name,
        totalScenarios,
        automatedScenarios,
        coveragePercent: coverage,
        passRatePercent: passRate,
        finishedExecutions: finished,
        openFailures: finished > 0 ? Math.max(0, finished - passed) : null,
        flakyTests: index === 2 ? 4 : 0,
        lastExecutionAt: index === 3 || index === 4 ? null : latest?.finishedAt ?? `2026-07-0${6 - index}T10:00:00Z`,
        healthScore: status === 'HEALTHY' ? 90 : status === 'NEEDS_REVIEW' ? 76 : status === 'HIGH_RISK' ? 64 : status === 'CRITICAL' ? 50 : 0,
        status
      } satisfies SquadQualityProject;
    });
    if (request.search) {
      const q = request.search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
    }
    if (request.status) {
      items = items.filter((p) => p.status === request.status);
    }
    const sort = request.sort ?? 'health';
    const dir = request.dir ?? 'asc';
    items = [...items].sort((a, b) => {
      let diff = 0;
      if (sort === 'coverage') diff = (a.coveragePercent ?? 0) - (b.coveragePercent ?? 0);
      else if (sort === 'scenarios') diff = a.totalScenarios - b.totalScenarios;
      else if (sort === 'passrate') diff = (a.passRatePercent ?? 0) - (b.passRatePercent ?? 0);
      else if (sort === 'project') diff = a.name.localeCompare(b.name);
      else diff = a.healthScore - b.healthScore;
      return dir === 'asc' ? diff : -diff;
    });
    const page = request.page ?? 0;
    const size = request.size ?? 20;
    const from = page * size;
    const pageItems = items.slice(from, from + size);
    return { items: pageItems, page, size, total: items.length, hasNext: from + size < items.length };
  }
  const q = new URLSearchParams();
  if (request.start) q.set('start', request.start);
  if (request.end) q.set('end', request.end);
  if (request.sort) q.set('sort', request.sort);
  if (request.dir) q.set('dir', request.dir);
  if (request.search) q.set('q', request.search);
  if (request.status) q.set('status', request.status);
  if (request.page !== undefined) q.set('page', String(request.page));
  if (request.size !== undefined) q.set('size', String(request.size));
  const res = await apiFetch(`/api/squads/${squadId}/projects?${q}`);
  return readJsonOrThrow<SquadProjectsPage>(res);
}

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

import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import { isMockMode } from '$lib/mock/client';
import {
  mockProjects,
  mockRunsByProject,
  mockScenariosByProject,
  mockSquads,
  mockTribes,
  mockStatisticsOverride
} from '$lib/mock/data';

export type QualityHealthStatus =
  | 'HEALTHY'
  | 'NEEDS_REVIEW'
  | 'HIGH_RISK'
  | 'CRITICAL'
  | 'NO_RUNS'
  | 'NEUTRAL';

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
export type DashboardGroup = 'daily' | 'weekly' | 'monthly';
export type DashboardAttentionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DashboardAttentionType =
  | 'CRITICAL_PASS_RATE'
  | 'PASS_RATE_DROPPED'
  | 'HIGH_OPEN_FAILURES'
  | 'LOW_AUTOMATION'
  | 'AUTOMATION_DROPPED'
  | 'STALE_EXECUTION'
  | 'FLAKY_TESTS';

export type DashboardMetricSummary = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  deltaLabel: string;
  trendDirection: TrendDirection;
  status: QualityHealthStatus;
};

export type DashboardSummary = {
  qualityHealth: DashboardMetricSummary;
  projects: DashboardMetricSummary;
  squads: DashboardMetricSummary;
  testScenarios: DashboardMetricSummary;
  automationCoverage: DashboardMetricSummary;
  passRate: DashboardMetricSummary;
};

export type DashboardTrendPoint = {
  date: string;
  totalScenarios: number;
  automatedScenarios: number;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  automationCoverage: number;
  qualityHealthScore: number;
};

export type DashboardAttentionItem = {
  projectId: string;
  projectKey: string;
  projectName: string;
  type: DashboardAttentionType;
  severity: DashboardAttentionSeverity;
  title: string;
  description: string;
  affectedCount: number | null;
  affectedLabel: string | null;
  status: QualityHealthStatus;
  detectedAt: string;
};

export type DashboardSquadSummary = {
  squadId: string;
  squadName: string;
  tribeId: string | null;
  tribeName: string | null;
  projectCount: number;
  avgQualityHealthScore: number;
  status: QualityHealthStatus;
};

export type DashboardProjectOverview = {
  projectId: string;
  projectKey: string;
  projectName: string;
  totalScenarios: number;
  automatedScenarios: number;
  automationCoverage: number;
  passRate: number;
  finishedExecutions: number;
  openFailures: number;
  flakyScenarios: number;
  stabilityEvidenceAvailable: boolean;
  qualityHealthScore: number;
  status: QualityHealthStatus;
  lastActivityAt: string | null;
};

export type DashboardPeriod = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  group: 'DAILY' | 'WEEKLY' | 'MONTHLY';
};

export type DashboardResponse = {
  period: DashboardPeriod;
  summary: DashboardSummary;
  trends: DashboardTrendPoint[];
  attentionItems: DashboardAttentionItem[];
  projects: DashboardProjectOverview[];
  squads: DashboardSquadSummary[];
  lastUpdatedAt: string | null;
};

export type DashboardRequest = {
  start?: string;
  end?: string;
  group?: DashboardGroup;
  attentionLimit?: number;
};

export async function getDashboard(request: DashboardRequest = {}): Promise<DashboardResponse> {
  const period = resolvePeriod(request);
  if (isMockMode()) return buildMockDashboard(period, request.attentionLimit ?? 5);

  const params = new URLSearchParams({
    start: period.start,
    end: period.end,
    group: request.group ?? 'daily',
    attention_limit: String(request.attentionLimit ?? 5)
  });
  const response = await apiFetch(`/api/dashboard?${params}`);
  return readJsonOrThrow(response);
}

export function createMockDashboard(request: DashboardRequest = {}): DashboardResponse {
  return buildMockDashboard(resolvePeriod(request), request.attentionLimit ?? 5);
}

function resolvePeriod(request: DashboardRequest): DashboardPeriod {
  const end = request.end ? new Date(`${request.end}T00:00:00Z`) : new Date();
  const start = request.start ? new Date(`${request.start}T00:00:00Z`) : addDays(end, -29);
  const duration = Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(duration - 1));
  return {
    start: isoDate(start),
    end: isoDate(end),
    previousStart: isoDate(previousStart),
    previousEnd: isoDate(previousEnd),
    group: (request.group ?? 'daily').toUpperCase() as DashboardPeriod['group']
  };
}

function buildMockDashboard(period: DashboardPeriod, attentionLimit: number): DashboardResponse {
  const evaluatedAt = new Date(`${period.end}T23:59:59Z`);
  const previousEvaluatedAt = new Date(`${period.previousEnd}T23:59:59Z`);
  const projects = mockProjects.map((project) => mockProjectOverview(
    project,
    period.start,
    period.end,
    evaluatedAt
  ));
  const previousProjects = mockProjects.map((project) => mockProjectOverview(
    project,
    period.previousStart,
    period.previousEnd,
    previousEvaluatedAt
  ));
  projects.sort((left, right) => left.qualityHealthScore - right.qualityHealthScore
    || left.projectName.localeCompare(right.projectName));

  const trends = mockTrends(period, projects);
  const summary = mockSummary(projects, previousProjects);
  const attentionItems = mockAttention(projects, previousProjects, evaluatedAt, attentionLimit);
  const squads = mockSquadSummaries(projects, evaluatedAt);
  const lastUpdatedAt = projects.map((project) => project.lastActivityAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  return { period, summary, trends, attentionItems, projects, squads, lastUpdatedAt };
}

function mockProjectOverview(
  project: (typeof mockProjects)[number],
  start: string,
  end: string,
  evaluatedAt: Date
): DashboardProjectOverview {
  const scenarios = mockScenariosByProject[project.projectKey] ?? [];
  const override = mockStatisticsOverride[project.projectKey];
  const totalScenarios = override?.totalScenarios ?? scenarios.length;
  const automatedScenarios = override?.totalAutomated
    ?? scenarios.filter((scenario) => scenario.automationStatus === 'AUTOMATED').length;
  const automationCoverage = percentage(automatedScenarios, totalScenarios);
  const runs = (mockRunsByProject[project.projectKey] ?? [])
    .filter((run) => {
      const date = (run.finishedAt ?? run.startedAt).slice(0, 10);
      return date >= start && date <= end;
    });
  const passed = runs.reduce((sum, run) => sum + (run.passedScenarios ?? 0), 0);
  const failed = runs.reduce((sum, run) => sum + (run.failedScenarios ?? 0), 0);
  const finishedExecutions = passed + failed;
  const passRate = percentage(passed, finishedExecutions);
  const latestRun = [...(mockRunsByProject[project.projectKey] ?? [])]
    .filter((run) => (run.finishedAt ?? run.startedAt).slice(0, 10) <= end)
    .sort((left, right) => (left.finishedAt ?? left.startedAt).localeCompare(right.finishedAt ?? right.startedAt))
    .at(-1);
  const lastActivityAt = latestRun?.finishedAt ?? latestRun?.startedAt ?? null;
  const openFailures = latestRun?.failedScenarios ?? 0;
  const quality = qualityHealth({
    passRate,
    automationCoverage,
    finishedExecutions,
    openFailures,
    totalScenarios,
    lastActivityAt,
    flakyScenarios: 0,
    stabilityEvidenceAvailable: false,
    evaluatedAt
  });
  return {
    projectId: project.id,
    projectKey: project.projectKey,
    projectName: project.name,
    totalScenarios,
    automatedScenarios,
    automationCoverage,
    passRate,
    finishedExecutions,
    openFailures,
    flakyScenarios: 0,
    stabilityEvidenceAvailable: false,
    qualityHealthScore: quality.score,
    status: quality.status,
    lastActivityAt
  };
}

function mockSummary(
  projects: DashboardProjectOverview[],
  previousProjects: DashboardProjectOverview[]
): DashboardSummary {
  const current = aggregateProjects(projects);
  const previous = aggregateProjects(previousProjects);
  const squadCount = Object.values(mockSquads).reduce((sum, squads) => sum + squads.length, 0);
  return {
    qualityHealth: metric('qualityHealth', 'Quality health', current.health, previous.health, 'score', current.status),
    projects: metric('projects', 'Projects', projects.length, previousProjects.length, 'count', 'NEUTRAL'),
    squads: metric('squads', 'Squads', squadCount, squadCount, 'count', 'NEUTRAL'),
    testScenarios: metric(
      'testScenarios',
      'Test scenarios',
      current.totalScenarios,
      previous.totalScenarios,
      'count',
      'NEUTRAL'
    ),
    automationCoverage: metric(
      'automationCoverage',
      'Automation coverage',
      current.automationCoverage,
      previous.automationCoverage,
      'percentage',
      'NEUTRAL'
    ),
    passRate: metric(
      'passRate',
      'Pass rate',
      current.passRate,
      previous.finishedExecutions > 0 ? previous.passRate : null,
      current.finishedExecutions > 0 ? 'percentage' : 'no-runs',
      'NEUTRAL'
    )
  };
}

function aggregateProjects(projects: DashboardProjectOverview[]) {
  const totalScenarios = projects.reduce((sum, project) => sum + project.totalScenarios, 0);
  const automated = projects.reduce((sum, project) => sum + project.automatedScenarios, 0);
  const finishedExecutions = projects.reduce((sum, project) => sum + project.finishedExecutions, 0);
  const passed = projects.reduce(
    (sum, project) => sum + Math.round(project.passRate * project.finishedExecutions / 100),
    0
  );
  const automationCoverage = percentage(automated, totalScenarios);
  const passRate = percentage(passed, finishedExecutions);
  const health = projects.length === 0
    ? 0
    : round(projects.reduce((sum, project) => sum + project.qualityHealthScore, 0) / projects.length);
  const status = classifyHealth(health, finishedExecutions);
  return { totalScenarios, automationCoverage, finishedExecutions, passRate, health, status };
}

function mockTrends(
  period: DashboardPeriod,
  projects: DashboardProjectOverview[]
): DashboardTrendPoint[] {
  const group = period.group.toLowerCase() as DashboardGroup;
  const dates: Date[] = [];
  let cursor = new Date(`${period.start}T00:00:00Z`);
  const end = new Date(`${period.end}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor);
    cursor = nextBucket(cursor, group);
  }
  const totalScenarios = projects.reduce((sum, project) => sum + project.totalScenarios, 0);
  const automated = projects.reduce((sum, project) => sum + project.automatedScenarios, 0);
  return dates.map((date, index) => {
    const progress = (index + 1) / Math.max(dates.length, 1);
    const scenarios = Math.round(totalScenarios * (0.92 + progress * 0.08));
    const automatedScenarios = Math.min(
      scenarios,
      Math.round(automated * (0.88 + progress * 0.12))
    );
    const passRate = round(clamp(82 + progress * 8 + Math.sin(index * 1.1) * 4, 0, 100));
    const automationCoverage = round(percentage(automatedScenarios, scenarios));
    const totalExecutions = Math.max(12, Math.round(28 + progress * 24 + Math.cos(index) * 8));
    const passedExecutions = Math.round(totalExecutions * passRate / 100);
    const failedExecutions = totalExecutions - passedExecutions;
    const health = qualityHealth({
      passRate,
      automationCoverage,
      finishedExecutions: totalExecutions,
      openFailures: failedExecutions,
      totalScenarios: scenarios,
      lastActivityAt: date.toISOString(),
      flakyScenarios: 0,
      stabilityEvidenceAvailable: false,
      evaluatedAt: date
    });
    return {
      date: isoDate(date),
      totalScenarios: scenarios,
      automatedScenarios,
      totalExecutions,
      passedExecutions,
      failedExecutions,
      passRate,
      automationCoverage,
      qualityHealthScore: health.score
    };
  });
}

function mockAttention(
  projects: DashboardProjectOverview[],
  previousProjects: DashboardProjectOverview[],
  detectedAt: Date,
  requestedLimit: number
): DashboardAttentionItem[] {
  const previousByKey = new Map(previousProjects.map((project) => [project.projectKey, project]));
  const items: DashboardAttentionItem[] = [];
  for (const project of projects) {
    const previous = previousByKey.get(project.projectKey);
    if (project.finishedExecutions > 0 && project.passRate < 70) {
      items.push(attention(project, 'CRITICAL_PASS_RATE', 'CRITICAL', `Pass rate is ${Math.round(project.passRate)}%.`, detectedAt));
    } else if (previous && previous.finishedExecutions > 0 && previous.passRate - project.passRate >= 10) {
      items.push(attention(
        project,
        'PASS_RATE_DROPPED',
        'HIGH',
        `Pass rate fell ${Math.round(previous.passRate - project.passRate)} points from the previous period.`,
        detectedAt
      ));
    }
    if (project.openFailures >= 10 || percentage(project.openFailures, project.totalScenarios) >= 5) {
      items.push(attention(
        project,
        'HIGH_OPEN_FAILURES',
        'HIGH',
        `${project.openFailures} ${project.openFailures === 1 ? 'scenario is' : 'scenarios are'} currently failing.`,
        detectedAt,
        project.openFailures,
        project.openFailures === 1 ? 'failure' : 'failures'
      ));
    }
    if (project.automationCoverage < 50) {
      const gaps = Math.max(0, project.totalScenarios - project.automatedScenarios);
      items.push(attention(
        project,
        'LOW_AUTOMATION',
        'MEDIUM',
        `Automation coverage is ${Math.round(project.automationCoverage)}%.`,
        detectedAt,
        gaps,
        gaps === 1 ? 'automation gap' : 'automation gaps'
      ));
    }
    const staleDays = project.lastActivityAt
      ? Math.max(0, Math.floor((detectedAt.getTime() - new Date(project.lastActivityAt).getTime()) / 86_400_000))
      : null;
    if (staleDays === null || staleDays > 7) {
      const description = staleDays === null
        ? 'No test activity has been recorded.'
        : `No test activity in ${staleDays} days.`;
      items.push(attention(project, 'STALE_EXECUTION', 'MEDIUM', description, detectedAt));
    }
  }
  const severity = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  return items.sort((left, right) => severity[left.severity] - severity[right.severity]
    || (right.affectedCount ?? -1) - (left.affectedCount ?? -1)
    || left.projectName.localeCompare(right.projectName))
    .slice(0, Math.max(1, Math.min(requestedLimit, 20)));
}

function attention(
  project: DashboardProjectOverview,
  type: DashboardAttentionType,
  severity: DashboardAttentionSeverity,
  description: string,
  detectedAt: Date,
  affectedCount: number | null = null,
  affectedLabel: string | null = null
): DashboardAttentionItem {
  return {
    projectId: project.projectId,
    projectKey: project.projectKey,
    projectName: project.projectName,
    type,
    severity,
    title: project.projectName,
    description,
    affectedCount,
    affectedLabel,
    status: project.status,
    detectedAt: detectedAt.toISOString()
  };
}

function metric(
  key: string,
  label: string,
  value: number,
  previousValue: number | null,
  kind: 'count' | 'percentage' | 'score' | 'no-runs',
  status: QualityHealthStatus
): DashboardMetricSummary {
  const delta = previousValue === null ? null : round(value - previousValue);
  let direction: TrendDirection = 'UNKNOWN';
  if (delta !== null && delta > 0) direction = 'UP';
  if (delta !== null && delta < 0) direction = 'DOWN';
  if (delta === 0) direction = 'FLAT';
  let deltaLabel = 'No previous data';
  if (delta === 0) deltaLabel = 'No change from previous period';
  if (delta !== null && delta !== 0) {
    const sign = delta > 0 ? '+' : '';
    const unit = kind === 'percentage' || kind === 'score' || kind === 'no-runs' ? ' pts' : '';
    deltaLabel = `${sign}${formatNumber(delta)}${unit} vs previous period`;
  }
  let valueLabel = formatNumber(value);
  if (kind === 'percentage') valueLabel += '%';
  if (kind === 'score') valueLabel += '/100';
  if (kind === 'no-runs') valueLabel = 'No runs';
  const deltaPercent = previousValue && delta !== null
    ? round(delta * 100 / Math.abs(previousValue))
    : null;
  return {
    key,
    label,
    value: round(value),
    valueLabel,
    previousValue,
    delta,
    deltaPercent,
    deltaLabel,
    trendDirection: direction,
    status
  };
}

function qualityHealth(input: {
  passRate: number;
  automationCoverage: number;
  finishedExecutions: number;
  openFailures: number;
  totalScenarios: number;
  lastActivityAt: string | null;
  flakyScenarios: number;
  stabilityEvidenceAvailable: boolean;
  evaluatedAt: Date;
}): { score: number; status: QualityHealthStatus } {
  const pass = clamp(input.passRate, 0, 100) * 0.35;
  const automation = clamp(input.automationCoverage, 0, 100) * 0.25;
  const failurePenalty = Math.min(20, percentage(input.openFailures, Math.max(input.totalScenarios, 1)) * 2);
  let freshness = 0;
  if (input.lastActivityAt) {
    const age = Math.max(0, (input.evaluatedAt.getTime() - new Date(input.lastActivityAt).getTime()) / 86_400_000);
    if (age <= 3) freshness = 10;
    else if (age <= 7) freshness = 7;
    else if (age <= 14) freshness = 4;
  }
  let stability = 10;
  if (input.stabilityEvidenceAvailable) {
    stability -= Math.min(10, percentage(input.flakyScenarios, Math.max(input.totalScenarios, 1)) * 2);
  }
  const score = round(clamp(pass + automation + (20 - failurePenalty) + freshness + stability, 0, 100));
  return { score, status: classifyHealth(score, input.finishedExecutions) };
}

function mockSquadSummaries(
  projects: DashboardProjectOverview[],
  _evaluatedAt: Date
): DashboardSquadSummary[] {
  const projectSquadMap = new Map(mockProjects.map((p) => [p.id, p.squadId]));
  const squadMap = new Map<string, { id: string; name: string; tribeId: string }>();
  for (const squads of Object.values(mockSquads)) {
    for (const squad of squads) {
      squadMap.set(squad.id, squad);
    }
  }
  const tribeMap = new Map(mockTribes.map((t) => [t.id, t.name]));
  const bySquad = new Map<string, DashboardProjectOverview[]>();
  for (const project of projects) {
    const squadId = projectSquadMap.get(project.projectId);
    if (!squadId) continue;
    const list = bySquad.get(squadId) ?? [];
    list.push(project);
    bySquad.set(squadId, list);
  }
  const result: DashboardSquadSummary[] = [];
  for (const [squadId, sp] of bySquad.entries()) {
    const squad = squadMap.get(squadId);
    if (!squad) continue;
    const avgScore = round(sp.reduce((sum, p) => sum + p.qualityHealthScore, 0) / sp.length);
    const finishedExecutions = sp.reduce((sum, p) => sum + p.finishedExecutions, 0);
    result.push({
      squadId,
      squadName: squad.name,
      tribeId: squad.tribeId,
      tribeName: tribeMap.get(squad.tribeId) ?? null,
      projectCount: sp.length,
      avgQualityHealthScore: avgScore,
      status: classifyHealth(avgScore, finishedExecutions)
    });
  }
  return result.sort((a, b) => a.avgQualityHealthScore - b.avgQualityHealthScore).slice(0, 5);
}

function classifyHealth(score: number, finishedExecutions: number): QualityHealthStatus {
  if (finishedExecutions === 0) return 'NO_RUNS';
  if (score >= 85) return 'HEALTHY';
  if (score >= 70) return 'NEEDS_REVIEW';
  if (score >= 60) return 'HIGH_RISK';
  return 'CRITICAL';
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round(numerator * 100 / denominator);
}

function nextBucket(date: Date, group: DashboardGroup): Date {
  const next = new Date(date);
  if (group === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + (group === 'weekly' ? 7 : 1));
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

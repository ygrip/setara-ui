import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListProjects, mockGetProject } from '$lib/mock/client';
import { mockProjects } from '$lib/mock/data';

export interface Project {
  id: string;
  squadId: string | null;
  projectKey: string;
  name: string;
  description: string | null;
  active?: boolean;
  createdAt: string;
  scenarioCount?: number | null;
  coveragePercent?: number | null;
}

export type ProjectHealthStatus = 'HEALTHY' | 'NEEDS_REVIEW' | 'HIGH_RISK' | 'CRITICAL' | 'NO_RUNS';
export type ProjectOverviewSort = 'lastActivity' | 'name' | 'scenarios' | 'coverage' | 'passRate' | 'failures';
export type ProjectOverviewOrder = 'asc' | 'desc';

export type ProjectOverviewItem = {
  id: string;
  projectKey: string;
  name: string;
  domain: string | null;
  totalScenarios: number;
  automatedScenarios: number;
  coveragePercent: number | null;
  passRatePercent: number | null;
  openFailures: number | null;
  lastExecutionAt: string | null;
  qualityHealthScore: number | null;
  healthStatus: ProjectHealthStatus;
};

export type ProjectOverviewSummary = {
  totalProjects: number;
  healthy: number;
  needsReview: number;
  highRisk: number;
  critical: number;
  noRuns: number;
};

export type ProjectOverviewResponse = {
  summary: ProjectOverviewSummary;
  filters: { domains: string[] };
  items: ProjectOverviewItem[];
  page: { number: number; size: number; totalElements: number; totalPages: number };
};

export type ProjectOverviewRequest = {
  search?: string;
  status?: ProjectHealthStatus;
  domain?: string;
  sort?: ProjectOverviewSort;
  order?: ProjectOverviewOrder;
  page?: number;
  size?: number;
};

export async function getProjectOverview(
  request: ProjectOverviewRequest = {}
): Promise<ProjectOverviewResponse> {
  if (isMockMode()) return createMockProjectOverview(request);
  const params = new URLSearchParams();
  if (request.search?.trim()) params.set('search', request.search.trim());
  if (request.status) params.set('status', request.status);
  if (request.domain?.trim()) params.set('domain', request.domain.trim());
  if (request.sort) params.set('sort', request.sort);
  if (request.order) params.set('order', request.order);
  if (request.page != null) params.set('page', String(request.page));
  if (request.size != null) params.set('size', String(request.size));
  const suffix = params.size > 0 ? `?${params}` : '';
  const response = await apiFetch(`/api/projects/overview${suffix}`);
  return readJsonOrThrow<ProjectOverviewResponse>(response);
}

export function createMockProjectOverview(
  request: ProjectOverviewRequest = {}
): ProjectOverviewResponse {
  const domains = ['Backend', 'Commerce', 'Mobile', 'Platform'];
  const all = mockProjects.map((project, index) => mockOverviewItem(project, index, domains));
  const search = request.search?.trim().toLowerCase();
  const filtered = all.filter((item) => {
    const matchesSearch = !search
      || item.name.toLowerCase().includes(search)
      || item.projectKey.toLowerCase().includes(search)
      || item.domain?.toLowerCase().includes(search);
    const matchesStatus = !request.status || item.healthStatus === request.status;
    const matchesDomain = !request.domain || item.domain === request.domain;
    return matchesSearch && matchesStatus && matchesDomain;
  });
  const sort = request.sort ?? 'lastActivity';
  const order = request.order ?? (sort === 'name' ? 'asc' : 'desc');
  filtered.sort((left, right) => compareOverview(left, right, sort, order));
  const page = Math.max(0, request.page ?? 0);
  const size = Math.min(100, Math.max(1, request.size ?? 24));
  const items = filtered.slice(page * size, (page + 1) * size);
  return {
    summary: summarizeOverview(all),
    filters: { domains },
    items,
    page: {
      number: page,
      size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size)
    }
  };
}

function mockOverviewItem(
  project: Project,
  index: number,
  domains: string[]
): ProjectOverviewItem {
  const statusCycle: ProjectHealthStatus[] = [
    'HEALTHY', 'NEEDS_REVIEW', 'HIGH_RISK', 'CRITICAL', 'NO_RUNS'
  ];
  const healthStatus = statusCycle[index % statusCycle.length];
  const noRuns = healthStatus === 'NO_RUNS';
  const totalScenarios = 48 + index * 13;
  const scoreByStatus: Record<ProjectHealthStatus, number | null> = {
    HEALTHY: 92,
    NEEDS_REVIEW: 78,
    HIGH_RISK: 65,
    CRITICAL: 52,
    NO_RUNS: null
  };
  const passRateByStatus: Record<ProjectHealthStatus, number | null> = {
    HEALTHY: 96,
    NEEDS_REVIEW: 84,
    HIGH_RISK: 72,
    CRITICAL: 55,
    NO_RUNS: null
  };
  const coveragePercent = 96 - (index % 5) * 8;
  return {
    id: project.id,
    projectKey: project.projectKey,
    name: project.name,
    domain: domains[index % domains.length],
    totalScenarios,
    automatedScenarios: Math.round(totalScenarios * coveragePercent / 100),
    coveragePercent,
    passRatePercent: passRateByStatus[healthStatus],
    openFailures: noRuns ? null : index % 6,
    lastExecutionAt: noRuns ? null : new Date(Date.UTC(2026, 6, 6 - index, 9, 0)).toISOString(),
    qualityHealthScore: scoreByStatus[healthStatus],
    healthStatus
  };
}

function summarizeOverview(items: ProjectOverviewItem[]): ProjectOverviewSummary {
  return {
    totalProjects: items.length,
    healthy: items.filter((item) => item.healthStatus === 'HEALTHY').length,
    needsReview: items.filter((item) => item.healthStatus === 'NEEDS_REVIEW').length,
    highRisk: items.filter((item) => item.healthStatus === 'HIGH_RISK').length,
    critical: items.filter((item) => item.healthStatus === 'CRITICAL').length,
    noRuns: items.filter((item) => item.healthStatus === 'NO_RUNS').length
  };
}

function compareOverview(
  left: ProjectOverviewItem,
  right: ProjectOverviewItem,
  sort: ProjectOverviewSort,
  order: ProjectOverviewOrder
): number {
  const values: Record<ProjectOverviewSort, [string | number | null, string | number | null]> = {
    lastActivity: [left.lastExecutionAt, right.lastExecutionAt],
    name: [left.name.toLowerCase(), right.name.toLowerCase()],
    scenarios: [left.totalScenarios, right.totalScenarios],
    coverage: [left.coveragePercent, right.coveragePercent],
    passRate: [left.passRatePercent, right.passRatePercent],
    failures: [left.openFailures, right.openFailures]
  };
  const [leftValue, rightValue] = values[sort];
  if (leftValue == null && rightValue == null) return left.name.localeCompare(right.name);
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;
  const result = typeof leftValue === 'number'
    ? leftValue - Number(rightValue)
    : leftValue.localeCompare(String(rightValue));
  if (result === 0) return left.name.localeCompare(right.name);
  return order === 'asc' ? result : -result;
}

export async function listProjects(cursor?: string, limit?: number, sortBy?: string, sortDir?: string, search?: string): Promise<CursorPage<Project>> {
  if (isMockMode()) return mockListProjects(cursor, limit, sortBy, sortDir);
  let params = buildCursorParams(cursor, limit, sortBy, sortDir);
  if (search && search.trim()) {
    const sep = params.includes('?') ? '&' : '?';
    params += sep + 'search=' + encodeURIComponent(search.trim());
  }
  const res = await apiFetch(`/api/projects${params}`);
  return readJsonOrThrow<CursorPage<Project>>(res);
}

export async function getProject(projectKey: string): Promise<Project> {
  if (isMockMode()) return mockGetProject(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}`);
  return readJsonOrThrow<Project>(res);
}

export async function createProject(body: {
  squadId?: string;
  name: string;
  description?: string;
}): Promise<Project> {
  if (isMockMode()) return { id: `proj-mock-${Date.now()}`, squadId: body.squadId ?? null, projectKey: body.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 10), name: body.name, description: body.description ?? null, createdAt: new Date().toISOString() };
  const res = await apiFetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<Project>(res);
}

export async function updateProject(projectKey: string, body: {
  squadId?: string | null;
  name?: string;
  description?: string | null;
  active?: boolean;
}): Promise<Project> {
  if (isMockMode()) {
    const existing = await mockGetProject(projectKey);
    return { ...existing, ...body };
  }
  const res = await apiFetch(`/api/projects/${projectKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<Project>(res);
}

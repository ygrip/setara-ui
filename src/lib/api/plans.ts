import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListAllPlans } from '$lib/mock/client';

export interface ReleasePlan {
  id: string;
  squadId: string | null;
  squadName: string | null;
  name: string;
  releaseVersion: string | null;
  releaseDate: string | null;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | string;
  createdAt: string;
  updatedAt: string;
  openedAt: string | null;
  openedBy: string | null;
  inProgressAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  // Build summary — populated in list responses
  totalBuilds?: number;
  verifiedBuilds?: number;
  totalProjects?: number;
}

export interface PlanBuildMetrics {
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
  passPercentage: number;
  executionCoverage: number;
}

export interface PlanBuild {
  id: string;
  buildId: string;
  buildKey: string;
  buildName: string;
  buildVersion: string | null;
  projectId: string;
  projectKey: string;
  projectName: string;
  squadId: string | null;
  squadName: string | null;
  status: string;
  initiatedAt: string;
  verifiedAt: string | null;
  addedAt: string;
  addedBy: string | null;
  metrics: PlanBuildMetrics;
}

export interface PlanMetrics {
  planId: string;
  totalBuilds: number;
  verifiedBuilds: number;
  inProgressBuilds: number;
  initiatedBuilds: number;
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
  passPercentage: number;
  executionCoverage: number;
}

/** Global plans list — optionally filtered by squad */
export async function listAllPlans(
  squadId?: string,
  cursor?: string,
  limit?: number,
  sortBy?: string,
  sortDir?: string
): Promise<CursorPage<ReleasePlan>> {
  if (isMockMode()) return mockListAllPlans(squadId, cursor, limit, sortBy, sortDir);
  const params = buildCursorParams(cursor, limit, sortBy, sortDir);
  const squadParam = squadId ? `${params ? '&' : '?'}squad_id=${squadId}` : '';
  const res = await apiFetch(`/api/plans${params}${squadParam}`);
  return readJsonOrThrow<CursorPage<ReleasePlan>>(res);
}

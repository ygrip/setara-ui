import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import type { ReleasePlan, PlanBuild, PlanMetrics } from './plans';
import { isMockMode, mockGetSquadPlanMetrics, mockListAllPlans, mockGetSquadPlan, mockListSquadPlanBuilds, mockCreateSquadPlan } from '$lib/mock/client';

// Re-export shared types for convenience
export type { ReleasePlan, PlanBuild, PlanMetrics };

// ── Squad plan list & detail ────────────────────────────────────────────

export async function listSquadPlans(
  squadId: string,
  cursor?: string,
  limit?: number,
  sortBy?: string,
  sortDir?: string
): Promise<CursorPage<ReleasePlan>> {
  if (isMockMode()) return mockListAllPlans(squadId, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/squads/${squadId}/plans${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return readJsonOrThrow(res);
}

export async function createSquadPlan(
  squadId: string,
  body: {
    name: string;
    releaseVersion?: string | null;
    releaseDate?: string | null;
    description?: string | null;
    openedBy?: string | null;
  }
): Promise<ReleasePlan> {
  if (isMockMode()) return mockCreateSquadPlan(squadId, body);
  const res = await apiFetch(`/api/squads/${squadId}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

export async function getSquadPlan(squadId: string, planId: string): Promise<ReleasePlan> {
  if (isMockMode()) return mockGetSquadPlan(squadId, planId);
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}`);
  return readJsonOrThrow(res);
}

export async function updateSquadPlan(
  squadId: string,
  planId: string,
  body: { name?: string; releaseVersion?: string | null; releaseDate?: string | null; description?: string | null; updatedBy?: string | null }
): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

export async function deleteSquadPlan(squadId: string, planId: string, deletedBy?: string | null): Promise<void> {
  const params = deletedBy ? `?deletedBy=${encodeURIComponent(deletedBy)}` : '';
  await apiFetch(`/api/squads/${squadId}/plans/${planId}${params}`, { method: 'DELETE' });
}

// ── Build membership ────────────────────────────────────────────────────

export async function listSquadPlanBuilds(squadId: string, planId: string): Promise<PlanBuild[]> {
  if (isMockMode()) return mockListSquadPlanBuilds(squadId, planId);
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/builds`);
  return readJsonOrThrow(res);
}

export async function addSquadPlanBuild(
  squadId: string,
  planId: string,
  body: { buildId: string; addedBy?: string | null }
): Promise<PlanBuild> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/builds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

export async function removeSquadPlanBuild(squadId: string, planId: string, buildId: string): Promise<void> {
  await apiFetch(`/api/squads/${squadId}/plans/${planId}/builds/${buildId}`, { method: 'DELETE' });
}

// ── Lifecycle ───────────────────────────────────────────────────────────

export async function closeSquadPlan(
  squadId: string,
  planId: string,
  body: { closedBy?: string | null; notes?: string | null } = {}
): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

// ── Metrics ─────────────────────────────────────────────────────────────

export interface SquadPlanMetrics {
  planId: string;
  totalBuilds: number;
  verifiedBuilds: number;
  inProgressBuilds: number;
  initiatedBuilds: number;
  totalProjects: number;
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
  passPercentage: number;
  executionCoverage: number;
  planReadiness: number;
  scenarioPassRate: number;
}

export async function getSquadPlanMetrics(squadId: string, planId: string): Promise<SquadPlanMetrics> {
  if (isMockMode()) return mockGetSquadPlanMetrics(squadId, planId) as Promise<SquadPlanMetrics>;
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/metrics`);
  return readJsonOrThrow(res);
}

export interface PlanLifecycleEvent {
  id: string;
  eventType: string;
  actor: string | null;
  description: string | null;
  occurredAt: string;
}

export async function getSquadPlanLifecycle(squadId: string, planId: string): Promise<PlanLifecycleEvent[]> {
  if (isMockMode()) return [
    { id: '1', eventType: 'PLAN_CREATED', actor: 'admin', description: 'Plan created', occurredAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    { id: '2', eventType: 'BUILD_ADDED', actor: 'admin', description: 'Build added', occurredAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: '3', eventType: 'STATUS_CHANGED', actor: null, description: 'Status changed to IN_PROGRESS', occurredAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  ];
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/lifecycle`);
  return readJsonOrThrow(res);
}

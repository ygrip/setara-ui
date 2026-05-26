import { getApiBaseUrl } from './config';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import type { ReleasePlan, PlanBuild, PlanMetrics } from './plans';

// Re-export shared types for convenience
export type { ReleasePlan, PlanBuild, PlanMetrics };

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

// ── Squad plan list & detail ────────────────────────────────────────────

export async function listSquadPlans(
  squadId: string,
  cursor?: string,
  limit?: number,
  sortBy?: string,
  sortDir?: string
): Promise<CursorPage<ReleasePlan>> {
  const res = await apiFetch(`/api/squads/${squadId}/plans${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
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
  const res = await apiFetch(`/api/squads/${squadId}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function getSquadPlan(squadId: string, planId: string): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}`);
  return res.json();
}

// ── Build membership ────────────────────────────────────────────────────

export async function listSquadPlanBuilds(squadId: string, planId: string): Promise<PlanBuild[]> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/builds`);
  return res.json();
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
  return res.json();
}

export async function removeSquadPlanBuild(squadId: string, planId: string, buildId: string): Promise<void> {
  await apiFetch(`/api/squads/${squadId}/plans/${planId}/builds/${buildId}`, { method: 'DELETE' });
}

// ── Lifecycle ───────────────────────────────────────────────────────────

export async function closeSquadPlan(
  squadId: string,
  planId: string,
  body: { signedOffBy?: string | null; notes?: string | null } = {}
): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
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
  passedScenarios: number;
  failedScenarios: number;
  planReadiness: number;
  scenarioPassRate: number;
}

export async function getSquadPlanMetrics(squadId: string, planId: string): Promise<SquadPlanMetrics> {
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/metrics`);
  return res.json();
}

import { getApiBaseUrl } from './config';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockGetPlan, mockGetPlanMetrics, mockListPlans, mockListPlanScenarios } from '$lib/mock/client';

export interface ReleasePlan {
  id: string;
  projectId: string;
  projectKey: string;
  name: string;
  releaseVersion: string | null;
  description: string | null;
  status: string;
  passThreshold: number;
  coverageThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanScenario {
  id: string;
  scenarioId: string;
  scenarioKey: string;
  name: string;
  priority: string | null;
  automationStatus: string;
  createdAt: string;
}

export interface PlanMetrics {
  planId: string;
  totalScenarios: number;
  selectedExecutions: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  executionCoverage: number;
  passPercentage: number;
  automationCoverage: number;
  qualityGate: string;
}

export interface PlanSelection {
  id: string;
  scenarioId: string;
  scenarioRunResultId: string | null;
  manualExecutionId: string | null;
  status: string;
  selectedBy: string | null;
  selectedAt: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listPlans(projectKey: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<ReleasePlan>> {
  if (isMockMode()) return mockListPlans(projectKey, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/projects/${projectKey}/plans${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function createPlan(projectKey: string, body: {
  name: string;
  releaseVersion?: string;
  description?: string;
  passThreshold?: number;
  coverageThreshold?: number;
}): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/projects/${projectKey}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function getPlan(projectKey: string, planId: string): Promise<ReleasePlan> {
  if (isMockMode()) return mockGetPlan(projectKey, planId);
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}`);
  return res.json();
}

export async function updatePlan(projectKey: string, planId: string, body: Partial<{
  name: string;
  releaseVersion: string;
  description: string;
  status: string;
  passThreshold: number;
  coverageThreshold: number;
}>): Promise<ReleasePlan> {
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function archivePlan(projectKey: string, planId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/plans/${planId}`, { method: 'DELETE' });
}

export async function listPlanScenarios(projectKey: string, planId: string): Promise<PlanScenario[]> {
  if (isMockMode()) return mockListPlanScenarios(projectKey, planId);
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/scenarios`);
  return res.json();
}

export async function addPlanScenario(projectKey: string, planId: string, scenarioId: string): Promise<PlanScenario> {
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId })
  });
  return res.json();
}

export async function removePlanScenario(projectKey: string, planId: string, scenarioId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/plans/${planId}/scenarios/${scenarioId}`, { method: 'DELETE' });
}

export async function getPlanMetrics(projectKey: string, planId: string): Promise<PlanMetrics> {
  if (isMockMode()) return mockGetPlanMetrics(projectKey, planId);
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/metrics`);
  return res.json();
}

export async function selectPlanExecution(projectKey: string, planId: string, body: {
  scenarioId: string;
  scenarioRunResultId?: string | null;
  manualExecutionId?: string | null;
  selectedBy?: string;
}): Promise<PlanSelection> {
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/executions/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

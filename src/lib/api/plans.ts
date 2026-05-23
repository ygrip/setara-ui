import { getApiBaseUrl } from './config';
import { isMockMode, mockListPlans } from '$lib/mock/client';

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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listPlans(projectKey: string): Promise<ReleasePlan[]> {
  if (isMockMode()) return mockListPlans(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}/plans`);
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
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/metrics`);
  return res.json();
}

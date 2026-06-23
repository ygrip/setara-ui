import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListProjects, mockGetProject } from '$lib/mock/client';

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

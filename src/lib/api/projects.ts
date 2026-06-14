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
}

export async function listProjects(cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<Project>> {
  if (isMockMode()) return mockListProjects(cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/projects${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
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
  const res = await apiFetch(`/api/projects/${projectKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<Project>(res);
}

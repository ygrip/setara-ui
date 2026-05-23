import { getApiBaseUrl } from './config';
import { isMockMode, mockListProjects, mockGetProject } from '$lib/mock/client';

export interface Project {
  id: string;
  squadId: string | null;
  projectKey: string;
  name: string;
  description: string | null;
  createdAt: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listProjects(): Promise<Project[]> {
  if (isMockMode()) return mockListProjects();
  const res = await apiFetch('/api/projects');
  return res.json();
}

export async function getProject(projectKey: string): Promise<Project> {
  if (isMockMode()) return mockGetProject(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}`);
  return res.json();
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
  return res.json();
}

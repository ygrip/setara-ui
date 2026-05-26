import { getApiBaseUrl } from './config';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListTribes, mockListSquads, mockListUsers } from '$lib/mock/client';

export interface Tribe {
  id: string;
  name: string;
  createdAt: string;
}

export interface Squad {
  id: string;
  tribeId: string;
  tribeName?: string | null;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  projectId: string;
  userId: string;
  role: string;
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

export async function listTribes(cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<Tribe>> {
  if (isMockMode()) return mockListTribes(cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/tribes${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function createTribe(body: { name: string }): Promise<Tribe> {
  const res = await apiFetch('/api/tribes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listSquads(tribeId: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<Squad>> {
  if (isMockMode()) return mockListSquads(tribeId, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/tribes/${tribeId}/squads${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function createSquad(tribeId: string, body: { name: string }): Promise<Squad> {
  const res = await apiFetch(`/api/tribes/${tribeId}/squads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listUsers(cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<User>> {
  if (isMockMode()) return mockListUsers(cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/users${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function listAllSquads(cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<Squad>> {
  const res = await apiFetch(`/api/squads${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function getSquad(squadId: string): Promise<Squad> {
  const res = await apiFetch(`/api/squads/${squadId}`);
  return res.json();
}

export async function createUser(body: { email: string; displayName: string }): Promise<User> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function assignProjectRole(projectKey: string, body: { email: string; role: 'ADMIN' | 'QA' | 'VIEWER' }): Promise<Membership> {
  if (isMockMode()) {
    return {
      id: `membership-${Date.now()}`,
      projectId: projectKey,
      userId: body.email,
      role: body.role,
      createdAt: new Date().toISOString()
    };
  }
  const res = await apiFetch(`/api/projects/${projectKey}/memberships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

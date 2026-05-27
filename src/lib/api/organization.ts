import { getApiBaseUrl } from './config';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockListTribes, mockListSquads, mockListUsers, mockGetSquad, mockListAllSquads } from '$lib/mock/client';

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
  if (isMockMode()) return mockListAllSquads(cursor, limit);
  const res = await apiFetch(`/api/squads${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return res.json();
}

export async function getSquad(squadId: string): Promise<Squad> {
  if (isMockMode()) return mockGetSquad(squadId);
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

export async function assignProjectRole(projectKey: string, body: { email: string; role: 'ADMIN' | 'QA' | 'VIEWER' | 'QA_LEAD' | 'DEVELOPER' }): Promise<Membership> {
  if (isMockMode()) {
    return { id: `membership-${Date.now()}`, projectId: projectKey, userId: body.email, role: body.role, createdAt: new Date().toISOString() };
  }
  const res = await apiFetch(`/api/projects/${projectKey}/memberships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ── Tribe detail / update / delete ──────────────────────────────

export interface TribeDetail {
  id: string; name: string; description: string | null;
  leadId: string | null; leadName: string | null;
  createdAt: string; updatedAt: string;
}

export async function getTribe(tribeId: string): Promise<TribeDetail> {
  const res = await apiFetch(`/api/tribes/${tribeId}`);
  return res.json();
}

export async function updateTribe(tribeId: string, body: { name?: string; description?: string | null; leadId?: string | null }): Promise<TribeDetail> {
  const res = await apiFetch(`/api/tribes/${tribeId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}

export async function deleteTribe(tribeId: string): Promise<void> {
  await apiFetch(`/api/tribes/${tribeId}`, { method: 'DELETE' });
}

// ── Squad detail / update / delete / members ─────────────────────

export interface SquadDetail {
  id: string; tribeId: string | null; tribeName: string | null;
  name: string; description: string | null;
  leadId: string | null; leadName: string | null;
  createdAt: string; updatedAt: string;
  members: SquadMember[];
}

export interface SquadMember {
  id: string; userId: string; email: string; displayName: string; role: string; createdAt: string;
}

export async function getSquadDetail(squadId: string): Promise<SquadDetail> {
  const res = await apiFetch(`/api/squads/${squadId}/detail`);
  return res.json();
}

export async function updateSquad(squadId: string, body: { name?: string; description?: string | null; tribeId?: string | null; leadId?: string | null }): Promise<SquadDetail> {
  const res = await apiFetch(`/api/squads/${squadId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}

export async function deleteSquad(squadId: string): Promise<void> {
  await apiFetch(`/api/squads/${squadId}`, { method: 'DELETE' });
}

export async function addSquadMember(squadId: string, body: { email: string; role: string }): Promise<SquadMember> {
  const res = await apiFetch(`/api/squads/${squadId}/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}

export async function removeSquadMember(squadId: string, userId: string): Promise<void> {
  await apiFetch(`/api/squads/${squadId}/members/${userId}`, { method: 'DELETE' });
}

// ── User search ──────────────────────────────────────────────────

export interface UserDetail {
  id: string; email: string; displayName: string;
  squads: SquadMember[];
  createdAt: string;
}

export async function searchUsers(q?: string, cursor?: string, limit?: number): Promise<CursorPage<UserDetail>> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/users/search${qs ? '?' + qs : ''}`);
  return res.json();
}

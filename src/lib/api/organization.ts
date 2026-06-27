import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import { isMockMode, mockCreateSquad, mockCreateTribe, mockListTribes, mockListSquads, mockListUsers, mockGetSquad, mockListAllSquads, mockGetTribe, mockGetSquadDetail, mockSearchUsers } from '$lib/mock/client';

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
  disabledAt: string | null;
  pendingPasswordChange: boolean;
}

export interface Membership {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
}

export async function listTribes(cursor?: string, limit?: number, sortBy?: string, sortDir?: string, q?: string): Promise<CursorPage<Tribe>> {
  if (isMockMode()) return mockListTribes(cursor, limit, sortBy, sortDir);
  let url = `/api/tribes${buildCursorParams(cursor, limit, sortBy, sortDir)}`;
  if (q) url += `${url.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;
  const res = await apiFetch(url);
  return readJsonOrThrow<CursorPage<Tribe>>(res);
}

export async function createTribe(body: { name: string; description?: string; leadId?: string }): Promise<Tribe> {
  if (isMockMode()) return mockCreateTribe(body);
  const res = await apiFetch('/api/tribes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<Tribe>(res);
}

export async function listSquads(tribeId: string, cursor?: string, limit?: number, sortBy?: string, sortDir?: string): Promise<CursorPage<Squad>> {
  if (isMockMode()) return mockListSquads(tribeId, cursor, limit, sortBy, sortDir);
  const res = await apiFetch(`/api/tribes/${tribeId}/squads${buildCursorParams(cursor, limit, sortBy, sortDir)}`);
  return readJsonOrThrow<CursorPage<Squad>>(res);
}

export async function createSquad(tribeId: string, body: { name: string }): Promise<Squad> {
  if (isMockMode()) return mockCreateSquad(tribeId, body);
  const res = await apiFetch(`/api/tribes/${tribeId}/squads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<Squad>(res);
}

export async function listUsers(cursor?: string, limit?: number, sortBy?: string, sortDir?: string, status?: string): Promise<CursorPage<User>> {
  if (isMockMode()) return mockListUsers(cursor, limit, sortBy, sortDir);
  let url = `/api/users${buildCursorParams(cursor, limit, sortBy, sortDir)}`;
  if (status) url += `${url.includes('?') ? '&' : '?'}status=${encodeURIComponent(status)}`;
  const res = await apiFetch(url);
  return readJsonOrThrow<CursorPage<User>>(res);
}

export async function listAllSquads(cursor?: string, limit?: number, sortBy?: string, sortDir?: string, tribeId?: string, q?: string): Promise<CursorPage<Squad>> {
  if (isMockMode()) return mockListAllSquads(cursor, limit);
  let url = `/api/squads${buildCursorParams(cursor, limit, sortBy, sortDir)}`;
  if (tribeId) url += `${url.includes('?') ? '&' : '?'}tribe_id=${encodeURIComponent(tribeId)}`;
  if (q) url += `${url.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;
  const res = await apiFetch(url);
  return readJsonOrThrow<CursorPage<Squad>>(res);
}

export async function getSquad(squadId: string): Promise<Squad> {
  if (isMockMode()) return mockGetSquad(squadId);
  const res = await apiFetch(`/api/squads/${squadId}`);
  return readJsonOrThrow<Squad>(res);
}

export async function createUser(body: { email: string; displayName: string; password: string; systemAdmin?: boolean }): Promise<User> {
  if (isMockMode()) {
    return { id: `user-${Date.now()}`, email: body.email, displayName: body.displayName, createdAt: new Date().toISOString(), disabledAt: null, pendingPasswordChange: true };
  }
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<User>(res);
}

export async function suspendUser(userId: string, suspended: boolean): Promise<User> {
  if (isMockMode()) return { id: userId, email: 'user@example.com', displayName: 'Mock User', createdAt: new Date().toISOString(), disabledAt: suspended ? new Date().toISOString() : null, pendingPasswordChange: false };
  const res = await apiFetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspended })
  });
  return readJsonOrThrow<User>(res);
}

export async function deleteUser(userId: string): Promise<void> {
  if (isMockMode()) return;
  const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to delete user (${res.status})`);
  }
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
  return readJsonOrThrow<Membership>(res);
}

// ── Tribe detail / update / delete ──────────────────────────────

export interface TribeDetail {
  id: string; name: string; description: string | null;
  leadId: string | null; leadName: string | null;
  createdAt: string; updatedAt: string;
}

export async function getTribe(tribeId: string): Promise<TribeDetail> {
  if (isMockMode()) return mockGetTribe(tribeId);
  const res = await apiFetch(`/api/tribes/${tribeId}`);
  return readJsonOrThrow<TribeDetail>(res);
}

export async function updateTribe(tribeId: string, body: { name?: string; description?: string | null; leadId?: string | null }): Promise<TribeDetail> {
  if (isMockMode()) return mockGetTribe(tribeId).then(t => ({ ...t, ...body }));
  const res = await apiFetch(`/api/tribes/${tribeId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return readJsonOrThrow<TribeDetail>(res);
}

export async function deleteTribe(tribeId: string): Promise<void> {
  if (isMockMode()) return;
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
  if (isMockMode()) return mockGetSquadDetail(squadId);
  const res = await apiFetch(`/api/squads/${squadId}/detail`);
  return readJsonOrThrow<SquadDetail>(res);
}

export async function updateSquad(squadId: string, body: { name?: string; description?: string | null; tribeId?: string | null; leadId?: string | null }): Promise<SquadDetail> {
  if (isMockMode()) return mockGetSquadDetail(squadId).then(d => ({ ...d, ...body }));
  const res = await apiFetch(`/api/squads/${squadId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return readJsonOrThrow<SquadDetail>(res);
}

export async function deleteSquad(squadId: string): Promise<void> {
  if (isMockMode()) return;
  await apiFetch(`/api/squads/${squadId}`, { method: 'DELETE' });
}

export async function addSquadMember(squadId: string, body: { email: string; role: string }): Promise<SquadMember> {
  if (isMockMode()) return { id: `member-${Date.now()}`, userId: `user-${Date.now()}`, email: body.email, displayName: body.email.split('@')[0], role: body.role, createdAt: new Date().toISOString() };
  const res = await apiFetch(`/api/squads/${squadId}/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return readJsonOrThrow<SquadMember>(res);
}

export async function removeSquadMember(squadId: string, userId: string): Promise<void> {
  if (isMockMode()) return;
  await apiFetch(`/api/squads/${squadId}/members/${userId}`, { method: 'DELETE' });
}

// ── User search ──────────────────────────────────────────────────

export interface UserDetail {
  id: string; email: string; displayName: string;
  squads: SquadMember[];
  createdAt: string;
}

export async function searchUsers(q?: string, cursor?: string, limit?: number): Promise<CursorPage<UserDetail>> {
  if (isMockMode()) return mockSearchUsers(q, cursor, limit);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/users/search${qs ? '?' + qs : ''}`);
  return readJsonOrThrow<CursorPage<UserDetail>>(res);
}

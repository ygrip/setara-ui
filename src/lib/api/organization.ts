import { getApiBaseUrl } from './config';
import { isMockMode, mockListTribes, mockListSquads, mockListUsers } from '$lib/mock/client';

export interface Tribe {
  id: string;
  name: string;
  createdAt: string;
}

export interface Squad {
  id: string;
  tribeId: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
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

export async function listTribes(): Promise<Tribe[]> {
  if (isMockMode()) return mockListTribes();
  const res = await apiFetch('/api/tribes');
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

export async function listSquads(tribeId: string): Promise<Squad[]> {
  if (isMockMode()) return mockListSquads(tribeId);
  const res = await apiFetch(`/api/tribes/${tribeId}/squads`);
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

export async function listUsers(): Promise<User[]> {
  if (isMockMode()) return mockListUsers();
  const res = await apiFetch('/api/users');
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

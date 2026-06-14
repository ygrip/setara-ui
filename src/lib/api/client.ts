import { getApiBaseUrl } from './config';
import { getValidSession, clearSession } from '$lib/auth';

export function authHeaders(): Record<string, string> {
  const session = getValidSession();
  if (!session?.accessToken) return {};
  return { Authorization: `Bearer ${session.accessToken}` };
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = getValidSession();
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  return response;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Invalid email or password');
  }
  return response.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to change password');
  }
}

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json();
}

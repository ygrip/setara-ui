import { getApiBaseUrl } from './config';
import { isMockMode, mockListApiKeys, mockCreateApiKey, mockRevokeApiKey, mockRotateApiKey } from '$lib/mock/client';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  createdAt: string;
  revokedAt: string | null;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listApiKeys(projectKey: string): Promise<ApiKey[]> {
  if (isMockMode()) return mockListApiKeys(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}/api-keys`);
  return res.json();
}

export async function createApiKey(
  projectKey: string,
  body: { name: string; scopes: string[] }
): Promise<{ id: string; name: string; keyPrefix: string; rawKey: string }> {
  if (isMockMode()) return mockCreateApiKey(projectKey, body);
  const res = await apiFetch(`/api/projects/${projectKey}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function revokeApiKey(projectKey: string, apiKeyId: string): Promise<void> {
  if (isMockMode()) return mockRevokeApiKey(projectKey, apiKeyId);
  await apiFetch(`/api/projects/${projectKey}/api-keys/${apiKeyId}/revoke`, {
    method: 'POST'
  });
}

export async function rotateApiKey(
  projectKey: string,
  apiKeyId: string
): Promise<{ rawKey: string }> {
  if (isMockMode()) return mockRotateApiKey(projectKey, apiKeyId);
  const res = await apiFetch(`/api/projects/${projectKey}/api-keys/${apiKeyId}/rotate`, {
    method: 'POST'
  });
  return res.json();
}

import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import { isMockMode, mockListApiKeys, mockCreateApiKey, mockRevokeApiKey, mockRotateApiKey } from '$lib/mock/client';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  createdAt: string;
  revokedAt: string | null;
}

export async function listApiKeys(projectKey: string): Promise<ApiKey[]> {
  if (isMockMode()) return mockListApiKeys(projectKey);
  const res = await apiFetch(`/api/projects/${projectKey}/api-keys`);
  return readJsonOrThrow(res);
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
  return readJsonOrThrow(res);
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
  return readJsonOrThrow(res);
}

import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import { isMockMode } from '$lib/mock/client';

export interface CacheStatus {
  enabled: boolean;
  keyPrefix: string;
}

export interface PurgeResult {
  enabled: boolean;
  purged: number;
}

export async function getCacheStatus(): Promise<CacheStatus> {
  if (isMockMode()) return { enabled: false, keyPrefix: 'mock:' };
  const res = await apiFetch('/api/admin/cache');
  return readJsonOrThrow(res);
}

export async function purgeAll(): Promise<PurgeResult> {
  if (isMockMode()) return { enabled: false, purged: 0 };
  const res = await apiFetch('/api/admin/cache', { method: 'DELETE' });
  return readJsonOrThrow(res);
}

export async function purgeByPattern(pattern: string): Promise<PurgeResult> {
  if (isMockMode()) return { enabled: false, purged: 0 };
  const params = new URLSearchParams({ pattern });
  const res = await apiFetch(`/api/admin/cache/key?${params}`, { method: 'DELETE' });
  return readJsonOrThrow(res);
}

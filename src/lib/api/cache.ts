import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';

export interface CacheStatus {
  enabled: boolean;
  keyPrefix: string;
}

export interface PurgeResult {
  enabled: boolean;
  purged: number;
}

export async function getCacheStatus(): Promise<CacheStatus> {
  const res = await apiFetch('/api/admin/cache');
  return readJsonOrThrow(res);
}

export async function purgeAll(): Promise<PurgeResult> {
  const res = await apiFetch('/api/admin/cache', { method: 'DELETE' });
  return readJsonOrThrow(res);
}

export async function purgeByPattern(pattern: string): Promise<PurgeResult> {
  const params = new URLSearchParams({ pattern });
  const res = await apiFetch(`/api/admin/cache/key?${params}`, { method: 'DELETE' });
  return readJsonOrThrow(res);
}

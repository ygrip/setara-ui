import type { LoadEvent } from '@sveltejs/kit';
import { isMockMode } from '$lib/mock/client';
import { getApiBaseUrl } from '$lib/api/config';
import { authHeaders } from '$lib/api/client';

export const ssr = false;

export async function load({ fetch }: LoadEvent) {
  if (isMockMode()) {
    return {
      health: null,
      flags: null,
      error: null,
      unavailableReason: 'Intelligence and feature flags require a live Setara backend.'
    };
  }

  const base = getApiBaseUrl();
  const headers = authHeaders();

  try {
    const [healthRes, flagsRes] = await Promise.all([
      fetch(`${base}/api/admin/intelligence/health`, { headers }),
      fetch(`${base}/api/admin/intelligence/feature-flags`, { headers })
    ]);
    const health = healthRes.ok ? await healthRes.json() : null;
    const flags = flagsRes.ok ? await flagsRes.json() : null;
    if (!health) return { health: null, flags, error: `HTTP ${healthRes.status}` };
    return { health, flags, error: null };
  } catch (e: any) {
    return { health: null, flags: null, error: e.message ?? 'Failed to load' };
  }
}

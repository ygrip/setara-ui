import type { LoadEvent } from '@sveltejs/kit';
import { isMockMode } from '$lib/mock/client';

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

  try {
    const [healthRes, flagsRes] = await Promise.all([
      fetch('/api/admin/intelligence/health'),
      fetch('/api/admin/intelligence/feature-flags')
    ]);
    const health = healthRes.ok ? await healthRes.json() : null;
    const flags = flagsRes.ok ? await flagsRes.json() : null;
    if (!health) return { health: null, flags, error: `HTTP ${healthRes.status}` };
    return { health, flags, error: null };
  } catch (e: any) {
    return { health: null, flags: null, error: e.message ?? 'Failed to load' };
  }
}

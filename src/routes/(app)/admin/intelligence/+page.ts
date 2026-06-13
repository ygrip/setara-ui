import type { LoadEvent } from '@sveltejs/kit';

export const ssr = false;

export async function load({ fetch }: LoadEvent) {
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

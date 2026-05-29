import type { LoadEvent } from '@sveltejs/kit';

export const ssr = false;

export async function load({ fetch }: LoadEvent) {
  try {
    const res = await fetch('/api/admin/intelligence/health');
    if (res.ok) return { health: await res.json(), error: null };
    return { health: null, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { health: null, error: e.message ?? 'Failed to load' };
  }
}

import { listPlans, type ReleasePlan } from '$lib/api/plans';

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const result = await listPlans(params.projectKey);
    return { projectKey: params.projectKey, plans: result.items, nextCursor: result.nextCursor, error: null };
  } catch (e) {
    return { projectKey: params.projectKey, plans: [] as ReleasePlan[], nextCursor: null, error: (e as Error).message };
  }
}

import { listPlans, type ReleasePlan } from '$lib/api/plans';

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const plans = await listPlans(params.projectKey);
    return { projectKey: params.projectKey, plans, error: null };
  } catch (e) {
    return { projectKey: params.projectKey, plans: [] as ReleasePlan[], error: (e as Error).message };
  }
}

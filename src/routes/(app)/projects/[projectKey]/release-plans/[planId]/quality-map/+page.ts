import { getPlanQualityMap, type SetaraMap } from '$lib/api/mindmaps';

export async function load({ params, url }: { params: { projectKey: string; planId: string }; url: URL }) {
  const includeScenarios = url.searchParams.get('includeScenarios') === 'true';
  const riskOnly = url.searchParams.get('riskOnly') === 'true';
  const depth = Number(url.searchParams.get('depth') ?? 2);
  try {
    const qualityMap = await getPlanQualityMap(params.projectKey, params.planId, { depth, includeScenarios, riskOnly });
    return { projectKey: params.projectKey, planId: params.planId, qualityMap, includeScenarios, riskOnly, depth, error: null };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      planId: params.planId,
      qualityMap: null as SetaraMap | null,
      includeScenarios,
      riskOnly,
      depth,
      error: (e as Error).message
    };
  }
}

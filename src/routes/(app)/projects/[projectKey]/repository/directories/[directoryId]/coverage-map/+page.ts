import { getDirectoryCoverageMap, type SetaraMap } from '$lib/api/mindmaps';

export async function load({ params, url }: { params: { projectKey: string; directoryId: string }; url: URL }) {
  const includeScenarios = url.searchParams.get('includeScenarios') !== 'false';
  const riskOnly = url.searchParams.get('riskOnly') === 'true';
  const depth = Number(url.searchParams.get('depth') ?? 2);
  try {
    const coverageMap = await getDirectoryCoverageMap(params.projectKey, params.directoryId, { depth, includeScenarios, riskOnly });
    return { projectKey: params.projectKey, directoryId: params.directoryId, coverageMap, includeScenarios, riskOnly, depth, error: null };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      directoryId: params.directoryId,
      coverageMap: null as SetaraMap | null,
      includeScenarios,
      riskOnly,
      depth,
      error: (e as Error).message
    };
  }
}

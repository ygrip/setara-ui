import { getDirectoryCoverageMap, type SetaraMap } from '$lib/api/mindmaps';
import { mockNodesByProject } from '$lib/mock/data';

export const prerender = import.meta.env.VITE_MOCK === 'true';
export const trailingSlash = 'always';

export function entries() {
  return Object.entries(mockNodesByProject).flatMap(([projectKey, nodes]) =>
    nodes
      .filter((node) => node.nodeType === 'DIRECTORY')
      .flatMap((node) => {
        const directoryIds = new Set([node.id, node.directoryId].filter((id): id is string => Boolean(id)));
        return [...directoryIds].map((directoryId) => ({ projectKey, directoryId }));
      })
  );
}

export async function load({ params, url }: { params: { projectKey: string; directoryId: string }; url: URL }) {
  const searchParams = import.meta.env.SSR && prerender ? new URLSearchParams() : url.searchParams;
  const includeScenarios = searchParams.get('includeScenarios') !== 'false';
  const riskOnly = searchParams.get('riskOnly') === 'true';
  const depth = Number(searchParams.get('depth') ?? 2);
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

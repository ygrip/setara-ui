import { listNodes, type TestNode } from '$lib/api/testcases';

export async function load({ params, url }: { params: { projectKey: string }; url: URL }) {
  try {
    const nodes = await listNodes(params.projectKey);
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      nodes,
      error: null
    };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      nodeId: url.searchParams.get('nodeId'),
      nodes: [] as TestNode[],
      error: (e as Error).message
    };
  }
}

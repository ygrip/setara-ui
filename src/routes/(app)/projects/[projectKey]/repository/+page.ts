import { listNodes, listScenarios, type Scenario, type TestNode } from '$lib/api/testcases';

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const [nodes, scenarios] = await Promise.all([
      listNodes(params.projectKey),
      listScenarios(params.projectKey)
    ]);
    return { projectKey: params.projectKey, nodes, scenarios, error: null };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      nodes: [] as TestNode[],
      scenarios: [] as Scenario[],
      error: (e as Error).message
    };
  }
}

import { listNodes, listScenarios, type Scenario, type TestNode } from '$lib/api/testcases';

export async function load({ params }: { params: { projectKey: string } }) {
  try {
    const [nodes, scenarios, draftScenarios] = await Promise.all([
      listNodes(params.projectKey),
      listScenarios(params.projectKey, null, 'ACTIVE'),
      listScenarios(params.projectKey, null, 'DRAFT')
    ]);
    return { projectKey: params.projectKey, nodes, scenarios, draftScenarios, error: null };
  } catch (e) {
    return {
      projectKey: params.projectKey,
      nodes: [] as TestNode[],
      scenarios: [] as Scenario[],
      draftScenarios: [] as Scenario[],
      error: (e as Error).message
    };
  }
}

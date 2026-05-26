import { listRuns, getRunHeatmap, type AutomationRun, type HeatmapDay } from '$lib/api/runs';

export async function load({ params }: { params: { projectKey: string } }) {
  const { projectKey } = params;
  try {
    const [result, heatmap] = await Promise.all([
      listRuns(projectKey),
      getRunHeatmap(projectKey, 182)
    ]);
    return { projectKey, runs: result.items, nextCursor: result.nextCursor, heatmap, error: null };
  } catch (e) {
    return { projectKey, runs: [] as AutomationRun[], nextCursor: null, heatmap: [] as HeatmapDay[], error: (e as Error).message };
  }
}

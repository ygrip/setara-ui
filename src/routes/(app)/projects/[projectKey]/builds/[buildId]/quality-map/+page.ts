import { getBuild, listBuildScenarios } from '$lib/api/builds';
import type { SetaraMap, MapNode, MapEdge } from '$lib/api/mindmaps';

export async function load({ params }: { params: { projectKey: string; buildId: string } }) {
  const { projectKey, buildId } = params;

  try {
    const [build, scenariosPage] = await Promise.all([
      getBuild(projectKey, buildId),
      listBuildScenarios(projectKey, buildId)
    ]);
    const buildScenarios = scenariosPage.items;

    // Build the map client-side from scenarios grouped by directoryPath
    const dirMap = new Map<string, typeof buildScenarios>();
    for (const s of buildScenarios) {
      const path = s.directoryPath ?? 'Uncategorized';
      if (!dirMap.has(path)) dirMap.set(path, []);
      dirMap.get(path)!.push(s);
    }

    const rootId = `build:${buildId}`;
    const statusScore = (s: string) => {
      if (s === 'PASSED') return 'HEALTHY';
      if (s === 'FAILED') return 'AT_RISK';
      if (s === 'BLOCKED') return 'AT_RISK';
      return 'WARNING';
    };
    const buildStatus = build.status === 'VERIFIED' ? 'HEALTHY' : build.status === 'IN_PROGRESS' ? 'WARNING' : 'NOT_EXECUTED';

    const nodes: MapNode[] = [
      {
        id: rootId,
        type: 'BUILD',
        label: build.name,
        subtitle: build.buildKey,
        status: buildStatus,
        severity: 'MEDIUM',
        metrics: {
          total: build.metrics.totalScenarios,
          passed: build.metrics.passed,
          failed: build.metrics.failed,
          passPercentage: build.metrics.passPercentage
        },
        badges: [build.status],
        target: null
      }
    ];
    const edges: MapEdge[] = [];

    for (const [dirPath, scenariosInDir] of dirMap) {
      const dirId = `dir:${dirPath}`;
      const dirPassed = scenariosInDir.filter(s => s.latestStatus === 'PASSED').length;
      const dirFailed = scenariosInDir.filter(s => s.latestStatus === 'FAILED').length;
      const dirTotal = scenariosInDir.length;
      const dirLabel = dirPath.split('/').pop() ?? dirPath;
      const dirStatus = dirFailed > 0 ? 'AT_RISK' : dirPassed === dirTotal ? 'HEALTHY' : 'WARNING';

      nodes.push({
        id: dirId,
        type: 'DIRECTORY',
        label: dirLabel,
        subtitle: dirPath,
        status: dirStatus,
        severity: 'LOW',
        metrics: { total: dirTotal, passed: dirPassed, failed: dirFailed },
        badges: [`${dirTotal} scenarios`],
        target: null
      });
      edges.push({ id: `edge:${rootId}:${dirId}`, source: rootId, target: dirId, type: 'HAS_DIRECTORY', label: 'directory' });

      for (const scenario of scenariosInDir) {
        const sId = `scenario:${scenario.id}`;
        nodes.push({
          id: sId,
          type: 'SCENARIO',
          label: scenario.name,
          subtitle: scenario.scenarioKey,
          status: statusScore(scenario.latestStatus),
          severity: scenario.priority === 'CRITICAL' ? 'CRITICAL' : scenario.priority === 'HIGH' ? 'HIGH' : 'LOW',
          metrics: { latestStatus: scenario.latestStatus },
          badges: [scenario.latestStatus],
          target: null
        });
        edges.push({ id: `edge:${dirId}:${sId}`, source: dirId, target: sId, type: 'HAS_SCENARIO', label: scenario.scenarioKey });
      }
    }

    const qualityMap: SetaraMap = {
      mapId: `BUILD_MAP:${buildId}`,
      mapType: 'BUILD_MAP',
      rootNodeId: rootId,
      generatedAt: new Date().toISOString(),
      summary: {
        title: `${build.name} Quality Map`,
        subtitle: build.buildKey,
        status: buildStatus,
        confidence: 'HIGH',
        metrics: { passPercentage: build.metrics.passPercentage, total: build.metrics.totalScenarios }
      },
      nodes,
      edges,
      legend: {
        statuses: { HEALTHY: 'Healthy', WARNING: 'Needs attention', AT_RISK: 'At risk', NOT_EXECUTED: 'Not executed' },
        severities: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' },
        nodeTypes: { BUILD: 'Build', DIRECTORY: 'Directory', SCENARIO: 'Scenario' }
      }
    };

    return { projectKey, buildId, build, qualityMap, error: null };
  } catch (e) {
    return { projectKey, buildId, build: null, qualityMap: null, error: (e as Error).message };
  }
}

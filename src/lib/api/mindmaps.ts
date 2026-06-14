import { apiFetch } from './client';
import { isMockMode } from '$lib/mock/client';
import { mockNodesByProject, mockPlansByProject, mockScenariosByProject, mockSquadPlans, mockPlanBuilds, mockBuildsByProject } from '$lib/mock/data';

export interface SetaraMap {
  mapId: string;
  mapType: 'QUALITY_MAP' | 'COVERAGE_MAP' | string;
  rootNodeId: string;
  generatedAt: string;
  summary: MapSummary;
  nodes: MapNode[];
  edges: MapEdge[];
  legend: MapLegend;
}

export interface MapSummary {
  title: string;
  subtitle: string | null;
  status: string;
  confidence: string;
  metrics: Record<string, unknown>;
}

export interface MapNode {
  id: string;
  type: string;
  label: string;
  subtitle: string | null;
  status: string;
  severity: string;
  metrics: Record<string, unknown>;
  badges: string[];
  target: MapTarget | null;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
}

export interface MapLegend {
  statuses: Record<string, string>;
  severities: Record<string, string>;
  nodeTypes: Record<string, string>;
}

export interface MapTarget {
  entityType: string;
  entityId: string;
  href: string;
}

export async function getPlanQualityMap(projectKey: string, planId: string, options: {
  depth?: number;
  includeScenarios?: boolean;
  riskOnly?: boolean;
} = {}): Promise<SetaraMap> {
  if (isMockMode()) return mockPlanQualityMap(projectKey, planId, options);
  const params = new URLSearchParams({
    depth: String(options.depth ?? 2),
    includeScenarios: String(options.includeScenarios ?? false),
    riskOnly: String(options.riskOnly ?? false)
  });
  const res = await apiFetch(`/api/projects/${projectKey}/plans/${planId}/quality-map?${params}`);
  return res.json();
}

export async function getSquadPlanQualityMap(squadId: string, planId: string): Promise<SetaraMap> {
  if (isMockMode()) return mockSquadPlanQualityMap(squadId, planId);
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/quality-map`);
  return res.json();
}

export async function getDirectoryCoverageMap(projectKey: string, directoryId: string, options: {
  depth?: number;
  includeScenarios?: boolean;
  riskOnly?: boolean;
} = {}): Promise<SetaraMap> {
  if (isMockMode()) return mockDirectoryCoverageMap(projectKey, directoryId, options);
  const params = new URLSearchParams({
    depth: String(options.depth ?? 2),
    includeScenarios: String(options.includeScenarios ?? true),
    riskOnly: String(options.riskOnly ?? false)
  });
  const res = await apiFetch(`/api/projects/${projectKey}/directories/${directoryId}/coverage-map?${params}`);
  return res.json();
}

function mockPlanQualityMap(projectKey: string, planId: string, options: { includeScenarios?: boolean; riskOnly?: boolean }): SetaraMap {
  const plan = (mockPlansByProject[projectKey] ?? [])[0];
  const scenarios = (mockScenariosByProject[projectKey] ?? []).filter(s => s.status === 'ACTIVE');
  const rootId = `plan:${planId}`;
  const nodes: MapNode[] = [
    node(rootId, 'PLAN', plan?.name ?? 'Release Plan', plan?.releaseVersion ?? projectKey, 'AT_RISK', 'MEDIUM', summarize(scenarios), ['OPEN']),
    node(`gate:${planId}`, 'QUALITY_GATE', 'Quality Gate', 'Evidence and coverage confidence', 'AT_RISK', 'MEDIUM', summarize(scenarios), ['MEDIUM']),
    node(`project:${projectKey}`, 'PROJECT', projectKey, 'Project scope', 'WARNING', 'LOW', summarize(scenarios), ['project'])
  ];
  const edges: MapEdge[] = [
    edge(rootId, `gate:${planId}`, 'HAS_GATE', 'quality'),
    edge(rootId, `project:${projectKey}`, 'COVERS', 'scope')
  ];
  const byNode = new Map<string, typeof scenarios>();
  for (const scenario of scenarios) {
    byNode.set(scenario.nodeId, [...(byNode.get(scenario.nodeId) ?? []), scenario]);
  }
  for (const [nodeId, grouped] of byNode) {
    const directory = (mockNodesByProject[projectKey] ?? []).find(n => n.id === nodeId);
    const mapId = `directory:${nodeId}`;
    nodes.push(node(mapId, 'DIRECTORY', directory?.name ?? nodeId, directory?.path ?? null, 'WARNING', 'MEDIUM', summarize(grouped), [`${grouped.length} scenarios`]));
    edges.push(edge(`project:${projectKey}`, mapId, 'HAS_DIRECTORY', 'coverage'));
    if (options.includeScenarios) {
      for (const scenario of grouped) {
        nodes.push(node(`scenario:${scenario.id}`, 'SCENARIO', scenario.name, scenario.scenarioKey, scenario.priority === 'CRITICAL' ? 'AT_RISK' : 'HEALTHY', scenario.priority ?? 'LOW', summarize([scenario]), [scenario.automationStatus]));
        edges.push(edge(mapId, `scenario:${scenario.id}`, 'HAS_SCENARIO', scenario.scenarioKey));
      }
    }
  }
  return map('QUALITY_MAP', rootId, 'Quality Map', plan?.name ?? projectKey, nodes, edges);
}

function mockSquadPlanQualityMap(_squadId: string, planId: string): SetaraMap {
  const plan = mockSquadPlans.find(p => p.id === planId) ?? mockSquadPlans[0];
  const planBuilds = mockPlanBuilds[planId] ?? [];
  const rootId = `plan:${planId}`;
  const planStatus = plan?.status === 'CLOSED' ? 'HEALTHY' : plan?.status === 'IN_PROGRESS' ? 'WARNING' : 'NOT_EXECUTED';

  const nodes: MapNode[] = [
    node(rootId, 'PLAN', plan?.name ?? 'Release Plan', plan?.releaseVersion ?? planId, planStatus, 'MEDIUM',
      { totalBuilds: planBuilds.length, verifiedBuilds: planBuilds.filter(b => b.status === 'VERIFIED').length },
      [plan?.status ?? 'OPEN'])
  ];
  const edges: MapEdge[] = [];

  // Group builds by projectKey
  const byProject = new Map<string, typeof planBuilds>();
  for (const pb of planBuilds) {
    if (!byProject.has(pb.projectKey)) byProject.set(pb.projectKey, []);
    byProject.get(pb.projectKey)!.push(pb);
  }

  for (const [projectKey, projBuilds] of byProject) {
    const projId = `project:${projectKey}`;
    const projVerified = projBuilds.filter(b => b.status === 'VERIFIED').length;
    const projStatus = projVerified === projBuilds.length ? 'HEALTHY' : projVerified > 0 ? 'WARNING' : 'NOT_EXECUTED';
    nodes.push(node(projId, 'PROJECT', projBuilds[0].projectName, projectKey, projStatus, 'MEDIUM',
      { totalBuilds: projBuilds.length, verifiedBuilds: projVerified }, ['project']));
    edges.push(edge(rootId, projId, 'COVERS', 'scope'));

    for (const pb of projBuilds) {
      const buildNodeId = `build:${pb.buildId}`;
      const buildStatus = pb.status === 'VERIFIED' ? 'HEALTHY' : pb.status === 'IN_PROGRESS' ? 'WARNING' : 'NOT_EXECUTED';
      const passLabel = pb.metrics ? `${pb.metrics.passPercentage.toFixed(0)}% pass` : '';
      // Look up the actual build for the href
      const actualBuild = (mockBuildsByProject[projectKey] ?? []).find(b => b.id === pb.buildId);
      const href = actualBuild ? `/projects/${projectKey}/builds/${pb.buildId}` : null;
      const n = node(buildNodeId, 'BUILD', pb.buildName, pb.buildKey, buildStatus, 'LOW',
        { status: pb.status, passPercentage: pb.metrics?.passPercentage ?? 0 }, [pb.status, passLabel].filter(Boolean));
      n.target = href ? { entityType: 'BUILD', entityId: pb.buildId, href } : null;
      nodes.push(n);
      edges.push(edge(projId, buildNodeId, 'HAS_BUILD', 'build'));
    }
  }

  const unverified = planBuilds.filter(b => b.status !== 'VERIFIED').length;
  if (unverified > 0) {
    const riskId = `${rootId}:risk:unverified`;
    nodes.push(node(riskId, 'RISK', 'Unverified Builds', `${unverified} build(s) still pending verification`, 'AT_RISK', 'HIGH', { count: unverified }, ['risk']));
    edges.push(edge(rootId, riskId, 'HAS_RISK', 'critical'));
  }

  return map('SQUAD_PLAN_MAP', rootId, `${plan?.name ?? 'Release Plan'} Map`, plan?.name ?? planId, nodes, edges);
}

function mockDirectoryCoverageMap(projectKey: string, directoryId: string, options: { includeScenarios?: boolean; riskOnly?: boolean }): SetaraMap {
  const directory = (mockNodesByProject[projectKey] ?? []).find(n => n.id === directoryId || n.directoryId === directoryId) ?? (mockNodesByProject[projectKey] ?? [])[0];
  const scenarios = (mockScenariosByProject[projectKey] ?? []).filter(s => {
    const node = (mockNodesByProject[projectKey] ?? []).find(n => n.id === s.nodeId);
    return node && directory && (node.path === directory.path || node.path.startsWith(`${directory.path}/`));
  });
  const rootId = `directory:${directory?.id ?? directoryId}`;
  const nodes = [node(rootId, 'DIRECTORY', directory?.name ?? 'Directory', directory?.path ?? projectKey, 'WARNING', 'MEDIUM', summarize(scenarios), [`${scenarios.length} scenarios`])];
  const edges: MapEdge[] = [];
  if (options.includeScenarios !== false) {
    for (const scenario of scenarios) {
      nodes.push(node(`scenario:${scenario.id}`, 'SCENARIO', scenario.name, scenario.scenarioKey, scenario.priority === 'CRITICAL' ? 'AT_RISK' : 'HEALTHY', scenario.priority ?? 'LOW', summarize([scenario]), [scenario.automationStatus]));
      edges.push(edge(rootId, `scenario:${scenario.id}`, 'HAS_SCENARIO', scenario.scenarioKey));
    }
  }
  return map('COVERAGE_MAP', rootId, 'Coverage Map', directory?.path ?? projectKey, nodes, edges);
}

function map(mapType: string, rootNodeId: string, title: string, subtitle: string, nodes: MapNode[], edges: MapEdge[]): SetaraMap {
  const root = nodes.find(n => n.id === rootNodeId);
  return {
    mapId: `${mapType.toLowerCase()}:${rootNodeId}`,
    mapType,
    rootNodeId,
    generatedAt: new Date().toISOString(),
    summary: { title, subtitle, status: root?.status ?? 'WARNING', confidence: 'MEDIUM', metrics: root?.metrics ?? {} },
    nodes,
    edges,
    legend: {
      statuses: { HEALTHY: 'Healthy', WARNING: 'Needs attention', AT_RISK: 'At risk', BLOCKED: 'Blocked' },
      severities: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' },
      nodeTypes: { PLAN: 'Plan', QUALITY_GATE: 'Quality Gate', PROJECT: 'Project', DIRECTORY: 'Directory', SCENARIO: 'Scenario', RISK: 'Risk' }
    }
  };
}

function node(id: string, type: string, label: string, subtitle: string | null, status: string, severity: string, metrics: Record<string, unknown>, badges: string[]): MapNode {
  return { id, type, label, subtitle, status, severity, metrics, badges, target: null };
}

function edge(source: string, target: string, type: string, label: string): MapEdge {
  return { id: `edge:${source}:${target}:${type}`, source, target, type, label };
}

function summarize(scenarios: Array<{ automationStatus?: string; automatable?: boolean; priority?: string | null }>): Record<string, unknown> {
  const total = scenarios.length;
  const automated = scenarios.filter(s => s.automationStatus === 'AUTOMATED').length;
  const automatable = scenarios.filter(s => s.automatable).length;
  return {
    totalScenarios: total,
    automated,
    automatable,
    passed: Math.max(0, Math.floor(total * 0.72)),
    failed: total > 2 ? 1 : 0,
    notExecuted: Math.max(0, total - Math.floor(total * 0.72) - (total > 2 ? 1 : 0)),
    automationCoverage: total ? Math.round((automated / total) * 100) : 0,
    automatableCoverage: total ? Math.round((automatable / total) * 100) : 0,
    passPercentage: total ? 72 : 0
  };
}

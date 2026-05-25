<script lang="ts">
  import type { SetaraMap, MapNode } from '$lib/api/mindmaps';

  let { map }: { map: SetaraMap } = $props();

  const nodeById = $derived(new Map(map.nodes.map(node => [node.id, node])));
  const childrenById = $derived(buildChildren(map));
  const levels = $derived(buildLevels(map.rootNodeId, childrenById, nodeById));
  const positioned = $derived(positionNodes(levels));
  const canvasWidth = $derived(Math.max(960, levels.length * 280 + 120));
  const canvasHeight = $derived(Math.max(520, Math.max(...positioned.map(item => item.y + 150), 520)));

  function buildChildren(map: SetaraMap): Map<string, string[]> {
    const children = new Map<string, string[]>();
    for (const edge of map.edges) {
      children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    }
    return children;
  }

  function buildLevels(rootId: string, children: Map<string, string[]>, nodes: Map<string, MapNode>): MapNode[][] {
    const result: MapNode[][] = [];
    const visited = new Set<string>();
    let current = [rootId];
    while (current.length > 0) {
      const level = current.filter(id => nodes.has(id) && !visited.has(id));
      if (level.length === 0) break;
      level.forEach(id => visited.add(id));
      result.push(level.map(id => nodes.get(id)!));
      current = level.flatMap(id => children.get(id) ?? []);
    }
    const orphanNodes = map.nodes.filter(node => !visited.has(node.id));
    if (orphanNodes.length) result.push(orphanNodes);
    return result;
  }

  function positionNodes(levels: MapNode[][]): Array<MapNode & { x: number; y: number; cx: number; cy: number }> {
    const positioned: Array<MapNode & { x: number; y: number; cx: number; cy: number }> = [];
    levels.forEach((level, levelIndex) => {
      const verticalGap = Math.max(118, Math.floor(460 / Math.max(level.length, 1)));
      const startY = Math.max(28, (520 - (level.length - 1) * verticalGap) / 2);
      level.forEach((node, index) => {
        const x = 32 + levelIndex * 280;
        const y = startY + index * verticalGap;
        positioned.push({ ...node, x, y, cx: x + 120, cy: y + 54 });
      });
    });
    return positioned;
  }

  function metric(node: MapNode, key: string): string {
    const value = node.metrics?.[key];
    if (value === null || value === undefined) return '0';
    return String(value);
  }

  function statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }
</script>

<section class="map-shell" aria-label={map.summary.title}>
  <div class="map-summary">
    <div>
      <p>{map.mapType.replace(/_/g, ' ')}</p>
      <h2>{map.summary.title}</h2>
      <span>{map.summary.subtitle}</span>
    </div>
    <div class="summary-metrics">
      <span>Total <strong>{map.summary.metrics.totalScenarios ?? 0}</strong></span>
      <span>Automated <strong>{map.summary.metrics.automated ?? 0}</strong></span>
      <span>Coverage <strong>{map.summary.metrics.automationCoverage ?? 0}%</strong></span>
      <span>Confidence <strong>{map.summary.confidence}</strong></span>
    </div>
  </div>

  <div class="map-scroll">
    <div class="map-canvas" style={`width:${canvasWidth}px; height:${canvasHeight}px;`}>
      <svg class="edges" width={canvasWidth} height={canvasHeight} aria-hidden="true">
        {#each map.edges as edge}
          {@const source = positioned.find(node => node.id === edge.source)}
          {@const target = positioned.find(node => node.id === edge.target)}
          {#if source && target}
            <path
              d={`M ${source.x + 244} ${source.cy} C ${source.x + 280} ${source.cy}, ${target.x - 38} ${target.cy}, ${target.x - 4} ${target.cy}`}
              class={`edge edge-${edge.type.toLowerCase()}`}
            />
          {/if}
        {/each}
      </svg>

      {#each positioned as node}
        <article class="map-node status-{node.status.toLowerCase()}" class:risk={node.type === 'RISK'} style={`left:${node.x}px; top:${node.y}px;`}>
          <div class="node-head">
            <span class="node-type">{node.type.replace(/_/g, ' ')}</span>
            <span class="severity severity-{node.severity.toLowerCase()}">{statusLabel(node.severity)}</span>
          </div>
          <h3>{node.label}</h3>
          {#if node.subtitle}<p>{node.subtitle}</p>{/if}
          <div class="metric-grid">
            <span><strong>{metric(node, 'totalScenarios')}</strong> total</span>
            <span><strong>{metric(node, 'automated')}</strong> auto</span>
            <span><strong>{metric(node, 'failed')}</strong> fail</span>
          </div>
          {#if node.badges?.length}
            <div class="node-badges">
              {#each node.badges.slice(0, 3) as badge}
                <span>{badge}</span>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .map-shell {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  .map-summary {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    padding: 16px;
  }

  .map-summary p {
    margin: 0 0 4px;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .map-summary h2 {
    margin: 0;
    font-size: 1.18rem;
  }

  .map-summary span {
    color: var(--color-text-muted);
    font-size: 0.84rem;
  }

  .summary-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(110px, 1fr));
    gap: 8px;
    min-width: min(100%, 360px);
  }

  .summary-metrics span {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 9px 10px;
    background: var(--color-bg);
  }

  .summary-metrics strong {
    color: var(--color-text);
  }

  .map-scroll {
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background:
      linear-gradient(color-mix(in srgb, var(--color-accent), transparent 94%) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--color-accent), transparent 94%) 1px, transparent 1px),
      var(--color-bg);
    background-size: 32px 32px;
  }

  .map-canvas {
    position: relative;
    min-height: 520px;
  }

  .edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .edge {
    fill: none;
    stroke: color-mix(in srgb, var(--color-accent), transparent 48%);
    stroke-width: 2;
  }

  .map-node {
    position: absolute;
    width: 240px;
    min-height: 110px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface);
    box-shadow: var(--shadow);
    padding: 12px;
  }

  .map-node.status-healthy { border-color: color-mix(in srgb, var(--color-success), transparent 55%); }
  .map-node.status-warning { border-color: color-mix(in srgb, #f59e0b, transparent 45%); }
  .map-node.status-at_risk,
  .map-node.status-blocked { border-color: color-mix(in srgb, var(--color-danger), transparent 45%); }
  .map-node.risk { background: color-mix(in srgb, var(--color-danger), var(--color-surface) 94%); }

  .node-head,
  .node-badges,
  .metric-grid {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .node-head {
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .node-type,
  .severity,
  .node-badges span {
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text-muted), transparent 88%);
    color: var(--color-text-muted);
    padding: 3px 7px;
    font-size: 0.64rem;
    font-weight: 850;
    text-transform: uppercase;
  }

  .severity-critical,
  .severity-high {
    background: color-mix(in srgb, var(--color-danger), transparent 84%);
    color: var(--color-danger);
  }

  .severity-medium {
    background: color-mix(in srgb, #f59e0b, transparent 84%);
    color: #b45309;
  }

  h3 {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.25;
  }

  .map-node p {
    margin: 5px 0 10px;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    margin-bottom: 8px;
  }

  .metric-grid span {
    border-radius: 6px;
    background: var(--color-bg);
    padding: 5px 6px;
    color: var(--color-text-muted);
    font-size: 0.68rem;
    text-align: center;
  }

  .metric-grid strong {
    display: block;
    color: var(--color-text);
    font-size: 0.82rem;
  }

  @media (max-width: 720px) {
    .map-summary,
    .summary-metrics {
      grid-template-columns: 1fr;
      display: grid;
    }

    .map-node {
      width: 220px;
    }
  }
</style>

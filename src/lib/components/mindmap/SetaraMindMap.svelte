<script lang="ts">
  import type { SetaraMap, MapNode } from '$lib/api/mindmaps';

  type PositionedNode = MapNode & { x: number; y: number; cx: number; cy: number };

  let { map, onnodeclick }: { map: SetaraMap; onnodeclick?: (node: MapNode) => void } = $props();

  // ── Individual node drag ────────────────────────────────────────
  let positionOverrides = $state<Record<string, { x: number; y: number }>>({});
  let drag = $state<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // ── Viewport pan + zoom ─────────────────────────────────────────
  let panX = $state(32);
  let panY = $state(32);
  let zoom = $state(1);
  let panning = $state<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  let viewportEl = $state<HTMLDivElement | undefined>();

  // ── Derived layout ──────────────────────────────────────────────
  const nodeById = $derived(new Map(map.nodes.map(node => [node.id, node])));
  const childrenById = $derived(buildChildren(map));
  const levels = $derived(buildLevels(map.rootNodeId, childrenById, nodeById));
  const autoPositioned = $derived(positionNodes(levels));
  const positioned = $derived(
    autoPositioned.map(node => {
      const override = positionOverrides[node.id];
      if (!override) return node;
      return { ...node, x: override.x, y: override.y, cx: override.x + 120, cy: override.y + 54 };
    })
  );
  const canvasWidth = $derived(Math.max(960, levels.length * 280 + 240, Math.max(...positioned.map(item => item.x + 400), 960)));
  const canvasHeight = $derived(Math.max(600, Math.max(...positioned.map(item => item.y + 200), 600)));

  // Reset pan/zoom when map changes
  $effect(() => {
    map.mapId;
    positionOverrides = {};
    panX = 32;
    panY = 32;
    zoom = 1;
  });

  // ── Graph builders ──────────────────────────────────────────────
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

  function positionNodes(levels: MapNode[][]): PositionedNode[] {
    const positioned: PositionedNode[] = [];
    levels.forEach((level, levelIndex) => {
      const verticalGap = Math.max(118, Math.floor(500 / Math.max(level.length, 1)));
      const startY = Math.max(28, (520 - (level.length - 1) * verticalGap) / 2);
      level.forEach((node, index) => {
        const x = 32 + levelIndex * 280;
        const y = startY + index * verticalGap;
        positioned.push({ ...node, x, y, cx: x + 120, cy: y + 54 });
      });
    });
    return positioned;
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function metric(node: MapNode, key: string): string {
    const value = node.metrics?.[key];
    if (value === null || value === undefined) return '0';
    return String(value);
  }

  function statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  // ── Node drag ───────────────────────────────────────────────────
  function startDrag(node: PositionedNode, event: PointerEvent) {
    if (event.button !== 0) return;
    drag = {
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      moved: false
    };
    event.preventDefault();
    event.stopPropagation(); // don't trigger pan
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    const rawDx = event.clientX - drag.startClientX;
    const rawDy = event.clientY - drag.startClientY;
    const moved = drag.moved || Math.abs(rawDx) + Math.abs(rawDy) > 4;
    drag = { ...drag, moved };
    // Divide pixel delta by zoom so dragging feels 1:1 at all zoom levels
    const dx = rawDx / zoom;
    const dy = rawDy / zoom;
    positionOverrides = {
      ...positionOverrides,
      [drag.nodeId]: {
        x: Math.max(8, drag.startX + dx),
        y: Math.max(8, drag.startY + dy)
      }
    };
  }

  function endDrag() {
    if (!drag) return;
    const active = drag;
    drag = null;
    if (!active.moved) {
      const node = nodeById.get(active.nodeId);
      if (node) onnodeclick?.(node);
    }
  }

  // ── Viewport pan ────────────────────────────────────────────────
  function onViewportPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    // Only pan on background clicks (not node or its children)
    if ((event.target as HTMLElement).closest('.map-node')) return;
    panning = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: panX,
      startPanY: panY
    };
    event.preventDefault();
  }

  function movePan(event: PointerEvent) {
    if (!panning) return;
    panX = panning.startPanX + event.clientX - panning.startClientX;
    panY = panning.startPanY + event.clientY - panning.startClientY;
  }

  function endPan() {
    panning = null;
  }

  // Combined move/up handlers for both drag and pan
  function onPointerMove(event: PointerEvent) {
    moveDrag(event);
    movePan(event);
  }

  function onPointerUp() {
    endDrag();
    endPan();
  }

  // ── Zoom (mouse wheel, anchored at cursor) ───────────────────────
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const oldZoom = zoom;
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    const newZoom = Math.max(0.2, Math.min(3, oldZoom + delta));
    // Keep the canvas point under the cursor stationary
    panX = cursorX - (cursorX - panX) * (newZoom / oldZoom);
    panY = cursorY - (cursorY - panY) * (newZoom / oldZoom);
    zoom = newZoom;
  }

  // ── Zoom toolbar helpers ─────────────────────────────────────────
  function adjustZoom(delta: number) {
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const oldZoom = zoom;
    const newZoom = Math.max(0.2, Math.min(3, oldZoom + delta));
    panX = cx - (cx - panX) * (newZoom / oldZoom);
    panY = cy - (cy - panY) * (newZoom / oldZoom);
    zoom = newZoom;
  }

  function resetView() {
    panX = 32;
    panY = 32;
    zoom = 1;
  }

  function fitView() {
    if (!viewportEl || !positioned.length) return;
    const rect = viewportEl.getBoundingClientRect();
    const minX = Math.min(...positioned.map(n => n.x));
    const minY = Math.min(...positioned.map(n => n.y));
    const maxX = Math.max(...positioned.map(n => n.x + 244));
    const maxY = Math.max(...positioned.map(n => n.y + 120));
    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;
    const newZoom = Math.max(0.2, Math.min(1.5, Math.min(
      (rect.width - 48) / contentW,
      (rect.height - 48) / contentH
    )));
    panX = (rect.width - contentW * newZoom) / 2 - (minX - 40) * newZoom;
    panY = (rect.height - contentH * newZoom) / 2 - (minY - 40) * newZoom;
    zoom = newZoom;
  }

  function keyNode(node: MapNode, event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onnodeclick?.(node);
    }
  }
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} />

<section class="map-shell" aria-label={map.summary.title}>
  <!-- Summary header -->
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

  <!-- Toolbar -->
  <div class="map-toolbar">
    <div class="toolbar-group">
      <button class="tool-btn" onclick={fitView} title="Fit all nodes into view">⊞ Fit</button>
      <button class="tool-btn" onclick={resetView} title="Reset pan and zoom to default">⟳ Reset</button>
    </div>
    <div class="zoom-group">
      <button class="tool-btn zoom-btn" onclick={() => adjustZoom(-0.15)} title="Zoom out" aria-label="Zoom out">−</button>
      <span class="zoom-pct">{Math.round(zoom * 100)}%</span>
      <button class="tool-btn zoom-btn" onclick={() => adjustZoom(0.15)} title="Zoom in" aria-label="Zoom in">+</button>
    </div>
    <span class="pan-hint">Drag canvas to pan · Scroll to zoom · Drag node to rearrange</span>
  </div>

  <!-- Viewport -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="map-viewport"
    class:is-panning={!!panning}
    bind:this={viewportEl}
    onpointerdown={onViewportPointerDown}
    onwheel={onWheel}
    role="img"
    aria-label="Interactive quality map — drag to pan, scroll to zoom"
  >
    <!-- Transform wrapper for pan+zoom -->
    <div
      class="map-canvas-wrap"
      style={`transform: translate(${panX}px, ${panY}px) scale(${zoom}); transform-origin: 0 0;`}
    >
      <div class="map-canvas" style={`width:${canvasWidth}px; height:${canvasHeight}px;`}>
        <!-- Edge SVG -->
        <svg class="edges" width={canvasWidth} height={canvasHeight} aria-hidden="true">
          {#each map.edges as edge}
            {@const source = positioned.find(node => node.id === edge.source)}
            {@const target = positioned.find(node => node.id === edge.target)}
            {#if source && target}
              <path
                d={`M ${source.x + 244} ${source.cy} C ${source.x + 290} ${source.cy}, ${target.x - 50} ${target.cy}, ${target.x - 4} ${target.cy}`}
                class={`edge edge-${edge.type.toLowerCase()}`}
              />
            {/if}
          {/each}
        </svg>

        <!-- Nodes -->
        {#each positioned as node}
          <button
            type="button"
            class="map-node status-{node.status.toLowerCase()}"
            class:risk={node.type === 'RISK'}
            class:dragging={drag?.nodeId === node.id}
            style={`left:${node.x}px; top:${node.y}px;`}
            title="Drag to rearrange · Click to open"
            onpointerdown={(event) => startDrag(node, event)}
            onkeydown={(event) => keyNode(node, event)}
          >
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
          </button>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .map-shell {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  /* Summary header */
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

  .map-summary h2 { margin: 0; font-size: 1.18rem; }

  .map-summary > div > span { color: var(--color-text-muted); font-size: 0.84rem; }

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
    font-size: 0.82rem;
    color: var(--color-text-muted);
  }

  .summary-metrics strong { color: var(--color-text); }

  /* Toolbar */
  .map-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    flex-wrap: wrap;
  }

  .toolbar-group { display: flex; align-items: center; gap: 6px; }

  .tool-btn {
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 5px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
    line-height: 1;
  }

  .tool-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

  .zoom-group {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .zoom-btn {
    border: 0;
    border-radius: 0;
    padding: 5px 11px;
    font-size: 1rem;
    line-height: 1;
  }

  .zoom-pct {
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--color-text-muted);
    padding: 0 10px;
    min-width: 44px;
    text-align: center;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    user-select: none;
  }

  .pan-hint {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    margin-left: auto;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Viewport */
  .map-viewport {
    overflow: hidden;
    height: min(72vh, 700px);
    min-height: 420px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background:
      linear-gradient(color-mix(in srgb, var(--color-accent), transparent 94%) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--color-accent), transparent 94%) 1px, transparent 1px),
      var(--color-bg);
    background-size: 32px 32px;
    cursor: grab;
    position: relative;
    /* Prevent text selection during pan/drag */
    user-select: none;
  }

  .map-viewport.is-panning { cursor: grabbing; }

  /* Canvas transform wrapper — pan+zoom target */
  .map-canvas-wrap {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  .map-canvas {
    position: relative;
  }

  /* Edges SVG */
  .edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }

  .edge {
    fill: none;
    stroke: color-mix(in srgb, var(--color-accent), transparent 48%);
    stroke-width: 2;
  }

  /* Nodes */
  .map-node {
    position: absolute;
    width: 240px;
    min-height: 110px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface);
    box-shadow: var(--shadow);
    padding: 12px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    text-align: left;
    color: var(--color-text);
    transition: box-shadow 0.12s, border-color 0.12s;
  }

  .map-node:hover {
    box-shadow: 0 4px 20px color-mix(in srgb, #000, transparent 84%);
    border-color: color-mix(in srgb, var(--color-accent), transparent 40%);
  }

  .map-node.dragging {
    cursor: grabbing;
    z-index: 4;
    box-shadow: 0 18px 40px color-mix(in srgb, #000, transparent 80%);
  }

  .map-node.status-healthy { border-color: color-mix(in srgb, var(--color-success), transparent 55%); }
  .map-node.status-warning { border-color: color-mix(in srgb, #f59e0b, transparent 45%); }
  .map-node.status-at_risk,
  .map-node.status-blocked { border-color: color-mix(in srgb, var(--color-danger), transparent 45%); }
  .map-node.risk { background: color-mix(in srgb, var(--color-danger), var(--color-surface) 94%); }

  .node-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
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

  h3 { margin: 0; font-size: 0.92rem; line-height: 1.25; }

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

  .node-badges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  @media (max-width: 720px) {
    .map-summary,
    .summary-metrics {
      grid-template-columns: 1fr;
      display: grid;
    }

    .map-node { width: 200px; }
    .pan-hint { display: none; }
  }
</style>

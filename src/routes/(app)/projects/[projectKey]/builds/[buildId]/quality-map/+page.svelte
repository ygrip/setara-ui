<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import type { MapNode } from '$lib/api/mindmaps';
  import SetaraMindMap from '$lib/components/mindmap/SetaraMindMap.svelte';

  let { data } = $props();

  function handleNodeClick(node: MapNode) {
    const href = node.target?.href;
    if (href) goto(href);
  }
</script>

<svelte:head>
  <title>{data.build?.name ?? 'Build'} Quality Map — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/builds">Builds</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/builds/{data.buildId}">{data.build?.buildKey ?? data.buildId}</a>
    <span class="sep">›</span>
    <strong>Quality Map</strong>
  </nav>

  <div class="page-header">
    <div>
      <p class="page-eyebrow">Build Quality Map</p>
      <h1 class="page-title">{data.build?.name ?? 'Build'}</h1>
      <span class="page-sub">Scenario status by directory, grouped for build readiness overview.</span>
    </div>
    <Button variant="secondary" href="/projects/{data.projectKey}/builds/{data.buildId}"
      icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
    >Back to Build</Button>
  </div>

  {#if data.error}
    <div class="error-banner" role="alert">Could not load quality map — {data.error}</div>
  {:else if data.qualityMap}
    <SetaraMindMap map={data.qualityMap} onnodeclick={handleNodeClick} />
  {:else}
    <div class="empty-state">No map data available.</div>
  {/if}
</div>

<style>
  .page { max-width: none; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .page-eyebrow { margin: 0 0 4px; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem; font-weight: 850; }
  .page-title { margin: 0; font-size: clamp(1.25rem, 4vw, 1.5rem); font-weight: 700; }
  .page-sub { color: var(--color-text-muted); font-size: 0.86rem; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; }
  .empty-state { color: var(--color-text-muted); padding: 48px 24px; text-align: center; font-size: 0.875rem; }
</style>

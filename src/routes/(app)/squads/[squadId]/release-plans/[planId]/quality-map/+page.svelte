<script lang="ts">
  import { goto } from '$app/navigation';
  import type { MapNode } from '$lib/api/mindmaps';
  import SetaraMindMap from '$lib/components/mindmap/SetaraMindMap.svelte';

  let { data } = $props();

  function handleNodeClick(node: MapNode) {
    const href = node.target?.href;
    if (href) goto(href);
  }
</script>

<svelte:head>
  <title>Release Plan Map — {data.squadId} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/coverage-overview">Squads</a>
    <span class="sep">›</span>
    <a href="/squads/{data.squadId}/release-plans">Release Plans</a>
    <span class="sep">›</span>
    <a href="/squads/{data.squadId}/release-plans/{data.planId}">Plan</a>
    <span class="sep">›</span>
    <strong>Quality Map</strong>
  </nav>

  <div class="page-header">
    <div>
      <p class="page-eyebrow">Squad Release Plan</p>
      <h1 class="page-title">Quality Map</h1>
      <span class="page-sub">Build readiness, project coverage, and release health in one view.</span>
    </div>
    <a href="/squads/{data.squadId}/release-plans/{data.planId}" class="btn btn--secondary">
      ← Back to Plan
    </a>
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
  .btn { font: inherit; font-size: 0.875rem; padding: 8px 16px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; }
  .btn--secondary { background: transparent; color: var(--color-text); border-color: var(--color-border); }
  .btn--secondary:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; }
  .empty-state { color: var(--color-text-muted); padding: 48px 24px; text-align: center; font-size: 0.875rem; }
</style>

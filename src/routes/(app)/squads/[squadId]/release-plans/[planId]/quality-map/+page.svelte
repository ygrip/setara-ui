<script lang="ts">
  import { goto } from '$app/navigation';
  import type { MapNode } from '$lib/api/mindmaps';
  import SetaraMindMap from '$lib/components/mindmap/SetaraMindMap.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data } = $props();

  function handleNodeClick(node: MapNode) {
    const href = node.target?.href;
    if (href) goto(href);
  }
</script>

<svelte:head>
  <title>Release Plan Map - {data.squadId} - Setara</title>
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
    <AppAlert tone="error" title="Could not load quality map">{data.error}</AppAlert>
  {:else if data.qualityMap}
    <SetaraMindMap map={data.qualityMap} onnodeclick={handleNodeClick} />
  {:else}
    <EmptyState
      title="No quality map data"
      hint="Add builds with executed scenarios to generate coverage map data."
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
        </svg>
      </svelte:fragment>
    </EmptyState>
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
</style>

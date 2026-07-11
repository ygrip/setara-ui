<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import type { MapNode } from '$lib/api/mindmaps';
  import SetaraMindMap from '$lib/components/mindmap/SetaraMindMap.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

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
    <AppAlert tone="error" title="Could not load quality map">{data.error}</AppAlert>
  {:else if data.qualityMap}
    <SetaraMindMap map={data.qualityMap} onnodeclick={handleNodeClick} />
  {:else}
    <EmptyState
      title="No quality map data"
      hint="Run scenarios in this build to generate coverage map data."
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
  :global(.page > .app-alert) { margin-bottom: 16px; }
</style>

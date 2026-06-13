<script lang="ts">
  import { Skeleton } from 'flowbite-svelte';

  let {
    width = '100%',
    height = '1rem',
    radius = '8px',
    lines = 1,
    className = ''
  }: {
    width?: string;
    height?: string;
    radius?: string;
    lines?: number;
    className?: string;
  } = $props();
</script>

<div class="app-skeleton-group {className}" aria-hidden="true" style="--sk-w:{width};--sk-h:{height};--sk-r:{radius}">
  {#each Array(Math.max(1, lines)) as _, i}
    <Skeleton class="app-skeleton" style={`width:${i === lines - 1 && lines > 1 ? '72%' : width}`} />
  {/each}
</div>

<style>
  .app-skeleton-group {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  :global(.app-skeleton) {
    height: var(--sk-h, 1rem) !important;
    border-radius: var(--sk-r, 8px) !important;
    background: linear-gradient(90deg,
      color-mix(in srgb, var(--color-border), transparent 35%),
      color-mix(in srgb, var(--color-surface), var(--color-border) 22%),
      color-mix(in srgb, var(--color-border), transparent 35%)
    ) !important;
    background-size: 220% 100% !important;
    animation: app-skeleton-shimmer 1.35s ease-in-out infinite !important;
  }

  @keyframes app-skeleton-shimmer {
    from { background-position: 120% 0; }
    to   { background-position: -120% 0; }
  }
</style>

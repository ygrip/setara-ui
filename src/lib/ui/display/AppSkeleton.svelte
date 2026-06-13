<script lang="ts">
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

<div class="app-skeleton-group {className}" aria-hidden="true">
  {#each Array(Math.max(1, lines)) as _, index}
    <span
      class="app-skeleton"
      style={`width:${index === lines - 1 && lines > 1 ? '72%' : width};height:${height};border-radius:${radius}`}
    ></span>
  {/each}
</div>

<style>
  .app-skeleton-group {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  .app-skeleton {
    display: block;
    max-width: 100%;
    background: linear-gradient(90deg,
      color-mix(in srgb, var(--color-border), transparent 35%),
      color-mix(in srgb, var(--color-surface), var(--color-border) 22%),
      color-mix(in srgb, var(--color-border), transparent 35%)
    );
    background-size: 220% 100%;
    animation: skeleton-shimmer 1.35s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    from { background-position: 120% 0; }
    to { background-position: -120% 0; }
  }
</style>


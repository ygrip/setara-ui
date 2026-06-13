<script lang="ts">
  import Card from '$lib/components/Card.svelte';

  let {
    title,
    subtitle = '',
    eyebrow = '',
    variant = 'default',
    href = '',
    interactive = false,
    className = '',
    children
  }: {
    title: string;
    subtitle?: string;
    eyebrow?: string;
    variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
    href?: string;
    interactive?: boolean;
    className?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<Card padding="lg" {href} {interactive} className={`bento-card bento-card--${variant} ${className}`}>
  <div class="bento-card__header">
    {#if eyebrow}<span class="bento-card__eyebrow">{eyebrow}</span>{/if}
    <h3>{title}</h3>
    {#if subtitle}<p>{subtitle}</p>{/if}
  </div>
  <div class="bento-card__body">
    {@render children?.()}
  </div>
</Card>

<style>
  :global(.bento-card) {
    position: relative;
    overflow: hidden;
  }

  :global(.bento-card)::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
    background: var(--bento-accent, var(--color-border));
  }

  .bento-card__header {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .bento-card__eyebrow {
    color: var(--bento-accent, var(--color-text-muted));
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .bento-card__header h3 {
    font-size: clamp(1rem, 2vw, 1.18rem);
  }

  .bento-card__header p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .bento-card__body {
    margin-top: 18px;
    min-width: 0;
  }

  :global(.bento-card--default) { --bento-accent: var(--color-border); }
  :global(.bento-card--accent) { --bento-accent: var(--color-accent); }
  :global(.bento-card--success) { --bento-accent: var(--color-success); }
  :global(.bento-card--warning) { --bento-accent: var(--color-warning); }
  :global(.bento-card--danger) { --bento-accent: var(--color-danger); }
  :global(.bento-card--info) { --bento-accent: var(--color-info); }
</style>


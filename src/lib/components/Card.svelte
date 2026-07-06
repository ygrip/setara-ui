<script lang="ts">
  let {
    padding = 'md',
    interactive = false,
    href = '',
    ariaLabel = '',
    className = '',
    children
  }: {
    padding?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
    href?: string;
    ariaLabel?: string;
    className?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if href}
  <a class="card surface-card card--{padding} card--interactive card--link {className}" {href} aria-label={ariaLabel || undefined}>
    {@render children?.()}
  </a>
{:else}
  <div class="card surface-card card--{padding} {className}" class:card--interactive={interactive}>
    {@render children?.()}
  </div>
{/if}

<style>
  .card {
    background: var(--surface-card-bg, var(--color-surface));
    border: 1px solid var(--surface-card-border, var(--color-border));
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    height: 100%;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease;
  }

  .card--link:hover {
    text-decoration: none;
    color: inherit;
  }

  .card--sm {
    padding: 14px;
  }

  .card--md {
    padding: 18px;
  }

  .card--lg {
    padding: clamp(20px, 3vw, 28px);
  }

  .card--interactive:hover {
    border-color: color-mix(in srgb, var(--color-accent), transparent 36%);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .card--interactive:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .card--md,
    .card--lg {
      padding: 16px;
    }
  }
</style>

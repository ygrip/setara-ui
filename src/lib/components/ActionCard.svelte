<script lang="ts">
  import Card from '$lib/components/Card.svelte';

  let {
    title,
    description = '',
    href,
    icon = '',
    ariaLabel = '',
    children
  }: {
    title: string;
    description?: string;
    href: string;
    icon?: string;
    ariaLabel?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<Card padding="md" {href} interactive ariaLabel={ariaLabel || title} className="action-card">
  <div class="action-card__content">
    {#if icon}
      <span class="action-card__icon" aria-hidden="true">{@html icon}</span>
    {/if}
    <span class="action-card__copy">
      <strong>{title}</strong>
      {#if description}<small>{description}</small>{/if}
    </span>
    <span class="action-card__arrow" aria-hidden="true">→</span>
  </div>
  {@render children?.()}
</Card>

<style>
  .action-card__content {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .action-card__icon {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-text-muted);
  }

  .action-card__icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .action-card__copy {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .action-card__copy strong {
    color: var(--color-text);
    font-size: 0.88rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-card__copy small {
    color: var(--color-text-muted);
    font-size: 0.76rem;
    line-height: 1.35;
  }

  .action-card__arrow {
    flex: 0 0 auto;
    color: var(--color-text-muted);
    font-size: 0.86rem;
  }

  :global(.action-card:hover) .action-card__icon,
  :global(.action-card:hover) .action-card__arrow {
    color: var(--color-accent);
  }
</style>


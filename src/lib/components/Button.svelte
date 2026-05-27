<script lang="ts">
  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    href = '',
    icon = '',
    onclick,
    children
  }: {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    href?: string;
    icon?: string;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if href}
  <a
    {href}
    class="btn btn--{variant} btn--{size}"
    class:btn--disabled={disabled}
    aria-disabled={disabled}
  >
    {#if icon}<span class="btn-icon">{@html icon}</span>{/if}
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    class="btn btn--{variant} btn--{size}"
    {onclick}
  >
    {#if icon}<span class="btn-icon">{@html icon}</span>{/if}
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 500;
    font-family: var(--font-body);
    transition: background 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s;
    white-space: nowrap;
    text-decoration: none;
    line-height: 1.4;
  }

  .btn:disabled,
  .btn--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .btn-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .btn--sm {
    padding: 6px 12px;
    font-size: 0.8rem;
  }

  .btn--sm .btn-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  .btn--md {
    padding: 9px 18px;
    font-size: 0.875rem;
  }

  .btn--primary {
    background: var(--color-accent);
    color: #fff;
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
    box-shadow: 0 2px 8px rgba(0, 175, 165, 0.25);
  }

  .btn--secondary {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border: 1px solid var(--color-border);
  }

  .btn--secondary:hover:not(:disabled) {
    background: var(--color-border);
  }

  .btn--danger {
    background: #fee2e2;
    color: var(--color-danger);
  }

  .btn--danger:hover:not(:disabled) {
    background: #fecaca;
  }

  :global([data-theme="dark"]) .btn--secondary {
    background: rgba(0, 175, 165, 0.08);
  }

  :global([data-theme="dark"]) .btn--danger {
    background: #7f1d1d;
    color: #fca5a5;
  }
</style>

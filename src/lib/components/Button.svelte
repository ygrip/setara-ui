<script lang="ts">
  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    href = '',
    icon = '',
    iconOnly = false,
    fullWidth = false,
    ariaLabel = '',
    title = '',
    className = '',
    onclick,
    children
  }: {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    href?: string;
    icon?: string;
    iconOnly?: boolean;
    fullWidth?: boolean;
    ariaLabel?: string;
    title?: string;
    className?: string;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if href}
  <a
    {href}
    class="btn btn--{variant} btn--{size} {className}"
    class:btn--disabled={disabled}
    class:btn--icon={iconOnly}
    class:btn--full={fullWidth}
    aria-disabled={disabled}
    aria-label={ariaLabel || undefined}
    {title}
  >
    {#if icon}<span class="btn-icon">{@html icon}</span>{/if}
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    class="btn btn--{variant} btn--{size} {className}"
    class:btn--icon={iconOnly}
    class:btn--full={fullWidth}
    aria-label={ariaLabel || undefined}
    {title}
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
    justify-content: center;
    gap: 6px;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 500;
    font-family: var(--font-body);
    transition: background 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, border-color 0.15s, transform 0.08s;
    white-space: nowrap;
    text-decoration: none;
    line-height: 1.4;
    outline: none;
    min-height: 36px;
  }

  .btn--full {
    width: 100%;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(0, 175, 165, 0.2);
  }

  .btn:active:not(:disabled):not(.btn--disabled) {
    transform: translateY(1px);
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
    min-height: 32px;
  }

  .btn--icon {
    width: 34px;
    min-width: 34px;
    padding: 0;
    gap: 0;
  }

  .btn--icon.btn--sm {
    width: 30px;
    min-width: 30px;
  }

  .btn--sm .btn-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  .btn--md {
    padding: 8px 18px;
    font-size: 0.875rem;
    min-height: 38px;
  }

  @media (max-width: 768px) {
    .btn--md { min-height: 44px; padding: 10px 18px; }
    .btn--sm { min-height: 36px; padding: 7px 12px; }
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

  .btn--ghost {
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .btn--ghost.btn--danger {
    color: var(--color-danger);
  }

  .btn--ghost.btn--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-danger), transparent 90%);
    border-color: var(--color-danger);
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

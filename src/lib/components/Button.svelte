<script lang="ts">
  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    onclick,
    children
  }: {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<button
  {type}
  {disabled}
  class="btn btn--{variant} btn--{size}"
  {onclick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn--sm {
    padding: 5px 12px;
    font-size: 0.8rem;
  }

  .btn--md {
    padding: 8px 16px;
    font-size: 0.875rem;
  }

  .btn--primary {
    background: var(--color-accent);
    color: #fff;
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
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

  :global([data-theme="dark"]) .btn--danger {
    background: #7f1d1d;
    color: #fca5a5;
  }
</style>

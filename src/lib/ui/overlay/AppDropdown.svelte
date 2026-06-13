<script lang="ts">
  let {
    label,
    align = 'end',
    open = false,
    disabled = false,
    trigger,
    children
  }: {
    label: string;
    align?: 'start' | 'end';
    open?: boolean;
    disabled?: boolean;
    trigger?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="app-dropdown" class:app-dropdown--open={open}>
  <button class="app-dropdown__trigger" type="button" aria-haspopup="menu" aria-expanded={open} {disabled} onclick={() => open = !open}>
    {#if trigger}
      {@render trigger()}
    {:else}
      <span>{label}</span>
      <span aria-hidden="true">⌄</span>
    {/if}
  </button>
  {#if open}
    <div class="app-dropdown__menu app-dropdown__menu--{align}" role="menu">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .app-dropdown {
    position: relative;
    display: inline-flex;
  }

  .app-dropdown__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    font-weight: 700;
  }

  .app-dropdown__trigger:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .app-dropdown__trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .app-dropdown__menu {
    position: absolute;
    top: calc(100% + 8px);
    z-index: 130;
    min-width: 180px;
    max-width: min(280px, calc(100vw - 24px));
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }

  .app-dropdown__menu--start {
    left: 0;
  }

  .app-dropdown__menu--end {
    right: 0;
  }

  .app-dropdown__menu :global(button),
  .app-dropdown__menu :global(a) {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: var(--color-text);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .app-dropdown__menu :global(button:hover),
  .app-dropdown__menu :global(a:hover) {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }
</style>


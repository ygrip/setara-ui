<script lang="ts">
  import { Dropdown } from 'flowbite-svelte';

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

  let isOpen = $state(open);
  const uid = `dd-${Math.random().toString(36).slice(2, 8)}`;
  const placement = align === 'start' ? 'bottom-start' : 'bottom-end';
</script>

<div class="app-dropdown">
  <button
    id={uid}
    class="app-dropdown__trigger"
    type="button"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    {disabled}
    onclick={() => (isOpen = !isOpen)}
  >
    {#if trigger}
      {@render trigger()}
    {:else}
      <span>{label}</span>
      <span aria-hidden="true">⌄</span>
    {/if}
  </button>

  <Dropdown triggeredBy="#{uid}" {placement} bind:isOpen class="app-dropdown__menu" role="menu">
    {@render children?.()}
  </Dropdown>
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
    font-family: var(--font-body);
  }

  .app-dropdown__trigger:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .app-dropdown__trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  :global(.app-dropdown__menu) {
    min-width: 180px !important;
    max-width: min(280px, calc(100vw - 24px)) !important;
    padding: 6px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    box-shadow: var(--shadow-md) !important;
  }

  :global(.app-dropdown__menu button),
  :global(.app-dropdown__menu a) {
    width: 100% !important;
    min-height: 34px !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 8px 10px !important;
    border-radius: 6px !important;
    border: 0 !important;
    background: transparent !important;
    color: var(--color-text) !important;
    text-align: left !important;
    text-decoration: none !important;
    cursor: pointer !important;
  }

  :global(.app-dropdown__menu button:hover),
  :global(.app-dropdown__menu a:hover) {
    background: var(--color-accent-subtle) !important;
    color: var(--color-accent) !important;
  }
</style>

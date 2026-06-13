<script lang="ts">
  import { Popover } from 'flowbite-svelte';

  let {
    open = false,
    trigger,
    children
  }: {
    open?: boolean;
    trigger?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  } = $props();

  let isOpen = $state(open);
  const uid = `pop-${Math.random().toString(36).slice(2, 8)}`;
</script>

<span class="app-popover">
  <button type="button" id={uid} class="app-popover__trigger" aria-expanded={isOpen}>
    {@render trigger?.()}
  </button>
  <Popover triggeredBy="#{uid}" trigger="click" arrow={false} bind:isOpen class="app-popover__panel">
    {@render children?.()}
  </Popover>
</span>

<style>
  .app-popover {
    position: relative;
    display: inline-flex;
  }

  .app-popover__trigger {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  :global(.app-popover__panel) {
    width: min(320px, calc(100vw - 24px)) !important;
    padding: 12px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    box-shadow: var(--shadow-md) !important;
    font-family: var(--font-body) !important;
    color: var(--color-text) !important;
    font-size: 0.875rem !important;
  }
</style>

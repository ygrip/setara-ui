<script lang="ts">
  let {
    open = false,
    trigger,
    children
  }: {
    open?: boolean;
    trigger?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="app-popover">
  <button type="button" class="app-popover__trigger" aria-expanded={open} onclick={() => open = !open}>
    {@render trigger?.()}
  </button>
  {#if open}
    <div class="app-popover__panel">
      {@render children?.()}
    </div>
  {/if}
</div>

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

  .app-popover__panel {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 130;
    width: min(320px, calc(100vw - 24px));
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }
</style>


<script lang="ts">
  import { Drawer } from 'flowbite-svelte';

  let {
    open = false,
    title,
    side = 'right',
    onclose,
    children
  }: {
    open?: boolean;
    title: string;
    side?: 'left' | 'right';
    onclose?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  let isOpen = $state(open);

  $effect(() => { isOpen = open; });
  $effect(() => { if (!isOpen) onclose?.(); });
</script>

<Drawer bind:open={isOpen} placement={side} outsideclose class="app-drawer">
  <header class="app-drawer__header">
    <h2>{title}</h2>
    <button type="button" aria-label="Close drawer" onclick={() => { isOpen = false; }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </header>
  <div class="app-drawer__body">
    {@render children?.()}
  </div>
</Drawer>

<style>
  :global(.app-drawer) {
    width: min(440px, 100vw) !important;
    height: 100dvh !important;
    display: flex !important;
    flex-direction: column !important;
    border: 1px solid var(--color-border) !important;
    background: color-mix(in srgb, var(--color-surface), transparent 3%) !important;
    box-shadow: var(--shadow-md) !important;
    overflow: hidden !important;
    border-radius: 0 !important;
  }

  :global(.app-drawer.left-0) { border-left: 0 !important; }
  :global(.app-drawer.right-0) { border-right: 0 !important; }

  .app-drawer__header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--color-border);
  }

  .app-drawer__header h2 {
    min-width: 0;
    font-size: 1rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  .app-drawer__header button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .app-drawer__header button:hover {
    background: var(--color-accent-subtle);
    color: var(--color-text);
  }

  .app-drawer__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 18px;
  }

  @media (max-width: 520px) {
    :global(.app-drawer) { width: 100vw !important; }
  }
</style>

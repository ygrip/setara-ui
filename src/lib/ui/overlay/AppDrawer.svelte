<script lang="ts">
  import { lockBodyScroll } from '$lib/scroll-lock';

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

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose?.();
  }

  $effect(() => {
    if (!open) return;
    return lockBodyScroll();
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="app-drawer-backdrop" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onclick={handleBackdrop} onkeydown={handleKeydown}>
    <aside class="app-drawer app-drawer--{side}">
      <header class="app-drawer__header">
        <h2>{title}</h2>
        <button type="button" aria-label="Close drawer" onclick={onclose}>×</button>
      </header>
      <div class="app-drawer__body">
        {@render children?.()}
      </div>
    </aside>
  </div>
{/if}

<style>
  .app-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 140;
    display: flex;
    background: rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    overflow: hidden;
  }

  .app-drawer {
    width: min(440px, 100vw);
    height: 100dvh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface), transparent 3%);
    box-shadow: var(--shadow-md);
  }

  .app-drawer--left {
    margin-right: auto;
    border-left: 0;
  }

  .app-drawer--right {
    margin-left: auto;
    border-right: 0;
  }

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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-drawer__header button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
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
    .app-drawer {
      width: 100vw;
    }
  }
</style>


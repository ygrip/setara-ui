<script lang="ts">
  let {
    open = false,
    title,
    size = 'md',
    onclose,
    children
  }: {
    open?: boolean;
    title: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    onclose?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose?.();
  }
</script>

<svelte:body class:modal-open={open} />

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="backdrop" role="dialog" aria-modal="true" aria-label={title} tabindex="-1"
    onclick={handleBackdrop} onkeydown={handleKeydown}>
    <div class="modal modal--{size}">
      <div class="modal-header">
        <h2 class="modal-title">{title}</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
    overflow: hidden;
  }

  .modal {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 24px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
    border-radius: 16px;
    width: 100%;
    max-width: min(640px, calc(100vw - 32px));
    max-height: min(88vh, calc(100dvh - 32px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal--sm { max-width: min(480px, calc(100vw - 32px)); }
  .modal--lg { max-width: min(920px, calc(100vw - 32px)); }
  .modal--xl { max-width: min(1280px, calc(100vw - 32px)); }
  .modal--full {
    max-width: min(1560px, calc(100vw - 24px));
    max-height: min(94vh, calc(100dvh - 24px));
  }

  :global([data-theme="dark"]) .modal {
    background: rgba(11, 18, 32, 0.92);
    border: 1px solid rgba(255,255,255,0.1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    flex: 0 0 auto;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .close-btn:hover {
    color: var(--color-text);
    background: var(--color-accent-subtle);
  }

  .modal-body {
    padding: 20px;
    overflow: auto;
    min-height: 0;
  }

  :global(body.modal-open) {
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .backdrop { padding: 8px; align-items: stretch; }
    .modal,
    .modal--sm,
    .modal--md,
    .modal--lg,
    .modal--xl,
    .modal--full {
      max-width: calc(100vw - 16px);
      max-height: calc(100dvh - 16px);
      border-radius: 12px;
    }
    .modal-header { padding: 14px 16px; }
    .modal-body { padding: 16px; }
  }
</style>

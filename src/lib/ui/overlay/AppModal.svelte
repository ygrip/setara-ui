<script lang="ts">
  import { Modal } from 'flowbite-svelte';

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

  const sizeMap: Record<string, 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none'> = {
    sm: 'xs', md: 'md', lg: 'lg', xl: 'xl', full: 'xl'
  };

  let isOpen = $state(false);

  $effect(() => { isOpen = open; });
  $effect(() => { if (!isOpen) onclose?.(); });
</script>

<Modal {title} size={sizeMap[size]} bind:open={isOpen} outsideclose class="app-modal">
  {@render children?.()}
</Modal>

<style>
  :global(.app-modal) {
    border-radius: 16px !important;
    background: rgba(255, 255, 255, 0.9) !important;
    backdrop-filter: blur(24px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
    border: 1px solid rgba(255, 255, 255, 0.6) !important;
    box-shadow: 0 24px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08) !important;
    font-family: var(--font-body) !important;
    max-height: min(88vh, calc(100dvh - 32px)) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  :global(.app-modal [class*="modal-body"]) {
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
  }

  :global([data-theme="dark"] .app-modal) {
    background: rgba(11, 18, 32, 0.92) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
  }

  :global(.app-modal .modal-header,
  .app-modal [data-modal-header]) {
    border-bottom: 1px solid var(--color-border) !important;
  }

  :global(.app-modal h3) {
    color: var(--color-text) !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
  }
</style>

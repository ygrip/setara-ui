<script lang="ts">
  import { Toast } from 'flowbite-svelte';
  import type { AppTone } from '$lib/ui/types';

  let {
    tone = 'info',
    title = '',
    message = '',
    open = true,
    className = '',
    onclose,
    children
  }: {
    tone?: AppTone;
    title?: string;
    message?: string;
    open?: boolean;
    className?: string;
    onclose?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  let toastStatus = $state(open);

  $effect(() => { toastStatus = open; });
  $effect(() => { if (!toastStatus) onclose?.(); });
</script>

{#if toastStatus}
  <div class="app-toast-wrap app-toast-wrap--{tone} {className}">
    <Toast color="gray" bind:toastStatus role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      {#snippet icon()}
        <span class="app-toast__rail" aria-hidden="true"></span>
      {/snippet}
      <div class="app-toast__content">
        {#if title}<strong class="app-toast__title">{title}</strong>{/if}
        {#if message}<p class="app-toast__msg">{message}</p>{/if}
        {@render children?.()}
      </div>
    </Toast>
  </div>
{/if}

<style>
  .app-toast-wrap {
    width: min(100%, 380px);
  }

  :global(.app-toast-wrap > div) {
    display: grid !important;
    grid-template-columns: 4px minmax(0, 1fr) auto !important;
    gap: 12px !important;
    align-items: start !important;
    padding: 12px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: color-mix(in srgb, var(--color-surface), transparent 4%) !important;
    color: var(--color-text) !important;
    box-shadow: var(--shadow-md) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  :global(.app-toast__rail) {
    display: block;
    width: 4px;
    min-height: 100%;
    border-radius: 999px;
    background: var(--toast-accent);
  }

  :global(.app-toast__content) {
    min-width: 0;
    display: grid;
    gap: 2px;
    font-size: 0.85rem;
  }

  :global(.app-toast__title) {
    font-size: 0.84rem;
    color: var(--color-text);
    font-weight: 600;
  }

  :global(.app-toast__msg) {
    margin: 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .app-toast-wrap--neutral { --toast-accent: var(--color-text-muted); }
  .app-toast-wrap--success { --toast-accent: var(--color-success); }
  .app-toast-wrap--error   { --toast-accent: var(--color-danger); }
  .app-toast-wrap--warning { --toast-accent: var(--color-warning); }
  .app-toast-wrap--info    { --toast-accent: var(--color-info); }
</style>

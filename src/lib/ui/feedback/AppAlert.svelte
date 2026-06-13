<script lang="ts">
  import { Alert } from 'flowbite-svelte';
  import type { AppTone } from '$lib/ui/types';

  let {
    tone = 'info',
    title = '',
    dismissible = false,
    className = '',
    onclose,
    children
  }: {
    tone?: AppTone;
    title?: string;
    dismissible?: boolean;
    className?: string;
    onclose?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  type AlertColor = 'primary' | 'gray' | 'red' | 'yellow' | 'green';
  const colorMap: Record<AppTone, AlertColor> = {
    neutral: 'gray',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'primary'
  };

  let alertStatus = $state(true);

  $effect(() => {
    if (!alertStatus) onclose?.();
  });
</script>

<div class="app-alert-wrap app-alert-wrap--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'}>
  <Alert
    color={colorMap[tone]}
    dismissable={dismissible}
    bind:alertStatus
    closeAriaLabel="Dismiss alert"
    border
    rounded
  >
    {#if title}<strong class="app-alert__title block mb-1 text-sm font-semibold">{title}</strong>{/if}
    <span class="app-alert__body">{@render children?.()}</span>
  </Alert>
</div>

<style>
  .app-alert-wrap { width: 100%; }

  :global(.app-alert-wrap--info > div) {
    background: color-mix(in srgb, var(--color-info), transparent 90%) !important;
    border-color: color-mix(in srgb, var(--color-info), transparent 68%) !important;
    color: color-mix(in srgb, var(--color-info), var(--color-text) 28%) !important;
  }
  :global(.app-alert-wrap--success > div) {
    background: color-mix(in srgb, var(--color-success), transparent 90%) !important;
    border-color: color-mix(in srgb, var(--color-success), transparent 68%) !important;
    color: color-mix(in srgb, var(--color-success), var(--color-text) 32%) !important;
  }
  :global(.app-alert-wrap--error > div) {
    background: color-mix(in srgb, var(--color-danger), transparent 90%) !important;
    border-color: color-mix(in srgb, var(--color-danger), transparent 66%) !important;
    color: color-mix(in srgb, var(--color-danger), var(--color-text) 25%) !important;
  }
  :global(.app-alert-wrap--warning > div) {
    background: color-mix(in srgb, var(--color-warning), transparent 88%) !important;
    border-color: color-mix(in srgb, var(--color-warning), transparent 62%) !important;
    color: color-mix(in srgb, #92400e, var(--color-text) 18%) !important;
  }
  :global(.app-alert-wrap--neutral > div) {
    background: color-mix(in srgb, var(--color-surface), var(--color-text-muted) 6%) !important;
    border-color: var(--color-border) !important;
    color: var(--color-text) !important;
  }

  :global(.app-alert__body p) { margin: 0; }
  :global(.app-alert__body) { overflow-wrap: anywhere; font-size: 0.86rem; }
</style>

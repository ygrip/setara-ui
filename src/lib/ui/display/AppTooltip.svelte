<script lang="ts">
  import { Tooltip } from 'flowbite-svelte';

  let {
    text,
    position = 'top',
    children
  }: {
    text: string;
    position?: 'top' | 'right' | 'bottom' | 'left';
    children?: import('svelte').Snippet;
  } = $props();

  const uid = `tip-${Math.random().toString(36).slice(2, 8)}`;
</script>

<span id={uid} class="app-tooltip-trigger">
  {@render children?.()}
</span>
<Tooltip triggeredBy="#{uid}" placement={position} type="custom" class="app-tooltip">
  {text}
</Tooltip>

<style>
  .app-tooltip-trigger {
    display: inline-flex;
    min-width: 0;
  }

  :global(.app-tooltip) {
    padding: 7px 9px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: 6px !important;
    background: var(--color-text) !important;
    color: var(--color-bg) !important;
    box-shadow: var(--shadow-md) !important;
    font-size: 0.76rem !important;
    line-height: 1.35 !important;
    font-family: var(--font-body) !important;
    max-width: min(240px, calc(100vw - 32px)) !important;
    white-space: normal !important;
  }
</style>

<script lang="ts">
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

  const icons: Record<AppTone, string> = {
    neutral: '•',
    success: '✓',
    error: '!',
    warning: '!',
    info: 'i'
  };
</script>

<div class="app-alert app-alert--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'}>
  <span class="app-alert__icon" aria-hidden="true">{icons[tone]}</span>
  <div class="app-alert__content">
    {#if title}<strong>{title}</strong>{/if}
    <div class="app-alert__body">{@render children?.()}</div>
  </div>
  {#if dismissible}
    <button class="app-alert__close" type="button" aria-label="Dismiss alert" onclick={onclose}>×</button>
  {/if}
</div>

<style>
  .app-alert {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--alert-border);
    border-radius: var(--radius);
    background: var(--alert-bg);
    color: var(--alert-fg);
    box-shadow: 0 1px 0 rgb(0 0 0 / 0.02);
  }

  .app-alert__icon {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--alert-icon-bg);
    color: var(--alert-icon-fg);
    font-size: 0.72rem;
    font-weight: 800;
    line-height: 1;
  }

  .app-alert__content {
    min-width: 0;
    display: grid;
    gap: 3px;
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .app-alert__content strong {
    color: var(--alert-fg);
    font-size: 0.84rem;
  }

  .app-alert__body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .app-alert__body :global(p) {
    margin: 0;
  }

  .app-alert__close {
    border: 0;
    background: transparent;
    color: currentColor;
    cursor: pointer;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    line-height: 1;
    opacity: 0.72;
  }

  .app-alert__close:hover {
    background: color-mix(in srgb, currentColor, transparent 90%);
    opacity: 1;
  }

  .app-alert--neutral {
    --alert-bg: color-mix(in srgb, var(--color-surface), var(--color-text-muted) 6%);
    --alert-border: var(--color-border);
    --alert-fg: var(--color-text);
    --alert-icon-bg: color-mix(in srgb, var(--color-text-muted), transparent 82%);
    --alert-icon-fg: var(--color-text-muted);
  }

  .app-alert--success {
    --alert-bg: color-mix(in srgb, var(--color-success), transparent 90%);
    --alert-border: color-mix(in srgb, var(--color-success), transparent 68%);
    --alert-fg: color-mix(in srgb, var(--color-success), var(--color-text) 32%);
    --alert-icon-bg: color-mix(in srgb, var(--color-success), transparent 78%);
    --alert-icon-fg: var(--color-success);
  }

  .app-alert--error {
    --alert-bg: color-mix(in srgb, var(--color-danger), transparent 90%);
    --alert-border: color-mix(in srgb, var(--color-danger), transparent 66%);
    --alert-fg: color-mix(in srgb, var(--color-danger), var(--color-text) 25%);
    --alert-icon-bg: color-mix(in srgb, var(--color-danger), transparent 78%);
    --alert-icon-fg: var(--color-danger);
  }

  .app-alert--warning {
    --alert-bg: color-mix(in srgb, var(--color-warning), transparent 88%);
    --alert-border: color-mix(in srgb, var(--color-warning), transparent 62%);
    --alert-fg: color-mix(in srgb, #92400e, var(--color-text) 18%);
    --alert-icon-bg: color-mix(in srgb, var(--color-warning), transparent 74%);
    --alert-icon-fg: #92400e;
  }

  .app-alert--info {
    --alert-bg: color-mix(in srgb, var(--color-info), transparent 90%);
    --alert-border: color-mix(in srgb, var(--color-info), transparent 68%);
    --alert-fg: color-mix(in srgb, var(--color-info), var(--color-text) 28%);
    --alert-icon-bg: color-mix(in srgb, var(--color-info), transparent 78%);
    --alert-icon-fg: var(--color-info);
  }

  @media (max-width: 520px) {
    .app-alert { padding: 11px 12px; }
  }
</style>


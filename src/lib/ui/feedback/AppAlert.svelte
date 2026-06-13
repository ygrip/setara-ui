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

  const iconMap: Record<AppTone, string> = {
    neutral: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    success: '<path d="M20 6 9 17l-5-5"/>',
    error: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    warning: '<path d="m21.7 18.5-8.4-15a1.5 1.5 0 0 0-2.6 0l-8.4 15A1.5 1.5 0 0 0 3.6 21h16.8a1.5 1.5 0 0 0 1.3-2.5Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  let visible = $state(true);

  function close() {
    visible = false;
    onclose?.();
  }
</script>

{#if visible}
  <div class="app-alert app-alert--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'}>
    <span class="app-alert__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {@html iconMap[tone]}
      </svg>
    </span>
    <span class="app-alert__content">
      {#if title}<strong class="app-alert__title">{title}</strong>{/if}
      <span class="app-alert__body">{@render children?.()}</span>
    </span>
    {#if dismissible}
      <button class="app-alert__close" type="button" onclick={close} aria-label="Dismiss alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .app-alert {
    --alert-accent: var(--color-info);
    width: 100%;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    border: 1px solid color-mix(in srgb, var(--alert-accent), transparent 66%);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--alert-accent), transparent 90%);
    color: color-mix(in srgb, var(--alert-accent), var(--color-text) 28%);
    padding: 12px 14px;
  }

  .app-alert--neutral { --alert-accent: var(--color-text-muted); }
  .app-alert--success { --alert-accent: var(--color-success); }
  .app-alert--error { --alert-accent: var(--color-danger); }
  .app-alert--warning { --alert-accent: var(--color-warning); color: color-mix(in srgb, #92400e, var(--color-text) 18%); }
  .app-alert--info { --alert-accent: var(--color-info); }

  .app-alert__icon {
    display: inline-flex;
    width: 20px;
    height: 20px;
    color: var(--alert-accent);
  }

  .app-alert__icon svg,
  .app-alert__close svg {
    width: 100%;
    height: 100%;
  }

  .app-alert__content {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .app-alert__title {
    color: var(--color-text);
    font-size: 0.86rem;
    font-weight: 700;
  }

  .app-alert__body {
    overflow-wrap: anywhere;
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .app-alert__close {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: currentColor;
    cursor: pointer;
    opacity: 0.72;
  }

  .app-alert__close:hover {
    background: color-mix(in srgb, currentColor, transparent 88%);
    opacity: 1;
  }

  :global(.app-alert__body p) { margin: 0; }
</style>

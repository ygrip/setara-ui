<script lang="ts">
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

  const iconMap: Record<AppTone, string> = {
    neutral: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    success: '<path d="M20 6 9 17l-5-5"/>',
    error: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    warning: '<path d="m21.7 18.5-8.4-15a1.5 1.5 0 0 0-2.6 0l-8.4 15A1.5 1.5 0 0 0 3.6 21h16.8a1.5 1.5 0 0 0 1.3-2.5Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  let toastStatus = $state(false);

  function close() {
    toastStatus = false;
    onclose?.();
  }

  $effect(() => { toastStatus = open; });
</script>

{#if toastStatus}
  <div class="app-toast app-toast--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
    <span class="app-toast__rail" aria-hidden="true"></span>
    <span class="app-toast__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {@html iconMap[tone]}
      </svg>
    </span>
    <div class="app-toast__content">
      {#if title}<strong class="app-toast__title">{title}</strong>{/if}
      {#if message}<p class="app-toast__msg">{message}</p>{/if}
      {@render children?.()}
    </div>
    <button class="app-toast__close" type="button" onclick={close} aria-label="Dismiss notification">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .app-toast {
    --toast-accent: var(--color-info);
    width: min(100%, 380px);
    display: grid;
    grid-template-columns: 4px 20px minmax(0, 1fr) 24px;
    gap: 12px;
    align-items: start;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-surface), transparent 4%);
    color: var(--color-text);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .app-toast__rail {
    display: block;
    width: 4px;
    min-height: 100%;
    border-radius: 999px;
    background: var(--toast-accent);
  }

  .app-toast__icon {
    display: inline-flex;
    width: 20px;
    height: 20px;
    color: var(--toast-accent);
  }

  .app-toast__icon svg,
  .app-toast__close svg {
    width: 100%;
    height: 100%;
  }

  .app-toast__content {
    min-width: 0;
    display: grid;
    gap: 2px;
    font-size: 0.85rem;
  }

  .app-toast__title {
    font-size: 0.84rem;
    color: var(--color-text);
    font-weight: 600;
  }

  .app-toast__msg {
    margin: 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .app-toast__close {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .app-toast__close:hover {
    background: var(--color-accent-subtle);
    color: var(--color-text);
  }

  .app-toast--neutral { --toast-accent: var(--color-text-muted); }
  .app-toast--success { --toast-accent: var(--color-success); }
  .app-toast--error   { --toast-accent: var(--color-danger); }
  .app-toast--warning { --toast-accent: var(--color-warning); }
  .app-toast--info    { --toast-accent: var(--color-info); }
</style>

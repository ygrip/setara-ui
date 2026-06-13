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
</script>

{#if open}
  <div class="app-toast app-toast--{tone} {className}" role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
    <span class="app-toast__rail" aria-hidden="true"></span>
    <div class="app-toast__content">
      {#if title}<strong>{title}</strong>{/if}
      {#if message}<p>{message}</p>{/if}
      {@render children?.()}
    </div>
    {#if onclose}
      <button class="app-toast__close" type="button" aria-label="Dismiss notification" onclick={onclose}>×</button>
    {/if}
  </div>
{/if}

<style>
  .app-toast {
    display: grid;
    grid-template-columns: 4px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    width: min(100%, 380px);
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
    width: 4px;
    min-height: 100%;
    border-radius: 999px;
    background: var(--toast-accent);
  }

  .app-toast__content {
    min-width: 0;
    display: grid;
    gap: 2px;
    font-size: 0.85rem;
  }

  .app-toast__content strong {
    font-size: 0.84rem;
    color: var(--color-text);
  }

  .app-toast__content p {
    margin: 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .app-toast__close {
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    line-height: 1;
  }

  .app-toast__close:hover {
    background: var(--color-accent-subtle);
    color: var(--color-text);
  }

  .app-toast--neutral { --toast-accent: var(--color-text-muted); }
  .app-toast--success { --toast-accent: var(--color-success); }
  .app-toast--error { --toast-accent: var(--color-danger); }
  .app-toast--warning { --toast-accent: var(--color-warning); }
  .app-toast--info { --toast-accent: var(--color-info); }
</style>


<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';

  let {
    label,
    status,
    variant = 'neutral',
    detail = '',
    href = '',
    ariaLabel = '',
    children
  }: {
    label: string;
    status: string;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    detail?: string;
    href?: string;
    ariaLabel?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#snippet content()}
  <div class="status-strip"></div>
  <div class="status-body">
    <span class="status-label">{label}</span>
    <div class="status-main">
      <Badge text={status} {variant} />
    </div>
    {#if detail}
      <span class="status-detail">{detail}</span>
    {/if}
    {@render children?.()}
  </div>
{/snippet}

{#if href}
  <a class="status-card surface-card status-card--{variant} status-card--link" {href} aria-label={ariaLabel || `${label}: ${status}`}>
    {@render content()}
  </a>
{:else}
  <div class="status-card surface-card status-card--{variant}">
    {@render content()}
  </div>
{/if}

<style>
  .status-card {
    display: flex;
    height: 100%;
    min-height: 116px;
    min-width: 140px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--surface-card-border, var(--color-border)), var(--status-color) 6%);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: var(--shadow);
    color: inherit;
    text-decoration: none;
    transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease;
  }

  .status-card--link:hover {
    border-color: color-mix(in srgb, var(--color-accent), transparent 34%);
    box-shadow: var(--shadow-md);
    text-decoration: none;
    transform: translateY(-1px);
  }

  .status-card--link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  .status-strip {
    width: 3px;
    flex: 0 0 auto;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--status-color), white 24%),
      var(--status-color) 52%,
      color-mix(in srgb, var(--status-color), transparent 72%));
    box-shadow: 2px 0 10px color-mix(in srgb, var(--status-color), transparent 78%);
  }

  .status-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    padding: 16px;
  }

  .status-label {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .status-main {
    display: flex;
    min-width: 0;
    align-items: center;
  }

  .status-detail {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .status-card--neutral { --status-color: var(--color-text-muted); }
  .status-card--success { --status-color: var(--color-success); }
  .status-card--danger { --status-color: var(--color-danger); }
  .status-card--warning { --status-color: var(--color-warning); }
  .status-card--info { --status-color: var(--color-info); }

  @media (max-width: 520px) {
    .status-card {
      min-height: 112px;
    }

    .status-body {
      padding: 14px;
    }
  }
</style>

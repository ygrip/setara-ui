<script lang="ts">
  let {
    label,
    value,
    sub = '',
    variant = 'default',
    icon = '',
    href = '',
    ariaLabel = ''
  }: {
    label: string;
    value: string | number;
    sub?: string;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
    icon?: string;
    href?: string;
    ariaLabel?: string;
  } = $props();

  const body = $derived({
    label,
    value,
    sub,
    icon
  });
</script>

{#snippet content()}
  <div class="metric-strip"></div>
  <div class="metric-body">
    <div class="metric-top">
      <span class="metric-label">{body.label}</span>
      {#if body.icon}
        <svg class="metric-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={body.icon}/>
        </svg>
      {/if}
    </div>
    <span class="metric-value">{body.value}</span>
    {#if body.sub}
      <span class="metric-sub">{body.sub}</span>
    {/if}
  </div>
{/snippet}

{#if href}
  <a class="metric-card metric-card--{variant} metric-card--link" {href} aria-label={ariaLabel || `${label}: ${value}`}>
    {@render content()}
  </a>
{:else}
  <div class="metric-card metric-card--{variant}">
    {@render content()}
  </div>
{/if}

<style>
  .metric-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: flex;
    height: 100%;
    overflow: hidden;
    min-width: 140px;
    min-height: 116px;
    color: inherit;
    text-decoration: none;
    transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease, background 0.16s ease;
  }

  .metric-card--link {
    cursor: pointer;
  }

  .metric-card--link:hover {
    border-color: color-mix(in srgb, var(--color-accent), transparent 34%);
    box-shadow: var(--shadow-md);
    text-decoration: none;
    transform: translateY(-1px);
  }

  .metric-card--link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  .metric-strip {
    width: 4px;
    flex-shrink: 0;
    background: var(--strip-color, var(--color-text-muted));
  }

  .metric-card--default .metric-strip { background: var(--color-text-muted); }
  .metric-card--success .metric-strip { background: var(--color-success); }
  .metric-card--danger .metric-strip { background: var(--color-danger); }
  .metric-card--warning .metric-strip { background: var(--color-warning); }
  .metric-card--info .metric-strip { background: var(--color-info); }

  .metric-body {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    min-width: 0;
    justify-content: space-between;
  }

  .metric-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .metric-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  .metric-icon {
    color: var(--color-text-muted);
    opacity: 0.5;
    flex-shrink: 0;
  }

  .metric-value {
    font-size: clamp(1.35rem, 3vw, 1.65rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--value-color, var(--color-text));
    overflow-wrap: anywhere;
  }

  .metric-card--success .metric-value { color: var(--color-success); }
  .metric-card--danger .metric-value { color: var(--color-danger); }
  .metric-card--warning .metric-value { color: var(--color-warning); }
  .metric-card--info .metric-value { color: var(--color-info); }

  .metric-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.35;
  }

  @media (max-width: 520px) {
    .metric-card {
      min-height: 112px;
    }

    .metric-body {
      padding: 14px;
    }
  }
</style>

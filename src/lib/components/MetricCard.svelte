<script lang="ts">
  let {
    label,
    value,
    sub = '',
    variant = 'default',
    icon = ''
  }: {
    label: string;
    value: string | number;
    sub?: string;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
    icon?: string;
  } = $props();
</script>

<div class="metric-card metric-card--{variant}">
  <div class="metric-strip"></div>
  <div class="metric-body">
    <div class="metric-top">
      <span class="metric-label">{label}</span>
      {#if icon}
        <svg class="metric-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={icon}/>
        </svg>
      {/if}
    </div>
    <span class="metric-value">{value}</span>
    {#if sub}
      <span class="metric-sub">{sub}</span>
    {/if}
  </div>
</div>

<style>
  .metric-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: flex;
    overflow: hidden;
    min-width: 140px;
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
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    min-width: 0;
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
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    color: var(--value-color, var(--color-text));
  }

  .metric-card--success .metric-value { color: var(--color-success); }
  .metric-card--danger .metric-value { color: var(--color-danger); }
  .metric-card--warning .metric-value { color: var(--color-warning); }
  .metric-card--info .metric-value { color: var(--color-info); }

  .metric-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>

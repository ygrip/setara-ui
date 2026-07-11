<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sparkline from './Sparkline.svelte';

  type MetricTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'other';
  type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

  type IconFrame = {
    size?: string;
    padding?: string;
    border?: string;
    radius?: string;
    background?: string;
    color?: string;
  };
  
  let {
    label,
    value,
    suffix = '',
    sub = '',
    secondaryValue = '',
    variant = 'default',
    icon = '',
    iconSvg = '',
    iconFrame = {
      size: '32px',
      padding: '4px',
      border: '1px solid var(--color-border)',
      radius: 'var(--radius)',
      background: 'var(--color-surface)',
      color: 'var(--color-text-muted)'
    },
    children,
    href = '',
    ariaLabel = '',
    statusLabel = '',
    statusTone = 'neutral',
    deltaLabel = '',
    deltaDirection = 'unknown',
    deltaPositive = undefined,
    progressValue = undefined,
    sparklineValues = [],
    actionLabel = '',
    helpText = '',
    onclick = undefined
  }: {
    label: string;
    value: string | number;
    suffix?: string;
    sub?: string;
    secondaryValue?: string;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'other';
    icon?: string;
    iconSvg?: string;
    /**
     * Optional frame styling around the icon.
     */
    iconFrame?: IconFrame;
    /**
     * Svelte 5 children snippet.
     */
    children?: Snippet;
    href?: string;
    ariaLabel?: string;
    statusLabel?: string;
    statusTone?: MetricTone;
    deltaLabel?: string;
    deltaDirection?: TrendDirection;
    deltaPositive?: boolean;
    progressValue?: number;
    sparklineValues?: number[];
    actionLabel?: string;
    helpText?: string;
    onclick?: () => void;
  } = $props();

  const normalizedProgress = $derived(
    progressValue === undefined ? undefined : Math.max(0, Math.min(progressValue, 100))
  );
  const resolvedSecondary = $derived(secondaryValue || sub);
  const deltaOutcome = $derived.by(() => {
    if (deltaDirection === 'flat' || deltaDirection === 'unknown') return 'neutral';
    if (deltaPositive !== undefined) return deltaPositive ? 'positive' : 'negative';
    return deltaDirection === 'up' ? 'positive' : 'negative';
  });
  const deltaSymbol = $derived.by(() => {
    if (deltaDirection === 'up') return '↑';
    if (deltaDirection === 'down') return '↓';
    if (deltaDirection === 'flat') return '→';
    return '•';
  });

  const body = $derived({
    label,
    value,
    suffix,
    icon,
    iconSvg,
    iconFrame
  });
</script>

{#snippet content()}
  <div class="metric-strip"></div>
  <div class="metric-body">
    <div class="metric-top">
      <div class="metric-heading">
        <span class="metric-label">{body.label}</span>
        {#if helpText}
          <span class="metric-help" role="img" aria-label={helpText} title={helpText}>i</span>
        {/if}
        {#if statusLabel}
          <span class="metric-badge metric-badge--{statusTone}">{statusLabel}</span>
        {/if}
      </div>
      {#if body.iconSvg}
         <span
          class="metric-icon-frame"
          style="
            --metric-icon-frame-size: {body.iconFrame?.size ?? '28px'};
            --metric-icon-frame-padding: {body.iconFrame?.padding ?? '5px'};
            --metric-icon-frame-border: {body.iconFrame?.border ?? 'none'};
            --metric-icon-frame-radius: {body.iconFrame?.radius ?? '8px'};
            --metric-icon-frame-bg: {body.iconFrame?.background ?? 'transparent'};
            --metric-icon-frame-color: {body.iconFrame?.color ?? 'currentColor'};
          "
          aria-hidden="true"
        >
          {@html body.iconSvg}
        </span>
      {:else if body.icon}
        <svg
          class="metric-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d={body.icon} />
        </svg>
      {/if}
    </div>
    <div class="metric-value-row">
      <span class="metric-value">{body.value}</span>
      {#if body.suffix}<span class="metric-value metric-suffix">{body.suffix}</span>{/if}
    </div>
    {#if resolvedSecondary}
      <span class="metric-sub">{resolvedSecondary}</span>
    {/if}

    {#if deltaLabel}
      <span class="metric-delta metric-delta--{deltaOutcome}">
        <span aria-hidden="true">{deltaSymbol}</span>
        {deltaLabel}
      </span>
    {/if}

    {#if normalizedProgress !== undefined}
      <div
        class="metric-progress"
        role="progressbar"
        aria-label="{label} progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(normalizedProgress)}
      >
        <span style="width: {normalizedProgress}%"></span>
      </div>
    {/if}

    {#if sparklineValues.length > 1}
      <span class="metric-sparkline-wrap">
        <Sparkline values={sparklineValues} />
      </span>
    {/if}

    {#if children}
    <div class="metric-card__children">
      {@render children()}
    </div>
    {/if}

    {#if actionLabel && href}
      <span class="metric-action">{actionLabel}<span aria-hidden="true">→</span></span>
    {/if}
  </div>
{/snippet}

{#if href}
  <a class="metric-card surface-card metric-card--{variant} metric-card--link" {href} aria-label={ariaLabel || `${label}: ${value}`}>
    {@render content()}
  </a>
{:else if onclick}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="metric-card surface-card metric-card--{variant} metric-card--link"
    role="button"
    tabindex="0"
    {onclick}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick(); } }}
    aria-label={ariaLabel || `${label}: ${value}`}
  >
    {@render content()}
  </div>
{:else}
  <div class="metric-card surface-card metric-card--{variant}">
    {@render content()}
  </div>
{/if}

<style>
  .metric-card {
    background: var(--surface-card-bg, var(--color-surface));
    border: 1px solid var(--surface-card-border, var(--color-border));
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: flex;
    height: 100%;
    overflow: hidden;
    min-width: 140px;
    min-height: 116px;
    color: inherit;
    text-decoration: none;
    position: relative;
    overflow: hidden;
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
    width: 3px;
    flex-shrink: 0;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--metric-accent), white 24%),
      var(--metric-accent) 52%,
      color-mix(in srgb, var(--metric-accent), transparent 72%));
    box-shadow: 2px 0 10px color-mix(in srgb, var(--metric-accent), transparent 78%);
  }

  .metric-card--default { --metric-accent: var(--color-accent); }
  .metric-card--success { --metric-accent: var(--color-success); }
  .metric-card--danger { --metric-accent: var(--color-danger); }
  .metric-card--warning { --metric-accent: var(--color-warning); }
  .metric-card--info { --metric-accent: var(--color-info); }
  .metric-card--other { --metric-accent: var(--color-status-manual); }

  .metric-body {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
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

  .metric-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .metric-help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1px solid color-mix(in srgb, var(--color-text-muted), transparent 55%);
    border-radius: 50%;
    color: var(--color-text-muted);
    font-size: 0.61rem;
    font-weight: 800;
    cursor: help;
  }

  .metric-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 0.66rem;
    font-weight: 750;
    line-height: 1.2;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-border), transparent 62%);
  }

  .metric-badge--success { color: var(--color-success); background: color-mix(in srgb, var(--color-success), transparent 87%); }
  .metric-badge--danger { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger), transparent 87%); }
  .metric-badge--warning { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning), transparent 87%); }
  .metric-badge--info { color: var(--color-info); background: color-mix(in srgb, var(--color-info), transparent 87%); }
  .metric-badge--other { color: var(--color-status-manual); background: color-mix(in srgb, var(--color-status-manual), transparent 87%); }

.metric-icon-frame {
  width: var(--metric-icon-frame-size);
  height: var(--metric-icon-frame-size);
  padding: var(--metric-icon-frame-padding);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;

  border: var(--metric-icon-frame-border);
  border-radius: var(--metric-icon-frame-radius);
  background: var(--metric-icon-frame-bg);
  color: var(--metric-icon-frame-color);

  box-sizing: border-box;
}

.metric-icon {
  width: 100%;
  height: 100%;
  display: block;
  flex: 0 0 auto;
  color: var(--color-text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}

.metric-icon--custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.metric-icon--custom :global(svg),
.metric-icon-frame :global(svg) {
  width: 100%;
  height: 100%;
  display: block;
  color: inherit;
}

  .metric-value-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-top: 4px;
  }

  .metric-value {
    font-size: clamp(1.35rem, 3vw, 1.65rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--value-color, var(--color-text));
    overflow-wrap: anywhere;
  }

  .metric-suffix {
    font-size: 0.78rem;
    font-weight: 650;
  }

  .metric-card--success .metric-value { color: var(--color-success); }
  .metric-card--danger .metric-value { color: var(--color-danger); }
  .metric-card--warning .metric-value { color: var(--color-warning); }
  .metric-card--info .metric-value { color: var(--color-info); }
  .metric-card--other .metric-value { color: var(--color-status-manual); }

  .metric-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.35;
  }

  .metric-delta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: fit-content;
    font-size: 0.72rem;
    font-weight: 650;
    line-height: 1.35;
  }

  .metric-delta--positive { color: var(--color-success); }
  .metric-delta--negative { color: var(--color-danger); }
  .metric-delta--neutral { color: var(--color-text-muted); }

  .metric-progress {
    height: 6px;
    margin-top: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border), transparent 55%);
  }

  .metric-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--metric-accent), color-mix(in srgb, var(--metric-accent), white 24%));
  }

  .metric-sparkline-wrap {
    display: block;
    color: var(--metric-accent);
  }

  .metric-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: auto;
    padding-top: 5px;
    color: var(--metric-accent);
    font-size: 0.72rem;
    font-weight: 700;
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

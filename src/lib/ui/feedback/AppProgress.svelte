<script lang="ts">
  import type { AppTone } from '$lib/ui/types';

  let {
    value = 0,
    max = 100,
    label = '',
    tone = 'info',
    indeterminate = false,
    showValue = false
  }: {
    value?: number;
    max?: number;
    label?: string;
    tone?: AppTone;
    indeterminate?: boolean;
    showValue?: boolean;
  } = $props();

  let percentage = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div class="app-progress app-progress--{tone}" role="progressbar" aria-label={label || 'Progress'} aria-valuemin="0" aria-valuemax={max} aria-valuenow={indeterminate ? undefined : value}>
  {#if label || showValue}
    <div class="app-progress__meta">
      {#if label}<span>{label}</span>{/if}
      {#if showValue && !indeterminate}<strong>{Math.round(percentage)}%</strong>{/if}
    </div>
  {/if}
  <div class="app-progress__track" class:app-progress__track--indeterminate={indeterminate}>
    <span style={indeterminate ? undefined : `width:${percentage}%`}></span>
  </div>
</div>

<style>
  .app-progress {
    display: grid;
    gap: 7px;
    width: 100%;
    --progress-accent: var(--color-info);
  }

  .app-progress__meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 700;
  }

  .app-progress__meta strong {
    color: var(--color-text);
  }

  .app-progress__track {
    position: relative;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--progress-accent), transparent 86%);
  }

  .app-progress__track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--progress-accent);
    transition: width 0.18s ease;
  }

  .app-progress__track--indeterminate span {
    position: absolute;
    width: 38%;
    animation: progress-slide 1.15s ease-in-out infinite;
  }

  .app-progress--neutral { --progress-accent: var(--color-text-muted); }
  .app-progress--success { --progress-accent: var(--color-success); }
  .app-progress--error { --progress-accent: var(--color-danger); }
  .app-progress--warning { --progress-accent: var(--color-warning); }
  .app-progress--info { --progress-accent: var(--color-info); }

  @keyframes progress-slide {
    from { transform: translateX(-110%); }
    to { transform: translateX(270%); }
  }
</style>


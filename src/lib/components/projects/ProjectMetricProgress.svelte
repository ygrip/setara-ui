<script lang="ts">
  let {
    label,
    value
  }: {
    label: string;
    value: number | null;
  } = $props();

  const boundedValue = $derived(value == null ? null : Math.min(100, Math.max(0, value)));
</script>

{#if boundedValue == null}
  <span class="metric-unavailable">Not available</span>
{:else}
  <div
    class="metric-progress"
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={boundedValue}
  >
    <span style={`width: ${boundedValue}%`}></span>
  </div>
{/if}

<style>
  .metric-progress {
    height: 0.34rem;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border), transparent 38%);
  }

  .metric-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--project-accent, var(--color-accent));
  }

  .metric-unavailable {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }
</style>

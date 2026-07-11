<script lang="ts">
  let {
    value,
    label
  }: {
    value: number;
    label: string;
  } = $props();

  const normalized = $derived(Math.max(0, Math.min(value, 100)));
</script>

<div class="inline-progress">
  <span class="inline-value">{Math.round(normalized)}%</span>
  <span
    class="inline-track"
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(normalized)}
  >
    <span class="inline-fill" style="width: {normalized}%"></span>
  </span>
</div>

<style>
  .inline-progress {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .inline-value {
    min-width: 38px;
    color: var(--color-text);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .inline-track {
    display: block;
    width: 82px;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border), transparent 50%);
  }

  .inline-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-accent), var(--color-success));
  }
</style>

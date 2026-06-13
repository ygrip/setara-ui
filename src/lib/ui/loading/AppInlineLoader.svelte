<script lang="ts">
  import AppSpinner from './AppSpinner.svelte';

  let {
    label = 'Loading',
    size = 22
  }: {
    label?: string;
    size?: number;
  } = $props();
</script>

<span class="app-inline-loader" role="status" aria-live="polite">
  <AppSpinner {size} {label} />
  <span>{label}</span>
</span>

<style>
  .app-inline-loader {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    font-weight: 700;
  }
</style>


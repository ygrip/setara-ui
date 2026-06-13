<script lang="ts">
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import AppProgress from '$lib/ui/feedback/AppProgress.svelte';

  let {
    status,
    processedRows = 0,
    totalRows = 0
  }: {
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
    processedRows?: number;
    totalRows?: number;
  } = $props();
</script>

<div class="import-progress-panel">
  <AppAlert tone={status === 'FAILED' ? 'error' : status === 'COMPLETED' ? 'success' : 'info'} title={`Import ${status.toLowerCase()}`}>
    {processedRows} / {totalRows} rows processed
  </AppAlert>
  {#if totalRows > 0}
    <AppProgress value={processedRows} max={totalRows} tone={status === 'FAILED' ? 'error' : 'info'} showValue />
  {/if}
</div>

<style>
  .import-progress-panel {
    display: grid;
    gap: 12px;
  }
</style>


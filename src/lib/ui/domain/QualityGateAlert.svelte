<script lang="ts">
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let {
    status,
    reasons = []
  }: {
    status: 'PASSED' | 'FAILED' | 'WARNING' | 'PENDING' | 'READY' | 'AT_RISK' | 'NOT_READY' | 'UNKNOWN';
    reasons?: string[];
  } = $props();

  const config = $derived((() => {
    switch (status) {
      case 'PASSED':
      case 'READY':
        return { tone: 'success' as const, title: 'Quality gate passed' };
      case 'FAILED':
      case 'NOT_READY':
        return { tone: 'error' as const, title: 'Quality gate failed' };
      case 'WARNING':
      case 'AT_RISK':
        return { tone: 'warning' as const, title: 'Quality gate at risk' };
      default:
        return { tone: 'info' as const, title: 'Quality gate pending' };
    }
  })());
</script>

<AppAlert tone={config.tone} title={config.title}>
  {#if reasons.length > 0}
    <ul class="quality-reasons">
      {#each reasons as reason}
        <li>{reason}</li>
      {/each}
    </ul>
  {:else}
    <span>Status: {status.replace(/_/g, ' ')}</span>
  {/if}
</AppAlert>

<style>
  .quality-reasons {
    margin: 0;
    padding-left: 18px;
  }
</style>


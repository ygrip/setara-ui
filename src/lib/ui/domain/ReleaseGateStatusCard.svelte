<script lang="ts">
  import StatusCard from '$lib/components/StatusCard.svelte';
  import { scenarioStatusTone, statusLabel } from './status';

  let {
    status,
    detail = ''
  }: {
    status: string | null | undefined;
    detail?: string;
  } = $props();

  const tone = $derived(scenarioStatusTone(status));
  const cardVariant = $derived(tone === 'error' ? 'danger' : tone);
</script>

<StatusCard label="Release readiness" status={statusLabel(status)} variant={cardVariant} {detail} />

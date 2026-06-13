<script lang="ts">
  import AppBadge from '$lib/ui/display/AppBadge.svelte';
  import { scenarioStatusTone, statusLabel } from './status';

  let {
    status,
    label = ''
  }: {
    status: string | null | undefined;
    label?: string;
  } = $props();
</script>

<AppBadge text={label || statusLabel(status)} tone={scenarioStatusTone(status)} />


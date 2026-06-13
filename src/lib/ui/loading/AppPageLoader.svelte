<script lang="ts">
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';

  let {
    active = true,
    label = 'Loading',
    delay = false
  }: {
    active?: boolean;
    label?: string;
    delay?: boolean;
  } = $props();
</script>

<LoadingOverlay {active} {label} {delay} />


<script lang="ts">
  import { navigating } from '$app/state';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import '../styles.css';

  let { children } = $props();

  const routeLoading = $derived(!!navigating.to);
</script>

{@render children()}
<LoadingOverlay active={routeLoading} label="Loading page" delay />

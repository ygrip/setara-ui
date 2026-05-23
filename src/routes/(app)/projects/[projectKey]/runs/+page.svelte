<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  onMount(() => {
    goto(`/projects/${page.params.projectKey}/executions`, { replaceState: true });
  });
</script>

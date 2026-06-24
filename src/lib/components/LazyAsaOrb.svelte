<script lang="ts">
  import { onMount } from 'svelte';
  let Orb = $state<typeof import('./AsaOrb.svelte').default | null>(null);
  onMount(async () => {
    const mod = await import('./AsaOrb.svelte');
    Orb = mod.default;
  });
</script>

{#if Orb}
  <Orb />
{/if}

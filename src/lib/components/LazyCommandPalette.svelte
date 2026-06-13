<script lang="ts">
  import { onMount } from 'svelte';

  let {
    open,
    onclose
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  let CommandPaletteComponent = $state<any>(null);
  let loading = false;

  async function loadPalette() {
    if (CommandPaletteComponent || loading) return;
    loading = true;
    try {
      CommandPaletteComponent = (await import('$lib/components/CommandPalette.svelte')).default;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (open) void loadPalette();
  });

  $effect(() => {
    if (open) void loadPalette();
  });
</script>

{#if open && CommandPaletteComponent}
  <CommandPaletteComponent {open} {onclose} />
{/if}

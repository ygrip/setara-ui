<script lang="ts">
  import SetaraLoader from '$lib/components/SetaraLoader.svelte';

  let {
    size = 28,
    label = 'Loading',
    mode = 'progress'
  }: {
    size?: number;
    label?: string;
    mode?: 'progress' | 'orbit';
  } = $props();
</script>

<SetaraLoader {size} {label} {mode} />


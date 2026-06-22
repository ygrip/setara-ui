<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import type { Snippet } from 'svelte';

  let {
    open = false,
    title,
    size = 'md',
    onclose,
    children
  }: {
    open?: boolean;
    title: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    onclose?: () => void;
    children?: Snippet;
  } = $props();
</script>

<Modal {open} {title} {size} {onclose}>
  {@render children?.()}
</Modal>

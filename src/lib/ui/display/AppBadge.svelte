<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import type { AppTone } from '$lib/ui/types';

  let {
    text,
    tone = 'neutral',
    title = ''
  }: {
    text: string;
    tone?: AppTone;
    title?: string;
  } = $props();

  const variantByTone = {
    neutral: 'neutral',
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'info'
  } as const;
</script>

<span {title}>
  <Badge {text} variant={variantByTone[tone]} />
</span>


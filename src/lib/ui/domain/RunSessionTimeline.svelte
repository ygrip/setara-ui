<script lang="ts">
  import AppTimeline, { type AppTimelineItem } from '$lib/ui/navigation/AppTimeline.svelte';

  export type RunSessionEvent = {
    id?: string;
    type: string;
    message?: string | null;
    status?: string | null;
    occurredAt: string;
  };

  let {
    events
  }: {
    events: RunSessionEvent[];
  } = $props();

  const items = $derived(events.map((event) => ({
    id: event.id ?? `${event.type}-${event.occurredAt}`,
    title: event.type.replace(/_/g, ' '),
    detail: event.message ?? event.status ?? 'Execution update',
    meta: new Date(event.occurredAt).toLocaleString(),
    tone: event.status === 'FAILED' ? 'error' : event.status === 'PASSED' ? 'success' : 'info'
  } satisfies AppTimelineItem)));
</script>

<AppTimeline {items} />


<script lang="ts">
  import { AppBadge } from '$lib/ui/display';
  import type { AppTone } from '$lib/ui/types';
  import type { QualityHealthStatus } from '$lib/api/dashboard';

  let { status }: { status: QualityHealthStatus } = $props();

  const presentation = $derived.by((): { text: string; tone: AppTone } => {
    if (status === 'HEALTHY') return { text: 'Healthy', tone: 'success' };
    if (status === 'NEEDS_REVIEW') return { text: 'Needs review', tone: 'warning' };
    if (status === 'HIGH_RISK') return { text: 'High risk', tone: 'error' };
    if (status === 'CRITICAL') return { text: 'Critical', tone: 'error' };
    if (status === 'NO_RUNS') return { text: 'No runs', tone: 'neutral' };
    return { text: 'Neutral', tone: 'neutral' };
  });
</script>

<AppBadge text={presentation.text} tone={presentation.tone} />

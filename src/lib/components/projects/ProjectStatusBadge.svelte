<script lang="ts">
  import { AppBadge } from '$lib/ui/display';
  import type { AppTone } from '$lib/ui/types';
  import type { ProjectHealthStatus } from '$lib/api/projects';

  let { status }: { status: ProjectHealthStatus } = $props();

  const presentation = $derived.by((): { text: string; tone: AppTone; icon: string } => {
    if (status === 'HEALTHY') return { text: 'Healthy', tone: 'success', icon: '✓' };
    if (status === 'NEEDS_REVIEW') return { text: 'Needs review', tone: 'warning', icon: '!' };
    if (status === 'HIGH_RISK') return { text: 'High risk', tone: 'error', icon: '↑' };
    if (status === 'CRITICAL') return { text: 'Critical', tone: 'error', icon: '×' };
    return { text: 'No runs', tone: 'neutral', icon: '○' };
  });
</script>

<span class="status-badge" data-status={status}>
  <span class="status-icon" aria-hidden="true">{presentation.icon}</span>
  <AppBadge text={presentation.text} tone={presentation.tone} />
</span>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }

  .status-icon {
    display: grid;
    width: 1.1rem;
    height: 1.1rem;
    place-items: center;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 800;
  }

  [data-status='HEALTHY'] .status-icon { color: var(--color-success); }
  [data-status='NEEDS_REVIEW'] .status-icon { color: var(--color-warning); }
  [data-status='HIGH_RISK'] .status-icon,
  [data-status='CRITICAL'] .status-icon { color: var(--color-danger); }
</style>

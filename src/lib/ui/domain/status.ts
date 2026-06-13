import type { AppTone } from '$lib/ui/types';

export type SetaraStatusTone = AppTone;

export function scenarioStatusTone(status: string | null | undefined): SetaraStatusTone {
  switch (status?.toUpperCase()) {
    case 'PASSED':
    case 'ACTIVE':
    case 'VERIFIED':
    case 'COMPLETED':
    case 'READY':
      return 'success';
    case 'FAILED':
    case 'NOT_READY':
      return 'error';
    case 'BLOCKED':
    case 'SKIPPED':
    case 'AT_RISK':
    case 'WARNING':
      return 'warning';
    case 'RUNNING':
    case 'IN_PROGRESS':
    case 'QUEUED':
    case 'PROCESSING':
      return 'info';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ');
}


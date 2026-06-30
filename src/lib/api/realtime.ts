import { getWebSocketBaseUrl, getWebSocketToken } from './config';

export interface ExecutionEvent {
  type: string;
  projectKey: string;
  runId: string;
  scenarioId: string | null;
  resultId: string | null;
  status: string | null;
  sequenceNo: number | null;
  totalScenarios: number | null;
  durationMs: number | null;
  message: string | null;
  occurredAt: string;
}

export function executionSocketUrl(projectKey: string, runId?: string): string {
  const token = getWebSocketToken();
  if (!token) return '';
  const base = getWebSocketBaseUrl().replace(/\/$/, '');
  const path = runId
    ? `/ws/projects/${encodeURIComponent(projectKey)}/runs/${encodeURIComponent(runId)}`
    : `/ws/projects/${encodeURIComponent(projectKey)}/executions`;
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

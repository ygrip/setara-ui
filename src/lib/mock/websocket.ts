import type { ExecutionEvent } from '$lib/api/realtime';
import { mockRunsByProject } from './data';

/**
 * Minimal mock WebSocket for the static demo.
 *
 * Simulates connection lifecycle (open → live) and periodically emits
 * synthetic ExecutionEvents so the dashboard live-activity panel has data.
 *
 * Usage — drop-in replacement for `new WebSocket(url)` in mock mode:
 *
 *   import { MockWebSocket } from '$lib/mock/websocket';
 *   const ws = isMockMode() ? new MockWebSocket(projectKey) : new WebSocket(url);
 */

type EventHandler = (event: MessageEvent) => void;

const SIMULATED_EVENT_TYPES: ExecutionEvent['type'][] = [
  'RUN_STARTED',
  'RUN_DISCOVERED',
  'SCENARIO_RESULT_ACCEPTED',
  'RUN_FINISHED',
  'RUN_FINISH_ACCEPTED'
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  CONNECTING = 0 as const;
  OPEN = 1 as const;
  CLOSING = 2 as const;
  CLOSED = 3 as const;

  onopen: (() => void) | null = null;
  onclose: ((ev?: CloseEvent) => void) | null = null;
  onerror: ((ev?: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  private _projectKey: string;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _runIds: Map<string, { event: ExecutionEvent; step: number }> = new Map();

  constructor(urlOrProjectKey: string) {
    this._projectKey = urlOrProjectKey;
    // Keep url-like for compatibility
    this.url = `mock-ws://demo/${this._projectKey}`;

    // Simulate async connection
    setTimeout(() => {
      this.readyState = this.OPEN;
      this.onopen?.();
      this._startEmitting();
    }, 300 + Math.random() * 400);
  }

  send(_data: string): void {
    // No-op for mock
  }

  close(): void {
    this._stopEmitting();
    this.readyState = this.CLOSED;
    this.onclose?.(new CloseEvent('close', { wasClean: true }));
  }

  addEventListener(_type: string, _handler: EventHandler): void {
    // Not used by dashboard code; no-op.
  }

  private _startEmitting(): void {
    // Emit an event every 3–6 seconds
    this._timer = setInterval(() => this._emitEvent(), 3000 + Math.random() * 3000);
    // Fire initial RUN_DISCOVERED right away
    setTimeout(() => this._emitDiscovered(), 500);
  }

  private _stopEmitting(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private _emitDiscovered(): void {
    const projectKey = this._projectKey;
    const projectRuns = mockRunsByProject[projectKey] ?? [];
    const inFlight = projectRuns.filter(r => r.status === 'RUNNING' || r.status === 'PARTIAL');
    if (inFlight.length === 0) return;

    const run = inFlight[0];
    const event: ExecutionEvent = {
      type: 'RUN_DISCOVERED',
      projectKey,
      runId: run.id,
      scenarioId: null,
      resultId: null,
      status: run.status,
      sequenceNo: null,
      totalScenarios: run.totalScenarios ?? null,
      durationMs: null,
      message: null,
      occurredAt: new Date().toISOString()
    };

    if (!this._runIds.has(run.id)) {
      this._runIds.set(run.id, { event, step: 0 });
    }

    this._dispatch(event);
  }

  private _emitEvent(): void {
    const projectKey = this._projectKey;
    const projectRuns = mockRunsByProject[projectKey] ?? [];
    if (projectRuns.length === 0) return;

    const run = pickRandom(projectRuns);
    const runId = run.id;
    const type = pickRandom(SIMULATED_EVENT_TYPES);

    // Track step for this run
    if (!this._runIds.has(runId)) {
      this._runIds.set(runId, { event: { type: 'RUN_STARTED', projectKey, runId, scenarioId: null, resultId: null, status: 'RUNNING', sequenceNo: null, totalScenarios: run.totalScenarios ?? null, durationMs: null, message: null, occurredAt: '' }, step: 0 });
    }
    const tracker = this._runIds.get(runId)!;
    tracker.step++;

    let message: string | null = null;
    if (type === 'RUN_STARTED') {
      message = `Run ${run.id.slice(0, 7)}… started on ${run.environment}`;
    } else if (type === 'RUN_FINISHED' || type === 'RUN_FINISH_ACCEPTED') {
      message = `Run ${run.id.slice(0, 7)}… finished with ${run.passedScenarios ?? 0}/${run.totalScenarios ?? 0} passed`;
      // Remove from tracking after finish
      setTimeout(() => this._runIds.delete(runId), 10000);
    } else if (type === 'SCENARIO_RESULT_ACCEPTED') {
      message = `Scenario result accepted for run ${run.id.slice(0, 7)}…`;
    }

    const event: ExecutionEvent = {
      type,
      projectKey,
      runId,
      scenarioId: `scenario-mock-${projectKey}-${tracker.step}`,
      resultId: `result-mock-${projectKey}-${runId}-${tracker.step}`,
      status: run.status,
      sequenceNo: tracker.step,
      totalScenarios: run.totalScenarios ?? null,
      durationMs: run.status === 'RUNNING' ? null : (run as { finishedAt?: string }).finishedAt
        ? new Date((run as { finishedAt: string }).finishedAt).getTime() - new Date(run.startedAt).getTime()
        : 120_000,
      message,
      occurredAt: new Date().toISOString()
    };

    this._dispatch(event);
  }

  private _dispatch(event: ExecutionEvent): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(event) }));
    }
  }
}

/** Check if we're running in mock/demo mode. */
export function isStaticMockMode(): boolean {
  return import.meta.env.VITE_MOCK === 'true';
}

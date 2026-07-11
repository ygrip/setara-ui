/**
 * openapi.d.ts - Generated from the Setara backend OpenAPI spec.
 *
 * DO NOT EDIT manually. Regenerate with:
 *   npm run generate:types
 *   # requires a running backend at http://localhost:8080 (or SETARA_API_URL)
 *
 * Check for drift (without regenerating) with:
 *   npm run check:contract
 *
 * Last generated: 2026-05-29 against setara-core main
 */

// ── Pagination ────────────────────────────────────────────────────────────────

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

// ── Organization ──────────────────────────────────────────────────────────────

export interface Tribe {
  id: string;
  name: string;
  description: string | null;
  issueTrackerProjectKey: string | null;
  createdAt: string;
}

export interface Squad {
  id: string;
  tribeId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  squadId: string | null;
  projectKey: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'QA_LEAD' | 'QA' | 'DEVELOPER' | 'VIEWER' | 'GUEST';
  createdAt: string;
}

// ── Test scenarios ────────────────────────────────────────────────────────────

export interface Directory {
  id: string;
  projectId: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string;
}

export interface Scenario {
  id: string;
  projectId: string;
  directoryId: string | null;
  name: string;
  featureName: string | null;
  featureUri: string | null;
  tags: string[];
  status: 'ACTIVE' | 'ARCHIVED';
  lastRunStatus: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  id: string;
  scenarioId: string;
  keyword: string;
  name: string;
  sequenceNo: number;
  description: string | null;
  expectation: string | null;
}

// ── Builds ────────────────────────────────────────────────────────────────────

export interface Build {
  id: string;
  projectId: string;
  name: string;
  version: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'RELEASED' | 'DEPRECATED';
  notes: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Automation runs ───────────────────────────────────────────────────────────

export interface AutomationRun {
  id: string;
  projectId: string;
  buildId: string | null;
  status: 'STARTED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ABORTED';
  totalScenarios: number | null;
  passedScenarios: number | null;
  failedScenarios: number | null;
  skippedScenarios: number | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ScenarioRunResult {
  id: string;
  runId: string;
  scenarioId: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'UNDEFINED' | 'AMBIGUOUS';
  sequenceNo: number | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export interface TestPlan {
  id: string;
  squadId: string | null;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface ProjectApiKey {
  id: string;
  projectId: string;
  name: string;
  scope: 'ingestion' | 'execution:read' | 'full';
  maskedKey: string;
  createdAt: string;
}

// ── WebSocket execution events ────────────────────────────────────────────────

export type ExecutionEventType =
  | 'RUN_STARTED'
  | 'RUN_DISCOVERED'
  | 'SCENARIO_RESULT_ACCEPTED'
  | 'RUN_FINISH_ACCEPTED'
  | 'RUN_FINISHED'
  | 'SCENARIO_RESULT_PROCESSED';

export interface ExecutionEvent {
  type: ExecutionEventType;
  projectKey: string;
  runId: string;           // UUID (lowercase hyphenated)
  scenarioId: string | null;
  resultId: string | null;
  status: string | null;
  sequenceNo: number | null;
  totalScenarios: number | null;
  durationMs: number | null;
  message: string | null;
  occurredAt: string;      // ISO-8601 OffsetDateTime
}

// ── Statistics ────────────────────────────────────────────────────────────────

export interface ProjectDailyStatistic {
  date: string;
  projectId: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  avgDurationMs: number | null;
}

// ── NATS DLQ ──────────────────────────────────────────────────────────────────

export interface DlqEntry {
  subject: string;
  streamSeq: string;
  payload: string;  // JSON string of NatsIngestionEnvelope
}

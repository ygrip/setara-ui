import { getApiBaseUrl } from './config';
import { isMockMode, mockGetScenario, mockListDirectories, mockListScenarios, mockUpdateScenario } from '$lib/mock/client';

export interface TestDirectory {
  id: string;
  parentId: string | null;
  directoryId: string;
  name: string;
  slug: string;
  path: string;
  scenarioCount: number;
  createdAt: string;
}

export interface TagView {
  id: string;
  sanitized: string;
  display: string;
}

export interface TagInput {
  sanitized?: string;
  display: string;
}

export interface Scenario {
  id: string;
  nodeId: string;
  scenarioKey: string;
  name: string;
  source: string;
  cucumberId: string | null;
  featureUri: string | null;
  featureName: string | null;
  lineNumber: number | null;
  tags: TagView[];
  priority: string | null;
  automationStatus: string;
  automatable: boolean;
  automationNotes: string | null;
  manualNotes: string | null;
  status: string;
  steps: ScenarioStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  id?: string;
  sequenceNo: number;
  keyword: string;
  name: string;
  description: string | null;
  expectation: string | null;
}

export interface ManualExecution {
  id: string;
  scenarioId: string;
  status: string;
  executedBy: string | null;
  environment: string | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listDirectories(projectKey: string, parentId?: string | null, status = 'ACTIVE'): Promise<TestDirectory[]> {
  if (isMockMode()) return mockListDirectories(projectKey, parentId, status);
  const params = new URLSearchParams();
  if (parentId) params.set('parentId', parentId);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/directories${query}`);
  return res.json();
}

export async function createDirectory(projectKey: string, body: {
  parentId?: string | null;
  name: string;
}): Promise<TestDirectory> {
  const res = await apiFetch(`/api/projects/${projectKey}/directories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function renameDirectory(projectKey: string, directoryNodeId: string, name: string): Promise<TestDirectory> {
  const res = await apiFetch(`/api/projects/${projectKey}/directories/${directoryNodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

export async function deleteDirectory(projectKey: string, directoryNodeId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/directories/${directoryNodeId}`, { method: 'DELETE' });
}

export async function getScenario(projectKey: string, scenarioId: string): Promise<Scenario> {
  if (isMockMode()) return mockGetScenario(projectKey, scenarioId);
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`);
  return res.json();
}

export async function listScenarios(
  projectKey: string,
  nodeId?: string | null,
  status = 'ACTIVE',
  sortBy?: string,
  sortDir?: string,
  tags?: string[],
  tagMode?: string
): Promise<Scenario[]> {
  if (isMockMode()) return mockListScenarios(projectKey, nodeId, status);
  const params = new URLSearchParams();
  if (nodeId) params.set('nodeId', nodeId);
  if (status) params.set('status', status);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortDir) params.set('sortDir', sortDir);
  if (tags && tags.length) tags.forEach(t => params.append('tags', t));
  if (tagMode) params.set('tagMode', tagMode);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios${query}`);
  return res.json();
}

export interface ScenarioExistsResult {
  exists: boolean;
  name: string;
}

export async function checkScenarioExists(
  projectKey: string,
  directoryNodeId: string,
  name: string
): Promise<ScenarioExistsResult> {
  const res = await apiFetch(
    `/api/projects/${projectKey}/directories/${directoryNodeId}/scenarios/exists?name=${encodeURIComponent(name)}`
  );
  return res.json();
}

export interface BulkCopyResult {
  createdCount: number;
  skippedCount: number;
  createdIds: string[];
  skippedIds: string[];
}

export async function bulkCopyScenarios(
  projectKey: string,
  body: { scenarioIds: string[]; targetNodeId: string; duplicateStrategy?: string }
): Promise<BulkCopyResult> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function bulkDeleteScenarios(
  projectKey: string,
  scenarioIds: string[]
): Promise<{ updatedCount: number; scenarioIds: string[] }> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
  return res.json();
}

export async function moveDirectory(
  projectKey: string,
  directoryNodeId: string,
  parentId: string | null
): Promise<TestDirectory> {
  const res = await apiFetch(`/api/projects/${projectKey}/directories/${directoryNodeId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId })
  });
  return res.json();
}

export async function createScenario(projectKey: string, body: {
  nodeId: string;
  name: string;
  priority?: string;
  automatable?: boolean;
  notes?: string;
  tags?: TagInput[];
  steps?: Array<Omit<ScenarioStep, 'id'>>;
}): Promise<Scenario> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function updateScenario(projectKey: string, scenarioId: string, body: {
  name?: string;
  priority?: string;
  automatable?: boolean;
  automationStatus?: string;
  automationNotes?: string;
  manualNotes?: string;
  status?: string;
  tags?: TagInput[];
  steps?: Array<Omit<ScenarioStep, 'id'>>;
}): Promise<Scenario> {
  if (isMockMode()) return mockUpdateScenario(projectKey, scenarioId, body);
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function archiveScenario(projectKey: string, scenarioId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`, { method: 'DELETE' });
}

export async function approveDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
}

export async function rejectDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
}

export async function createManualExecution(projectKey: string, scenarioId: string, body: {
  status: string;
  executedBy?: string;
  environment?: string;
  notes?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}): Promise<ManualExecution> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}/manual-executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listManualExecutions(projectKey: string, scenarioId: string): Promise<ManualExecution[]> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}/manual-executions`);
  return res.json();
}

// ── Excel import ──────────────────────────────────────────────────────────────

export interface ImportIssue {
  rowNumber: number;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

export interface ImportValidationResult {
  totalRows: number;
  newScenarioCount: number;
  existingScenarioCount: number;
  parsedStepCount: number;
  errorCount: number;
  warningCount: number;
  issues: ImportIssue[];
}

export interface ImportResult {
  importId: string;
  status: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  issues: ImportIssue[];
}

export function importTemplateUrl(projectKey: string): string {
  return `${getApiBaseUrl()}/api/projects/${projectKey}/scenarios/import/template`;
}

export function importErrorReportUrl(projectKey: string, importId: string): string {
  return `${getApiBaseUrl()}/api/projects/${projectKey}/scenarios/import/${importId}/errors.xlsx`;
}

export async function validateImport(
  projectKey: string,
  file: File,
  duplicateStrategy = 'SKIP_EXISTING'
): Promise<ImportValidationResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('duplicateStrategy', duplicateStrategy);
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/import/validate`, {
    method: 'POST',
    body: form
  });
  return res.json();
}

export interface ImportJobView {
  importId: string;
  status: string; // QUEUED | PROCESSING | COMPLETED | FAILED
  fileName: string | null;
  duplicateStrategy: string;
  defaultStatus: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  createdAt: string;
  finishedAt: string | null;
  issues: ImportIssue[];
}

export async function listImportJobs(projectKey: string): Promise<ImportJobView[]> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/import/history`);
  return res.json();
}

export async function getImportJob(projectKey: string, importId: string): Promise<ImportJobView> {
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/import/${importId}`);
  return res.json();
}

export async function executeImport(
  projectKey: string,
  file: File,
  duplicateStrategy = 'SKIP_EXISTING',
  defaultStatus = 'DRAFT'
): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('duplicateStrategy', duplicateStrategy);
  const url = `${getApiBaseUrl()}/api/projects/${projectKey}/scenarios/import/execute?defaultStatus=${defaultStatus}`;
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export interface SimilarScenarioResult {
  scenarioId: string;
  scenarioKey: string;
  name: string;
  path: string | null;
  score: number;
}

export async function searchSimilarScenarios(
  projectKey: string,
  query: string,
  limit = 10
): Promise<SimilarScenarioResult[]> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(limit));
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/search/similar?${params}`);
  return res.json();
}

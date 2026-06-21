import { getApiBaseUrl } from './config';
import { apiFetch, authHeaders } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { isMockMode, mockGetScenario, mockListDirectories, mockListScenarios, mockUpdateScenario, mockGetProjectTags } from '$lib/mock/client';

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

export interface DirectoryMetadata {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  childCount: number;
  scenarioCount: number;
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

export async function listDirectories(projectKey: string, parentId?: string | null, status = 'ACTIVE'): Promise<TestDirectory[]> {
  if (isMockMode()) return mockListDirectories(projectKey, parentId, status);
  const params = new URLSearchParams();
  if (parentId) params.set('parentId', parentId);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/directories${query}`);
  return res.json();
}

export async function listDirectoryMetadata(
  projectKey: string,
  parentId?: string | null,
  status = 'ACTIVE'
): Promise<DirectoryMetadata[]> {
  const params = new URLSearchParams();
  if (parentId) params.set('parentId', parentId);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/directories/metadata${query}`);
  return readJsonOrThrow<DirectoryMetadata[]>(res);
}

export async function createDirectory(projectKey: string, body: {
  parentId?: string | null;
  name: string;
}): Promise<TestDirectory> {
  if (isMockMode()) return {
    id: `dir-mock-${Date.now()}`,
    parentId: body.parentId ?? null,
    directoryId: `DIR-MOCK-${Date.now()}`,
    name: body.name,
    slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    path: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    scenarioCount: 0,
    createdAt: new Date().toISOString()
  };
  const res = await apiFetch(`/api/projects/${projectKey}/directories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function renameDirectory(projectKey: string, directoryNodeId: string, name: string): Promise<TestDirectory> {
  if (isMockMode()) return {
    id: directoryNodeId,
    parentId: null,
    directoryId: directoryNodeId,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    path: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    scenarioCount: 0,
    createdAt: new Date().toISOString()
  };
  const res = await apiFetch(`/api/projects/${projectKey}/directories/${directoryNodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

export async function deleteDirectory(projectKey: string, directoryNodeId: string): Promise<void> {
  if (isMockMode()) return;
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
  tagMode?: string,
  cursor?: string,
  limit?: number
): Promise<CursorPage<Scenario>> {
  if (isMockMode()) {
    const items = await mockListScenarios(projectKey, nodeId, status);
    return { items, nextCursor: null, prevCursor: null };
  }
  const params = new URLSearchParams();
  if (nodeId) params.set('nodeId', nodeId);
  if (status) params.set('status', status);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortDir) params.set('sortDir', sortDir);
  if (tags && tags.length) tags.forEach(t => params.append('tags', t));
  if (tagMode) params.set('tagMode', tagMode);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios${query}`);
  return readJsonOrThrow<CursorPage<Scenario>>(res);
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
  if (isMockMode()) return { exists: false, name };
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
  if (isMockMode()) return { createdCount: 0, skippedCount: 0, createdIds: [], skippedIds: [] };
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
  if (isMockMode()) return { updatedCount: 0, scenarioIds: [] };
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
  if (isMockMode()) return {
    id: directoryNodeId,
    parentId,
    directoryId: directoryNodeId,
    name: '',
    slug: '',
    path: '',
    scenarioCount: 0,
    createdAt: new Date().toISOString()
  };
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
  if (isMockMode()) {
    const now = new Date().toISOString();
    return {
      id: `scenario-mock-${Date.now()}`,
      nodeId: body.nodeId,
      scenarioKey: `SCN-MOCK-${Date.now()}`,
      name: body.name,
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: null,
      lineNumber: null,
      tags: (body.tags ?? []).map(t => ({ id: `tag-${t.sanitized ?? t.display}`, sanitized: t.sanitized ?? t.display.toLowerCase(), display: t.display })),
      priority: body.priority ?? null,
      automationStatus: 'NOT_AUTOMATED',
      automatable: body.automatable ?? false,
      automationNotes: null,
      manualNotes: body.notes ?? null,
      status: 'DRAFT',
      steps: (body.steps ?? []).map((s, i) => ({ ...s, id: `step-mock-${i}` })),
      createdAt: now,
      updatedAt: now
    };
  }
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
  if (isMockMode()) return;
  await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}`, { method: 'DELETE' });
}

export async function approveDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  if (isMockMode()) return;
  await apiFetch(`/api/projects/${projectKey}/scenarios/bulk/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds })
  });
}

export async function rejectDraftScenarios(projectKey: string, scenarioIds: string[]): Promise<void> {
  if (isMockMode()) return;
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
  if (isMockMode()) {
    const now = new Date().toISOString();
    return {
      id: `exec-mock-${Date.now()}`,
      scenarioId,
      status: body.status,
      executedBy: body.executedBy ?? null,
      environment: body.environment ?? null,
      notes: body.notes ?? null,
      startedAt: body.startedAt ?? null,
      finishedAt: body.finishedAt ?? null,
      durationMs: body.durationMs ?? null,
      createdAt: now
    };
  }
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/${scenarioId}/manual-executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function listManualExecutions(projectKey: string, scenarioId: string): Promise<ManualExecution[]> {
  if (isMockMode()) return [];
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
  if (isMockMode()) return {
    totalRows: 0,
    newScenarioCount: 0,
    existingScenarioCount: 0,
    parsedStepCount: 0,
    errorCount: 0,
    warningCount: 0,
    issues: []
  };
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
  if (isMockMode()) return [];
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/import/history`);
  return res.json();
}

export async function getImportJob(projectKey: string, importId: string): Promise<ImportJobView> {
  if (isMockMode()) return {
    importId,
    status: 'COMPLETED',
    fileName: null,
    duplicateStrategy: 'SKIP_EXISTING',
    defaultStatus: 'DRAFT',
    totalRows: 0,
    processedRows: 0,
    successCount: 0,
    warningCount: 0,
    errorCount: 0,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    issues: []
  };
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/import/${importId}`);
  return res.json();
}

export async function executeImport(
  projectKey: string,
  file: File,
  duplicateStrategy = 'SKIP_EXISTING',
  defaultStatus = 'DRAFT'
): Promise<ImportResult> {
  if (isMockMode()) return {
    importId: `import-mock-${Date.now()}`,
    status: 'COMPLETED',
    totalRows: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    issues: []
  };
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
  if (isMockMode()) return [];
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(limit));
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/search/similar?${params}`);
  return readJsonOrThrow<SimilarScenarioResult[]>(
    res,
    'Smart Search is unavailable right now. Check the Intelligence configuration and try again.'
  );
}

export interface EmbeddingStatus {
  ready: boolean;
  pendingJobs: number;
  indexedScenarios: number;
}

export async function getProjectEmbeddingStatus(projectKey: string): Promise<EmbeddingStatus | null> {
  if (isMockMode()) return null;
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/search/embedding-status`);
  if (!res.ok) return null;
  return res.json();
}

export async function getProjectTags(projectKey: string): Promise<TagView[]> {
  if (isMockMode()) return mockGetProjectTags(projectKey);
  const res = await fetch(`${getApiBaseUrl()}/api/projects/${encodeURIComponent(projectKey)}/tags`);
  if (!res.ok) return [];
  return res.json();
}

export interface StepSuggestion {
  sequenceNo: number;
  keyword: string;
  name: string;
  confidence: number | null;
  reason: string | null;
}

export interface StepSuggestionResponse {
  suggestions: StepSuggestion[];
  message: string | null;
}

export interface SuggestStepsRequest {
  scenarioName: string;
  projectDescription?: string;
  directoryNodeId?: string;
  directoryPath?: string[];
  tags?: { sanitized: string; display: string }[];
  existingSteps?: { keyword: string; name: string }[];
  maxSteps?: number;
}

export async function suggestScenarioSteps(
  projectKey: string,
  request: SuggestStepsRequest
): Promise<StepSuggestionResponse> {
  if (isMockMode()) return { suggestions: [], message: 'AI step suggestion is not available in mock mode.' };
  const res = await apiFetch(`/api/projects/${projectKey}/scenarios/steps/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return readJsonOrThrow<StepSuggestionResponse>(
    res,
    'AI step suggestions are unavailable right now. Check the Intelligence configuration and try again.'
  );
}

// Streaming variant — SSE: tokens → "[DONE]" → final StepSuggestionResponse JSON.
// Calls the callback with each token as it arrives, resolves with the parsed response.
export async function suggestScenarioStepsStream(
  projectKey: string,
  request: SuggestStepsRequest,
  onToken: (token: string) => void
): Promise<StepSuggestionResponse> {
  const unavailableMsg = 'AI step suggestions are unavailable right now. Check the Intelligence configuration and try again.';
  if (isMockMode()) return { suggestions: [], message: 'AI step suggestion is not available in mock mode.' };

  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/api/projects/${projectKey}/scenarios/steps/suggest/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(request)
  });

  if (!res.ok || !res.body) {
    return { suggestions: [], message: unavailableMsg };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;
  let finalResult: StepSuggestionResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).replace(/\r$/, '');
      // IMPORTANT: do NOT .trim() the data — LLM tokens include leading
      // spaces that separate words (e.g. " scenarios" vs "scenarios").
      // Exception: control sentinel and JSON payload are always trimmed.

      // Quarkus SSE sends "data: value" (space after colon), so
      // line.slice(5) yields " [DONE]" — use trimStart() for the check only.
      if (data.trimStart() === '[DONE]') {
        doneReceived = true;
        continue;
      }

      if (doneReceived) {
        try {
          finalResult = JSON.parse(data.trim()) as StepSuggestionResponse;
          doneReceived = false; // reset for any subsequent events
        } catch {
          // JSON parse failed — keep finalResult null, will fallback
        }
        continue;
      }

      // Sanitize: strip any accidental "data:" prefix in stream tokens
      let cleanToken = data;
      cleanToken = cleanToken.replace(/^data:\s*/gm, '');
      if (cleanToken.startsWith('data:')) cleanToken = cleanToken.slice(5);
      onToken(cleanToken);
    }
  }

  // Stream ended — return parsed result or fallback
  if (finalResult) return finalResult;
  // If we got [DONE] but no JSON in the same stream, try parsing
  // whatever remains in the buffer as a last resort
  if (doneReceived && buffer.trim()) {
    const leftover = buffer.trim();
    if (leftover.startsWith('data:')) {
      try {
        return JSON.parse(leftover.slice(5).trim()) as StepSuggestionResponse;
      } catch { /* fall through */ }
    }
  }
  return { suggestions: [], message: unavailableMsg };
}

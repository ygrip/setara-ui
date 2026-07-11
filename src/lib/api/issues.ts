import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import type { CursorPage } from './pagination';
import { buildCursorParams } from './pagination';
import {
  isMockMode,
  mockGetIssueTrackerStatus,
  mockListExecutionIssues,
  mockListBuildIssues,
  mockListPlanIssues,
  mockLinkIssues,
  mockRemoveLinkedIssue,
  mockBulkCreateIssues,
  mockGetIssueDetail
} from '$lib/mock/client';

export type IssueSortBy = 'key' | 'priority' | 'status';

export interface TrackedIssueSummary {
  linkedIssueId?: string;
  issueType: string;
  issueKey: string;
  issueSummary: string;
  issueStatus: string;
  issuePriority: string;
  issueUrl: string;
}

export interface TrackedIssueDetail extends TrackedIssueSummary {
  issueDescription: string;
  issueReporter: string;
  issueAssignee: string;
}

export interface IssueTrackerStatus {
  enabled: boolean;
  provider: string | null;
  missing: string[];
  cacheTtlSeconds: number;
}

export interface LinkIssuesRequest {
  issueKeys: string[];
  planId?: string | null;
  buildId?: string | null;
  executionId?: string | null;
  createdBy?: string;
}

export interface LinkIssuesResult {
  linked: { issueKey: string; linkedIssueId: string }[];
  alreadyLinked: string[];
  failed: { issueKey: string; reason: string }[];
}

export interface NewExternalIssue {
  issueType: string;
  summary: string;
  description?: string | null;
  priority?: string | null;
  scenarioKey?: string | null;
}

export interface BulkCreateIssuesRequest {
  executionId?: string | null;
  buildId?: string | null;
  issues: NewExternalIssue[];
  reporterEmail?: string;
}

export interface BulkCreateIssuesResponse {
  created: { issueKey: string; issueUrl: string }[];
  failed: { summary: string; reason: string }[];
}

export async function getIssueTrackerStatus(): Promise<IssueTrackerStatus> {
  if (isMockMode()) return mockGetIssueTrackerStatus();
  const res = await apiFetch('/api/issue-trackers/status');
  return readJsonOrThrow<IssueTrackerStatus>(res);
}

export async function getIssueDetail(issueKey: string): Promise<TrackedIssueDetail> {
  if (isMockMode()) return mockGetIssueDetail(issueKey);
  const res = await apiFetch(`/api/issues/${issueKey}`);
  return readJsonOrThrow<TrackedIssueDetail>(res);
}

export async function listExecutionIssues(
  projectKey: string,
  executionId: string,
  opts?: { cursor?: string; limit?: number; sortBy?: IssueSortBy; sortDir?: 'asc' | 'desc' }
): Promise<CursorPage<TrackedIssueSummary>> {
  if (isMockMode()) return mockListExecutionIssues(executionId, opts?.sortBy, opts?.sortDir);
  const qs = buildCursorParams(opts?.cursor, opts?.limit, opts?.sortBy, opts?.sortDir);
  const res = await apiFetch(`/api/projects/${projectKey}/executions/${executionId}/issues${qs}`);
  return readJsonOrThrow<CursorPage<TrackedIssueSummary>>(res);
}

export async function listBuildIssues(
  projectKey: string,
  buildId: string,
  opts?: { cursor?: string; limit?: number; sortBy?: IssueSortBy; sortDir?: 'asc' | 'desc' }
): Promise<CursorPage<TrackedIssueSummary>> {
  if (isMockMode()) return mockListBuildIssues(buildId, opts?.sortBy, opts?.sortDir);
  const qs = buildCursorParams(opts?.cursor, opts?.limit, opts?.sortBy, opts?.sortDir);
  const res = await apiFetch(`/api/projects/${projectKey}/builds/${buildId}/issues${qs}`);
  return readJsonOrThrow<CursorPage<TrackedIssueSummary>>(res);
}

export async function listPlanIssues(
  squadId: string,
  planId: string,
  opts?: { cursor?: string; limit?: number; sortBy?: IssueSortBy; sortDir?: 'asc' | 'desc' }
): Promise<CursorPage<TrackedIssueSummary>> {
  if (isMockMode()) return mockListPlanIssues(planId, opts?.sortBy, opts?.sortDir);
  const qs = buildCursorParams(opts?.cursor, opts?.limit, opts?.sortBy, opts?.sortDir);
  const res = await apiFetch(`/api/squads/${squadId}/plans/${planId}/issues${qs}`);
  return readJsonOrThrow<CursorPage<TrackedIssueSummary>>(res);
}

export async function linkIssues(body: LinkIssuesRequest): Promise<LinkIssuesResult> {
  if (isMockMode()) return mockLinkIssues(body);
  const res = await apiFetch('/api/issues/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<LinkIssuesResult>(res);
}

export async function removeLinkedIssue(linkedIssueId: string): Promise<void> {
  if (isMockMode()) return mockRemoveLinkedIssue(linkedIssueId);
  const res = await apiFetch(`/api/issues/links/${linkedIssueId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove linked issue (HTTP ${res.status})`);
}

export async function bulkCreateIssues(body: BulkCreateIssuesRequest): Promise<BulkCreateIssuesResponse> {
  if (isMockMode()) return mockBulkCreateIssues(body);
  const res = await apiFetch('/api/issues/bulk-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow<BulkCreateIssuesResponse>(res);
}

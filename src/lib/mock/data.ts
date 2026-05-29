import type { Project } from '$lib/api/projects';
import type { AutomationRun } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { PlanBuild, ReleasePlan } from '$lib/api/plans';
import type { Scenario, TagView, TestDirectory } from '$lib/api/testcases';
import type { BuildAuditEvent, BuildScenario, ProjectBuild } from '$lib/api/builds';

function tag(sanitized: string): TagView {
  return { id: `tag-${sanitized}`, sanitized, display: sanitized };
}

// ── Scenario factory ────────────────────────────────────────────────────────
type AutoStatus = 'AUTOMATED' | 'AUTOMATABLE' | 'MANUAL_ONLY';
type Priority   = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type SrcType    = 'AUTOMATION' | 'MANUAL';
type Status     = 'ACTIVE' | 'DRAFT';

function mkScenario(
  id: string, nodeId: string, key: string, name: string,
  src: SrcType, autoStatus: AutoStatus,
  tags: TagView[], priority: Priority,
  status: Status, featureName: string, createdAt: string
): Scenario {
  const auto = src === 'AUTOMATION';
  return {
    id, nodeId, scenarioKey: key, name, source: src,
    cucumberId: auto ? `${id}-cid` : null,
    featureUri: auto ? `features/${id.split('-').slice(0, 2).join('/')}.feature` : null,
    featureName, lineNumber: auto ? 10 : null,
    tags, priority, automationStatus: autoStatus,
    automatable: autoStatus !== 'MANUAL_ONLY',
    automationNotes: autoStatus === 'AUTOMATED' ? 'Covered in CI regression suite.' : null,
    manualNotes: src === 'MANUAL' ? 'Requires manual verification step.' : null,
    status,
    steps: [
      { sequenceNo: 1, keyword: 'GIVEN', name: `System is in a valid state for: ${name}`, description: null, expectation: 'Precondition met.' },
      { sequenceNo: 2, keyword: 'WHEN',  name: `User performs the action`, description: `Trigger the scenario: ${name}`, expectation: 'Action is accepted by the system.' },
      { sequenceNo: 3, keyword: 'THEN',  name: `Expected outcome is observed`, description: null, expectation: 'System reflects the correct outcome.' }
    ],
    createdAt, updatedAt: createdAt
  };
}

export const mockProjects: Project[] = [
  { id: '1', squadId: 'squad-3', projectKey: 'PAYMENT', name: 'Payment Service', description: 'Core payment gateway integration tests', createdAt: '2026-01-15T10:00:00Z' },
  { id: '2', squadId: 'squad-1', projectKey: 'AUTH', name: 'Auth Service', description: 'SSO and identity management test suite', createdAt: '2026-02-01T09:00:00Z' },
  { id: '3', squadId: 'squad-4', projectKey: 'CATALOG', name: 'Product Catalog', description: 'Product search and inventory scenarios', createdAt: '2026-02-20T14:00:00Z' },
  { id: '4', squadId: 'squad-3', projectKey: 'CHECKOUT', name: 'Checkout Flow', description: 'End-to-end checkout automation', createdAt: '2026-03-05T11:00:00Z' },
  { id: '5', squadId: 'squad-5', projectKey: 'NOTIFICATION', name: 'Notification Service', description: 'Email, SMS and push notification test scenarios', createdAt: '2026-03-12T08:00:00Z' },
  { id: '6', squadId: 'squad-6', projectKey: 'ORDER', name: 'Order Management', description: 'Order lifecycle and fulfillment workflows', createdAt: '2026-03-18T10:00:00Z' },
  { id: '7', squadId: 'squad-7', projectKey: 'WALLET', name: 'Digital Wallet', description: 'Wallet top-up, balance, and transfer flows', createdAt: '2026-04-01T09:00:00Z' },
  { id: '8', squadId: 'squad-4', projectKey: 'SEARCH', name: 'Search & Discovery', description: 'Product search ranking and filter accuracy', createdAt: '2026-04-10T11:00:00Z' },
  { id: '9', squadId: 'squad-2', projectKey: 'INFRA', name: 'Platform Infra', description: 'Infrastructure health and SLA tests', createdAt: '2026-04-15T10:00:00Z' },
];

export const mockRunsByProject: Record<string, AutomationRun[]> = {
  PAYMENT: [
    { id: 'run-001', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', buildId: 'build-payment-rc1', buildKey: 'payment-rc1', buildName: 'Payment May RC1', commitSha: 'a1b2c3d4', jobName: 'regression', startedAt: '2026-05-23T08:00:00Z', finishedAt: '2026-05-23T08:12:34Z', createdAt: '2026-05-23T08:00:00Z', totalScenarios: 145, passedScenarios: 138, failedScenarios: 5, skippedScenarios: 2 },
    { id: 'run-002', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-02', status: 'FAILED', branch: 'feature/refund', environment: 'staging', framework: 'cucumber', buildId: 'build-payment-rc1', buildKey: 'payment-rc1', buildName: 'Payment May RC1', commitSha: 'e5f6g7h8', jobName: 'smoke', startedAt: '2026-05-22T14:00:00Z', finishedAt: '2026-05-22T14:05:11Z', createdAt: '2026-05-22T14:00:00Z', totalScenarios: 120, passedScenarios: 92, failedScenarios: 28, skippedScenarios: 0 },
    { id: 'run-003', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'i9j0k1l2', jobName: 'smoke', startedAt: '2026-05-21T09:00:00Z', finishedAt: '2026-05-21T09:08:45Z', createdAt: '2026-05-21T09:00:00Z', totalScenarios: 145, passedScenarios: 143, failedScenarios: 1, skippedScenarios: 1 },
    { id: 'run-007', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'p1q2r3s4', jobName: 'regression', startedAt: '2026-05-20T08:30:00Z', finishedAt: '2026-05-20T08:42:10Z', createdAt: '2026-05-20T08:30:00Z', totalScenarios: 142, passedScenarios: 129, failedScenarios: 10, skippedScenarios: 3 },
    { id: 'run-008', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 't5u6v7w8', jobName: 'regression', startedAt: '2026-05-19T07:00:00Z', finishedAt: '2026-05-19T07:14:22Z', createdAt: '2026-05-19T07:00:00Z', totalScenarios: 140, passedScenarios: 136, failedScenarios: 3, skippedScenarios: 1 },
    { id: 'run-009', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'FAILED', branch: 'feature/3ds', environment: 'staging', framework: 'cucumber', commitSha: 'x9y0z1a2', jobName: 'smoke', startedAt: '2026-05-18T15:00:00Z', finishedAt: '2026-05-18T15:06:30Z', createdAt: '2026-05-18T15:00:00Z', totalScenarios: 50, passedScenarios: 34, failedScenarios: 16, skippedScenarios: 0 },
    { id: 'run-010', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'b3c4d5e6', jobName: 'smoke', startedAt: '2026-05-17T09:00:00Z', finishedAt: '2026-05-17T09:09:12Z', createdAt: '2026-05-17T09:00:00Z', totalScenarios: 145, passedScenarios: 144, failedScenarios: 0, skippedScenarios: 1 },
  ],
  AUTH: [
    { id: 'run-004', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'RUNNING', branch: 'main', environment: 'staging', framework: 'cucumber', buildId: 'build-auth-rc1', buildKey: 'auth-rc1', buildName: 'Auth OAuth Hardening', commitSha: null, jobName: 'regression', startedAt: '2026-05-23T09:30:00Z', finishedAt: null, createdAt: '2026-05-23T09:30:00Z', totalScenarios: null, passedScenarios: null, failedScenarios: null, skippedScenarios: null },
    { id: 'run-005', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'm3n4o5p6', jobName: 'regression', startedAt: '2026-05-22T10:00:00Z', finishedAt: '2026-05-22T10:22:00Z', createdAt: '2026-05-22T10:00:00Z', totalScenarios: 200, passedScenarios: 193, failedScenarios: 5, skippedScenarios: 2 },
    { id: 'run-011', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'FAILED', branch: 'feature/oauth2', environment: 'staging', framework: 'cucumber', commitSha: 'f7g8h9i0', jobName: 'regression', startedAt: '2026-05-21T11:00:00Z', finishedAt: '2026-05-21T11:18:44Z', createdAt: '2026-05-21T11:00:00Z', totalScenarios: 200, passedScenarios: 174, failedScenarios: 26, skippedScenarios: 0 },
    { id: 'run-012', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'j1k2l3m4', jobName: 'regression', startedAt: '2026-05-20T10:00:00Z', finishedAt: '2026-05-20T10:20:15Z', createdAt: '2026-05-20T10:00:00Z', totalScenarios: 196, passedScenarios: 190, failedScenarios: 4, skippedScenarios: 2 },
  ],
  CATALOG: [
    { id: 'run-006', projectId: '3', projectKey: 'CATALOG', runnerId: 'ci-runner-02', status: 'PARTIAL', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'q7r8s9t0', jobName: 'full-suite', startedAt: '2026-05-23T07:00:00Z', finishedAt: '2026-05-23T07:35:22Z', createdAt: '2026-05-23T07:00:00Z', totalScenarios: 312, passedScenarios: 280, failedScenarios: 28, skippedScenarios: 4 },
    { id: 'run-013', projectId: '3', projectKey: 'CATALOG', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'n5o6p7q8', jobName: 'full-suite', startedAt: '2026-05-22T07:00:00Z', finishedAt: '2026-05-22T07:38:00Z', createdAt: '2026-05-22T07:00:00Z', totalScenarios: 308, passedScenarios: 301, failedScenarios: 6, skippedScenarios: 1 },
  ],
  CHECKOUT: [
    { id: 'run-chk-001', projectId: '4', projectKey: 'CHECKOUT', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', buildId: 'build-checkout-rc1', buildKey: 'checkout-rc1', buildName: 'Checkout 2026.06 RC1', commitSha: 'chk1a2b3c', jobName: 'regression', startedAt: '2026-05-25T10:00:00Z', finishedAt: '2026-05-25T10:14:22Z', createdAt: '2026-05-25T10:00:00Z', totalScenarios: 82, passedScenarios: 80, failedScenarios: 1, skippedScenarios: 1 },
    { id: 'run-chk-002', projectId: '4', projectKey: 'CHECKOUT', runnerId: 'ci-runner-02', status: 'FAILED', branch: 'feature/voucher', environment: 'staging', framework: 'cucumber', commitSha: 'chk4d5e6f', jobName: 'smoke', startedAt: '2026-05-24T08:00:00Z', finishedAt: '2026-05-24T08:08:11Z', createdAt: '2026-05-24T08:00:00Z', totalScenarios: 40, passedScenarios: 34, failedScenarios: 6, skippedScenarios: 0 },
    { id: 'run-chk-003', projectId: '4', projectKey: 'CHECKOUT', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'chkg7h8i9', jobName: 'smoke', startedAt: '2026-05-22T09:00:00Z', finishedAt: '2026-05-22T09:10:45Z', createdAt: '2026-05-22T09:00:00Z', totalScenarios: 40, passedScenarios: 40, failedScenarios: 0, skippedScenarios: 0 },
  ],
  ORDER: [
    { id: 'run-ord-001', projectId: '6', projectKey: 'ORDER', runnerId: 'ci-runner-04', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'ord1a2b3c', jobName: 'regression', startedAt: '2026-05-23T07:30:00Z', finishedAt: '2026-05-23T07:52:18Z', createdAt: '2026-05-23T07:30:00Z', totalScenarios: 156, passedScenarios: 149, failedScenarios: 5, skippedScenarios: 2 },
    { id: 'run-ord-002', projectId: '6', projectKey: 'ORDER', runnerId: 'ci-runner-04', status: 'FAILED', branch: 'feature/returns', environment: 'staging', framework: 'cucumber', commitSha: 'ord4d5e6f', jobName: 'smoke', startedAt: '2026-05-22T12:00:00Z', finishedAt: '2026-05-22T12:11:30Z', createdAt: '2026-05-22T12:00:00Z', totalScenarios: 60, passedScenarios: 47, failedScenarios: 13, skippedScenarios: 0 },
    { id: 'run-ord-003', projectId: '6', projectKey: 'ORDER', runnerId: 'ci-runner-04', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'ordg7h8i9', jobName: 'smoke', startedAt: '2026-05-21T08:00:00Z', finishedAt: '2026-05-21T08:09:22Z', createdAt: '2026-05-21T08:00:00Z', totalScenarios: 60, passedScenarios: 58, failedScenarios: 1, skippedScenarios: 1 },
    { id: 'run-ord-004', projectId: '6', projectKey: 'ORDER', runnerId: 'ci-runner-04', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'ordj0k1l2', jobName: 'regression', startedAt: '2026-05-20T07:30:00Z', finishedAt: '2026-05-20T07:51:05Z', createdAt: '2026-05-20T07:30:00Z', totalScenarios: 153, passedScenarios: 148, failedScenarios: 4, skippedScenarios: 1 },
  ],
  NOTIFICATION: [
    { id: 'run-notif-001', projectId: '5', projectKey: 'NOTIFICATION', runnerId: 'ci-runner-05', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'notif1a2b', jobName: 'regression', startedAt: '2026-05-23T06:00:00Z', finishedAt: '2026-05-23T06:18:44Z', createdAt: '2026-05-23T06:00:00Z', totalScenarios: 98, passedScenarios: 94, failedScenarios: 3, skippedScenarios: 1 },
    { id: 'run-notif-002', projectId: '5', projectKey: 'NOTIFICATION', runnerId: 'ci-runner-05', status: 'FAILED', branch: 'feature/push-fcm', environment: 'staging', framework: 'cucumber', commitSha: 'notif3c4d', jobName: 'smoke', startedAt: '2026-05-22T11:00:00Z', finishedAt: '2026-05-22T11:09:12Z', createdAt: '2026-05-22T11:00:00Z', totalScenarios: 45, passedScenarios: 38, failedScenarios: 7, skippedScenarios: 0 },
    { id: 'run-notif-003', projectId: '5', projectKey: 'NOTIFICATION', runnerId: 'ci-runner-05', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'notif5e6f', jobName: 'smoke', startedAt: '2026-05-21T06:00:00Z', finishedAt: '2026-05-21T06:10:30Z', createdAt: '2026-05-21T06:00:00Z', totalScenarios: 45, passedScenarios: 45, failedScenarios: 0, skippedScenarios: 0 },
  ],
  WALLET: [
    { id: 'run-wal-001', projectId: '7', projectKey: 'WALLET', runnerId: 'ci-runner-06', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'wal1a2b3c', jobName: 'regression', startedAt: '2026-05-23T08:00:00Z', finishedAt: '2026-05-23T08:24:15Z', createdAt: '2026-05-23T08:00:00Z', totalScenarios: 180, passedScenarios: 174, failedScenarios: 4, skippedScenarios: 2 },
    { id: 'run-wal-002', projectId: '7', projectKey: 'WALLET', runnerId: 'ci-runner-06', status: 'FAILED', branch: 'feature/rewards-v2', environment: 'staging', framework: 'cucumber', commitSha: 'wal4d5e6f', jobName: 'smoke', startedAt: '2026-05-22T09:00:00Z', finishedAt: '2026-05-22T09:12:33Z', createdAt: '2026-05-22T09:00:00Z', totalScenarios: 70, passedScenarios: 60, failedScenarios: 10, skippedScenarios: 0 },
    { id: 'run-wal-003', projectId: '7', projectKey: 'WALLET', runnerId: 'ci-runner-06', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'walg7h8i9', jobName: 'smoke', startedAt: '2026-05-21T08:00:00Z', finishedAt: '2026-05-21T08:11:00Z', createdAt: '2026-05-21T08:00:00Z', totalScenarios: 70, passedScenarios: 70, failedScenarios: 0, skippedScenarios: 0 },
    { id: 'run-wal-004', projectId: '7', projectKey: 'WALLET', runnerId: 'ci-runner-06', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'walj0k1l2', jobName: 'regression', startedAt: '2026-05-20T08:00:00Z', finishedAt: '2026-05-20T08:22:44Z', createdAt: '2026-05-20T08:00:00Z', totalScenarios: 176, passedScenarios: 170, failedScenarios: 5, skippedScenarios: 1 },
  ],
  SEARCH: [
    { id: 'run-srch-001', projectId: '8', projectKey: 'SEARCH', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'srch1a2b3', jobName: 'regression', startedAt: '2026-05-23T07:00:00Z', finishedAt: '2026-05-23T07:28:50Z', createdAt: '2026-05-23T07:00:00Z', totalScenarios: 210, passedScenarios: 204, failedScenarios: 4, skippedScenarios: 2 },
    { id: 'run-srch-002', projectId: '8', projectKey: 'SEARCH', runnerId: 'ci-runner-02', status: 'PARTIAL', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'srch4c5d6', jobName: 'full-suite', startedAt: '2026-05-22T07:00:00Z', finishedAt: '2026-05-22T07:35:20Z', createdAt: '2026-05-22T07:00:00Z', totalScenarios: 210, passedScenarios: 185, failedScenarios: 20, skippedScenarios: 5 },
    { id: 'run-srch-003', projectId: '8', projectKey: 'SEARCH', runnerId: 'ci-runner-02', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'srchg7h8i', jobName: 'smoke', startedAt: '2026-05-21T07:00:00Z', finishedAt: '2026-05-21T07:10:15Z', createdAt: '2026-05-21T07:00:00Z', totalScenarios: 80, passedScenarios: 80, failedScenarios: 0, skippedScenarios: 0 },
  ],
  INFRA: [
    { id: 'run-infra-001', projectId: '9', projectKey: 'INFRA', runnerId: 'ci-runner-07', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'infra1a2b', jobName: 'health-check', startedAt: '2026-05-23T05:00:00Z', finishedAt: '2026-05-23T05:22:10Z', createdAt: '2026-05-23T05:00:00Z', totalScenarios: 120, passedScenarios: 118, failedScenarios: 1, skippedScenarios: 1 },
    { id: 'run-infra-002', projectId: '9', projectKey: 'INFRA', runnerId: 'ci-runner-07', status: 'FAILED', branch: 'feature/new-relic-agent', environment: 'staging', framework: 'cucumber', commitSha: 'infra3c4d', jobName: 'sla-check', startedAt: '2026-05-22T05:00:00Z', finishedAt: '2026-05-22T05:20:44Z', createdAt: '2026-05-22T05:00:00Z', totalScenarios: 60, passedScenarios: 50, failedScenarios: 10, skippedScenarios: 0 },
    { id: 'run-infra-003', projectId: '9', projectKey: 'INFRA', runnerId: 'ci-runner-07', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'infra5e6f', jobName: 'health-check', startedAt: '2026-05-21T05:00:00Z', finishedAt: '2026-05-21T05:21:30Z', createdAt: '2026-05-21T05:00:00Z', totalScenarios: 120, passedScenarios: 120, failedScenarios: 0, skippedScenarios: 0 },
  ],
};

export const mockApiKeysByProject: Record<string, ApiKey[]> = {
  PAYMENT: [
    { id: 'key-001', name: 'CI Pipeline', keyPrefix: 'stk_ci_pay', scopes: 'automation:write', createdAt: '2026-01-20T10:00:00Z', revokedAt: null },
    { id: 'key-002', name: 'Staging Runner', keyPrefix: 'stk_stg_pay', scopes: 'automation:write', createdAt: '2026-02-10T09:00:00Z', revokedAt: null },
  ],
  AUTH: [
    { id: 'key-003', name: 'Auth CI', keyPrefix: 'stk_ci_auth', scopes: 'automation:write', createdAt: '2026-02-05T11:00:00Z', revokedAt: null },
  ],
  CATALOG: [],
  CHECKOUT: [],
};

type MockNode = TestDirectory & { nodeType: 'DIRECTORY' | 'FEATURE'; directoryId: string | null };

export const mockNodesByProject: Record<string, MockNode[]> = {
  PAYMENT: [
    { id: 'node-pay-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-PAYMENT01', name: 'Payments', slug: 'payments', path: 'payments', scenarioCount: 6, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-refund', parentId: 'node-pay-root', nodeType: 'DIRECTORY', directoryId: 'DIR-REFUND01', name: 'Refunds', slug: 'refunds', path: 'payments/refunds', scenarioCount: 3, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-capture', parentId: 'node-pay-root', nodeType: 'DIRECTORY', directoryId: 'DIR-CAPTURE01', name: 'Capture and Settlement', slug: 'capture-settlement', path: 'payments/capture-settlement', scenarioCount: 2, createdAt: '2026-05-03T00:00:00Z' },
    { id: 'node-webhook', parentId: 'node-pay-root', nodeType: 'DIRECTORY', directoryId: 'DIR-WEBHOOK01', name: 'Webhook Reconciliation', slug: 'webhook-reconciliation', path: 'payments/webhook-reconciliation', scenarioCount: 1, createdAt: '2026-05-04T00:00:00Z' },
    { id: 'node-risk-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-RISK01', name: 'Risk and Disputes', slug: 'risk-disputes', path: 'risk-disputes', scenarioCount: 2, createdAt: '2026-05-05T00:00:00Z' },
    { id: 'node-disputes', parentId: 'node-risk-root', nodeType: 'DIRECTORY', directoryId: 'DIR-DISPUTE01', name: 'Disputes', slug: 'disputes', path: 'risk-disputes/disputes', scenarioCount: 2, createdAt: '2026-05-05T00:00:00Z' }
  ],
  AUTH: [
    { id: 'node-login', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-LOGIN01', name: 'Login', slug: 'login', path: 'login', scenarioCount: 2, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-session', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-SESSION01', name: 'Session Security', slug: 'session-security', path: 'session-security', scenarioCount: 1, createdAt: '2026-05-02T00:00:00Z' }
  ],
  CATALOG: [
    { id: 'node-catalog-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-CATALOG01', name: 'Product Management', slug: 'product-management', path: 'product-management', scenarioCount: 3, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-catalog-search', parentId: 'node-catalog-root', nodeType: 'DIRECTORY', directoryId: 'DIR-CATALOG02', name: 'Search & Filters', slug: 'search-filters', path: 'product-management/search-filters', scenarioCount: 2, createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-catalog-inventory', parentId: 'node-catalog-root', nodeType: 'DIRECTORY', directoryId: 'DIR-CATALOG03', name: 'Inventory', slug: 'inventory', path: 'product-management/inventory', scenarioCount: 2, createdAt: '2026-05-03T00:00:00Z' },
  ],
  CHECKOUT: [
    { id: 'node-checkout-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-CHECKOUT01', name: 'Checkout', slug: 'checkout', path: 'checkout', scenarioCount: 3, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-checkout-cart', parentId: 'node-checkout-root', nodeType: 'DIRECTORY', directoryId: 'DIR-CHECKOUT02', name: 'Cart Operations', slug: 'cart-operations', path: 'checkout/cart-operations', scenarioCount: 2, createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-checkout-promo', parentId: 'node-checkout-root', nodeType: 'DIRECTORY', directoryId: 'DIR-CHECKOUT03', name: 'Promotions', slug: 'promotions', path: 'checkout/promotions', scenarioCount: 1, createdAt: '2026-05-03T00:00:00Z' },
  ],
  ORDER: [
    { id: 'node-order-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-ORDER01', name: 'Order Lifecycle', slug: 'order-lifecycle', path: 'order-lifecycle', scenarioCount: 4, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-order-cancel', parentId: 'node-order-root', nodeType: 'DIRECTORY', directoryId: 'DIR-ORDER02', name: 'Cancellation', slug: 'cancellation', path: 'order-lifecycle/cancellation', scenarioCount: 2, createdAt: '2026-05-04T00:00:00Z' },
  ],
  NOTIFICATION: [
    { id: 'node-notif-root',  parentId: null,             nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF01', name: 'Delivery Channels',  slug: 'delivery-channels',  path: 'delivery-channels',          scenarioCount: 8,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-notif-email', parentId: 'node-notif-root', nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF02', name: 'Email',              slug: 'email',              path: 'delivery-channels/email',    scenarioCount: 5,  createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-notif-sms',   parentId: 'node-notif-root', nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF03', name: 'SMS',                slug: 'sms',                path: 'delivery-channels/sms',     scenarioCount: 4,  createdAt: '2026-05-03T00:00:00Z' },
    { id: 'node-notif-push',  parentId: 'node-notif-root', nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF04', name: 'Push',               slug: 'push',               path: 'delivery-channels/push',    scenarioCount: 3,  createdAt: '2026-05-04T00:00:00Z' },
    { id: 'node-notif-tmpl',  parentId: null,             nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF05', name: 'Templates',           slug: 'templates',          path: 'templates',                 scenarioCount: 5,  createdAt: '2026-05-05T00:00:00Z' },
  ],
  WALLET: [
    { id: 'node-wallet-root',     parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET01', name: 'Wallet Core',       slug: 'wallet-core',      path: 'wallet-core',              scenarioCount: 10, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-wallet-topup',    parentId: 'node-wallet-root', nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET02', name: 'Top-up',            slug: 'topup',            path: 'wallet-core/topup',        scenarioCount: 8,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-wallet-withdraw', parentId: 'node-wallet-root', nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET03', name: 'Withdraw',          slug: 'withdraw',         path: 'wallet-core/withdraw',     scenarioCount: 6,  createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-wallet-transfer', parentId: 'node-wallet-root', nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET04', name: 'Transfer',          slug: 'transfer',         path: 'wallet-core/transfer',     scenarioCount: 7,  createdAt: '2026-05-03T00:00:00Z' },
    { id: 'node-wallet-history',  parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET05', name: 'Transaction History', slug: 'history',        path: 'history',                  scenarioCount: 5,  createdAt: '2026-05-04T00:00:00Z' },
    { id: 'node-wallet-reward',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-WALLET06', name: 'Rewards & Cashback', slug: 'rewards',         path: 'rewards',                  scenarioCount: 6,  createdAt: '2026-05-05T00:00:00Z' },
  ],
  SEARCH: [
    { id: 'node-search-root',        parentId: null,               nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH01', name: 'Search Core',       slug: 'search-core',      path: 'search-core',          scenarioCount: 12, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-search-keyword',     parentId: 'node-search-root', nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH02', name: 'Keyword Search',    slug: 'keyword-search',   path: 'search-core/keyword',  scenarioCount: 8,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-search-filter',      parentId: 'node-search-root', nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH03', name: 'Filter & Sort',     slug: 'filter-sort',      path: 'search-core/filter',   scenarioCount: 7,  createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-search-autocomplete',parentId: 'node-search-root', nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH04', name: 'Autocomplete',      slug: 'autocomplete',     path: 'search-core/autocomplete', scenarioCount: 5, createdAt: '2026-05-03T00:00:00Z' },
    { id: 'node-search-ranking',     parentId: null,               nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH05', name: 'Ranking & Relevance', slug: 'ranking',        path: 'ranking',              scenarioCount: 6,  createdAt: '2026-05-04T00:00:00Z' },
    { id: 'node-search-analytics',   parentId: null,               nodeType: 'DIRECTORY', directoryId: 'DIR-SEARCH06', name: 'Search Analytics',  slug: 'analytics',        path: 'analytics',            scenarioCount: 4,  createdAt: '2026-05-05T00:00:00Z' },
  ],
  INFRA: [
    { id: 'node-infra-root',    parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-INFRA01', name: 'Platform Health',    slug: 'platform-health', path: 'platform-health',       scenarioCount: 10, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-infra-health',  parentId: 'node-infra-root', nodeType: 'DIRECTORY', directoryId: 'DIR-INFRA02', name: 'Health Checks',      slug: 'health-checks',   path: 'platform-health/health', scenarioCount: 6,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-infra-sla',     parentId: 'node-infra-root', nodeType: 'DIRECTORY', directoryId: 'DIR-INFRA03', name: 'SLA Monitoring',     slug: 'sla-monitoring',  path: 'platform-health/sla',    scenarioCount: 5,  createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-infra-dr',      parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-INFRA04', name: 'Disaster Recovery',  slug: 'disaster-recovery', path: 'disaster-recovery',    scenarioCount: 6,  createdAt: '2026-05-03T00:00:00Z' },
    { id: 'node-infra-security',parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-INFRA05', name: 'Security Hardening', slug: 'security',        path: 'security',              scenarioCount: 5,  createdAt: '2026-05-04T00:00:00Z' },
  ],
};

export const mockScenariosByProject: Record<string, Scenario[]> = {
  PAYMENT: [
    {
      id: 'scenario-refund-happy',
      nodeId: 'node-refund',
      scenarioKey: 'SCN-REFUND1',
      name: 'Refund approved card payment',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Refunds',
      lineNumber: null,
      tags: [tag('refund'), tag('payment'), tag('happy-path')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Validate full and partial refund cases.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A settled card payment exists', description: 'Use a payment eligible for refund.', expectation: 'Payment is found and refundable.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'The user requests a refund', description: 'Submit full refund from merchant dashboard.', expectation: 'Refund request is accepted.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Refund is approved', description: 'Verify final state.', expectation: 'Payment status reflects refunded amount.' }
      ],
      createdAt: '2026-05-20T08:00:00Z',
      updatedAt: '2026-05-20T08:00:00Z'
    },
    {
      id: 'scenario-refund-partial',
      nodeId: 'node-refund',
      scenarioKey: 'SCN-REFUND2',
      name: 'Partial refund updates remaining capturable balance',
      source: 'AUTOMATION',
      cucumberId: 'payment-refund-partial',
      featureUri: 'features/payment/refund.feature',
      featureName: 'Refunds',
      lineNumber: 42,
      tags: [tag('refund'), tag('partial'), tag('regression')],
      priority: 'MEDIUM',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Mapped to nightly regression.',
      manualNotes: 'Covers partial refund accounting and merchant balance display.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A captured card payment has remaining refundable amount', description: 'Create a paid order with captured amount greater than refund request.', expectation: 'Payment ledger exposes refundable balance.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Merchant submits a partial refund', description: 'Refund less than the captured amount through the refund API.', expectation: 'Refund command is accepted for processing.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Refund ledger entry is created', description: 'Read the transaction ledger after refund completion.', expectation: 'Refund amount and original payment reference are recorded.' },
        { sequenceNo: 4, keyword: 'AND', name: 'Remaining balance is recalculated', description: 'Open merchant dashboard payment detail.', expectation: 'Refundable balance equals captured amount minus refunded amount.' }
      ],
      createdAt: '2026-05-20T09:00:00Z',
      updatedAt: '2026-05-21T09:00:00Z'
    },
    {
      id: 'scenario-refund-duplicate',
      nodeId: 'node-refund',
      scenarioKey: 'SCN-REFUND3',
      name: 'Duplicate refund request is idempotent',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Refunds',
      lineNumber: null,
      tags: [tag('refund'), tag('regression')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Should be automated after stable idempotency fixtures exist.',
      status: 'DRAFT',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A refundable payment and idempotency key exist', description: 'Prepare a captured payment and fixed request key.', expectation: 'The key has not been used before.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Two identical refund requests are submitted', description: 'Send both requests with the same idempotency key.', expectation: 'Only one refund operation is processed.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Second response reuses the first refund result', description: 'Compare refund ids and ledger entries.', expectation: 'Responses point to the same refund and no duplicate ledger entry exists.' }
      ],
      createdAt: '2026-05-21T08:00:00Z',
      updatedAt: '2026-05-21T08:00:00Z'
    },
    {
      id: 'scenario-capture-timeout',
      nodeId: 'node-capture',
      scenarioKey: 'SCN-CAPTURE1',
      name: 'Capture retry after processor timeout',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Capture and Settlement',
      lineNumber: null,
      tags: [tag('capture'), tag('settlement'), tag('critical')],
      priority: 'CRITICAL',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Important resilience path for provider instability.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'An authorized payment is ready for capture', description: 'Create authorization with a provider simulation profile.', expectation: 'Payment status is AUTHORIZED.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'The first capture request times out', description: 'Simulate processor read timeout after request is accepted.', expectation: 'Setara marks capture as pending verification.' },
        { sequenceNo: 3, keyword: 'AND', name: 'Worker retries capture reconciliation', description: 'Run the reconciliation worker.', expectation: 'Worker queries processor state before issuing a duplicate command.' },
        { sequenceNo: 4, keyword: 'THEN', name: 'Payment is settled once', description: 'Inspect payment and settlement ledger.', expectation: 'Only one capture is recorded and payment status is SETTLED.' }
      ],
      createdAt: '2026-05-18T08:00:00Z',
      updatedAt: '2026-05-22T08:00:00Z'
    },
    {
      id: 'scenario-settlement-cutoff',
      nodeId: 'node-capture',
      scenarioKey: 'SCN-CAPTURE2',
      name: 'Settlement batch respects daily cutoff window',
      source: 'AUTOMATION',
      cucumberId: 'payment-settlement-cutoff',
      featureUri: 'features/payment/settlement.feature',
      featureName: 'Settlement',
      lineNumber: 18,
      tags: [tag('capture'), tag('settlement'), tag('regression')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Runs in daily batch suite.',
      manualNotes: 'Uses fixed Asia/Jakarta cutoff fixtures.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Payments exist before and after cutoff', description: 'Seed two captures around the configured settlement cutoff.', expectation: 'Both captures are eligible for different settlement days.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Daily settlement batch runs', description: 'Trigger batch for the target business date.', expectation: 'Batch selects only captures before cutoff.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Settlement report contains expected captures', description: 'Download settlement summary.', expectation: 'Report excludes captures after cutoff.' }
      ],
      createdAt: '2026-05-17T08:00:00Z',
      updatedAt: '2026-05-23T08:00:00Z'
    },
    {
      id: 'scenario-webhook-retry',
      nodeId: 'node-webhook',
      scenarioKey: 'SCN-WEBHOOK1',
      name: 'Webhook retry recovers from downstream 500',
      source: 'AUTOMATION',
      cucumberId: 'payment-webhook-retry',
      featureUri: 'features/payment/webhook.feature',
      featureName: 'Webhook Reconciliation',
      lineNumber: 30,
      tags: [tag('webhook'), tag('retry'), tag('integration')],
      priority: 'MEDIUM',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered by mocked partner callback receiver.',
      manualNotes: 'Verifies exponential retry metadata on delivery history.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Partner endpoint fails the first callback', description: 'Configure callback receiver to return HTTP 500 once.', expectation: 'Delivery history records failed attempt.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Retry worker processes webhook delivery', description: 'Allow retry interval to elapse and run worker.', expectation: 'Second delivery is attempted.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Webhook is marked delivered', description: 'Read delivery history from Setara.', expectation: 'Final status is DELIVERED with two attempts.' }
      ],
      createdAt: '2026-05-16T08:00:00Z',
      updatedAt: '2026-05-22T10:00:00Z'
    },
    {
      id: 'scenario-dispute-evidence',
      nodeId: 'node-disputes',
      scenarioKey: 'SCN-DISPUTE1',
      name: 'Evidence package can be submitted before dispute deadline',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Disputes',
      lineNumber: null,
      tags: [tag('dispute'), tag('regression')],
      priority: 'HIGH',
      automationStatus: 'MANUAL_ONLY',
      automatable: false,
      automationNotes: 'Provider sandbox has no stable dispute upload fixture yet.',
      manualNotes: 'Manual review should verify uploaded receipt, shipment proof, and customer communication.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'An open card dispute exists', description: 'Create or select a dispute that has not passed response deadline.', expectation: 'Dispute is open and accepts evidence.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Risk analyst uploads evidence package', description: 'Attach multiple documents and notes.', expectation: 'Evidence package is accepted.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Dispute response status is updated', description: 'Refresh dispute detail.', expectation: 'Status shows evidence submitted with timestamp.' }
      ],
      createdAt: '2026-05-15T08:00:00Z',
      updatedAt: '2026-05-20T08:00:00Z'
    },
    {
      id: 'scenario-dispute-expired',
      nodeId: 'node-disputes',
      scenarioKey: 'SCN-DISPUTE2',
      name: 'Expired dispute rejects late evidence',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Disputes',
      lineNumber: null,
      tags: [tag('dispute'), tag('smoke')],
      priority: 'LOW',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Drafted while deadline fixtures are being aligned.',
      status: 'DRAFT',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A dispute response deadline has passed', description: 'Prepare dispute with response deadline in the past.', expectation: 'Dispute is no longer editable.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Analyst attempts to upload evidence', description: 'Submit evidence package from dispute detail.', expectation: 'Request is rejected.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Clear validation message is displayed', description: 'Inspect error response and UI notification.', expectation: 'Message explains that the response deadline has passed.' }
      ],
      createdAt: '2026-05-15T09:00:00Z',
      updatedAt: '2026-05-20T09:00:00Z'
    }
  ],
  AUTH: [
    {
      id: 'scenario-login-valid',
      nodeId: 'node-login',
      scenarioKey: 'SCN-LOGIN1',
      name: 'User logs in with valid credentials',
      source: 'AUTOMATION',
      cucumberId: 'auth-login-valid',
      featureUri: 'features/auth/login.feature',
      featureName: 'Login',
      lineNumber: 12,
      tags: [tag('login'), tag('smoke')],
      priority: 'CRITICAL',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered by smoke suite.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A registered user exists', description: null, expectation: 'User is active.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User enters valid credentials', description: null, expectation: 'Authentication succeeds.' }
      ],
      createdAt: '2026-05-19T08:00:00Z',
      updatedAt: '2026-05-19T08:00:00Z'
    },
    {
      id: 'scenario-login-locked',
      nodeId: 'node-login',
      scenarioKey: 'SCN-LOGIN2',
      name: 'Locked account cannot obtain access token',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Login',
      lineNumber: null,
      tags: [tag('session'), tag('security'), tag('regression')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Needs stable account lock fixture.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A user account is locked', description: 'Lock account after failed login threshold.', expectation: 'Account state is LOCKED.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User submits valid credentials', description: 'Attempt login with correct password.', expectation: 'Authentication is denied.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'No access token is issued', description: 'Inspect response body and audit event.', expectation: 'Response has no token and audit reason is ACCOUNT_LOCKED.' }
      ],
      createdAt: '2026-05-20T08:00:00Z',
      updatedAt: '2026-05-20T08:00:00Z'
    },
    {
      id: 'scenario-session-refresh',
      nodeId: 'node-session',
      scenarioKey: 'SCN-SESSION1',
      name: 'Refresh token rotation invalidates previous token',
      source: 'AUTOMATION',
      cucumberId: 'auth-session-rotation',
      featureUri: 'features/auth/session.feature',
      featureName: 'Session Security',
      lineNumber: 24,
      tags: [tag('login'), tag('session'), tag('security')],
      priority: 'CRITICAL',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered in API security suite.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A valid refresh token exists', description: 'Login and capture refresh token.', expectation: 'Session is active.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Refresh endpoint is called', description: 'Exchange refresh token for a new pair.', expectation: 'New access and refresh tokens are returned.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Original refresh token is revoked', description: 'Attempt to reuse original refresh token.', expectation: 'Reuse is rejected and security audit is recorded.' }
      ],
      createdAt: '2026-05-21T08:00:00Z',
      updatedAt: '2026-05-21T08:00:00Z'
    }
  ],
  CATALOG: [
    {
      id: 'scenario-catalog-search-keyword',
      nodeId: 'node-catalog-search',
      scenarioKey: 'SCN-CTLG1',
      name: 'Keyword search returns ranked results',
      source: 'AUTOMATION',
      cucumberId: 'catalog-keyword-search',
      featureUri: 'features/catalog/search.feature',
      featureName: 'Search & Filters',
      lineNumber: 10,
      tags: [tag('search'), tag('product'), tag('smoke')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered in search regression suite.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A product catalog with indexed items exists', description: 'Seed catalog with 50 products across categories.', expectation: 'Search index is built.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User searches for a keyword', description: 'Submit GET /search?q=laptop.', expectation: 'Search responds with results.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Results are ranked by relevance', description: 'Verify position scores.', expectation: 'Most relevant product appears first.' }
      ],
      createdAt: '2026-05-10T08:00:00Z',
      updatedAt: '2026-05-10T08:00:00Z'
    },
    {
      id: 'scenario-catalog-filter-price',
      nodeId: 'node-catalog-search',
      scenarioKey: 'SCN-CTLG2',
      name: 'Price range filter narrows search results',
      source: 'AUTOMATION',
      cucumberId: 'catalog-filter-price',
      featureUri: 'features/catalog/search.feature',
      featureName: 'Search & Filters',
      lineNumber: 40,
      tags: [tag('filter'), tag('product')],
      priority: 'MEDIUM',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: null,
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Products exist across multiple price ranges', description: 'Seed products from $10–$1000.', expectation: 'Price data is indexed.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User applies a price filter', description: 'Submit search with min_price=100&max_price=500.', expectation: 'API accepts the filter.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Only in-range products are returned', description: 'Inspect each result price.', expectation: 'No result is outside the specified range.' }
      ],
      createdAt: '2026-05-11T08:00:00Z',
      updatedAt: '2026-05-11T08:00:00Z'
    },
    {
      id: 'scenario-catalog-stock',
      nodeId: 'node-catalog-inventory',
      scenarioKey: 'SCN-CTLG3',
      name: 'Out-of-stock product is excluded from default listing',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Inventory',
      lineNumber: null,
      tags: [tag('inventory'), tag('product'), tag('smoke')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: 'Pending stock state fixture for automation.',
      manualNotes: 'Verify both API and storefront display.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A product has zero stock', description: 'Set inventory_count = 0 via admin API.', expectation: 'Product is marked out of stock.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Customer browses catalog default listing', description: 'Fetch /products?in_stock=true.', expectation: 'API returns only in-stock items.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Out-of-stock product is absent from results', description: 'Verify product ID is not in response.', expectation: 'OOS product is filtered from default view.' }
      ],
      createdAt: '2026-05-12T08:00:00Z',
      updatedAt: '2026-05-12T08:00:00Z'
    },
    {
      id: 'scenario-catalog-restock',
      nodeId: 'node-catalog-inventory',
      scenarioKey: 'SCN-CTLG4',
      name: 'Restock event updates product availability in real time',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Inventory',
      lineNumber: null,
      tags: [tag('inventory'), tag('product')],
      priority: 'MEDIUM',
      automationStatus: 'MANUAL_ONLY',
      automatable: false,
      automationNotes: 'Requires live inventory event bus — not available in sandbox.',
      manualNotes: 'Test with warehouse simulator.',
      status: 'DRAFT',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A product is out of stock', description: 'Verify product is unavailable.', expectation: 'Product availability is false.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Warehouse system fires a restock event', description: 'Publish inventory.updated event with quantity > 0.', expectation: 'Event reaches catalog service.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Product becomes available within seconds', description: 'Poll product availability every 500ms for 5s.', expectation: 'Product is listed within SLA.' }
      ],
      createdAt: '2026-05-13T08:00:00Z',
      updatedAt: '2026-05-13T08:00:00Z'
    }
  ],
  CHECKOUT: [
    {
      id: 'scenario-checkout-add-item',
      nodeId: 'node-checkout-cart',
      scenarioKey: 'SCN-CHKOUT1',
      name: 'Add item to cart persists across sessions',
      source: 'AUTOMATION',
      cucumberId: 'checkout-cart-persistence',
      featureUri: 'features/checkout/cart.feature',
      featureName: 'Cart Operations',
      lineNumber: 8,
      tags: [tag('checkout'), tag('cart'), tag('e2e')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered by cart regression suite.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A logged-in user has an empty cart', description: null, expectation: 'Cart is empty.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User adds a product to the cart', description: 'POST /cart/items with product_id and quantity.', expectation: 'Cart item is created.' },
        { sequenceNo: 3, keyword: 'AND', name: 'User ends the session and returns', description: 'Clear session cookies and re-authenticate.', expectation: 'Re-login succeeds.' },
        { sequenceNo: 4, keyword: 'THEN', name: 'Cart still contains the added item', description: 'GET /cart.', expectation: 'Previously added item is present.' }
      ],
      createdAt: '2026-05-14T08:00:00Z',
      updatedAt: '2026-05-14T08:00:00Z'
    },
    {
      id: 'scenario-checkout-remove-item',
      nodeId: 'node-checkout-cart',
      scenarioKey: 'SCN-CHKOUT2',
      name: 'Remove item from cart updates total price',
      source: 'AUTOMATION',
      cucumberId: 'checkout-cart-remove',
      featureUri: 'features/checkout/cart.feature',
      featureName: 'Cart Operations',
      lineNumber: 38,
      tags: [tag('checkout'), tag('cart')],
      priority: 'MEDIUM',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: null,
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Cart has two items', description: 'Add items A and B.', expectation: 'Total reflects both items.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User removes item A', description: 'DELETE /cart/items/{itemId}.', expectation: 'Item is removed.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Cart total reflects only item B', description: 'GET /cart and inspect total_price.', expectation: 'Total equals price of B.' }
      ],
      createdAt: '2026-05-15T08:00:00Z',
      updatedAt: '2026-05-15T08:00:00Z'
    },
    {
      id: 'scenario-checkout-promo-code',
      nodeId: 'node-checkout-promo',
      scenarioKey: 'SCN-CHKOUT3',
      name: 'Valid promo code applies discount at checkout',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Promotions',
      lineNumber: null,
      tags: [tag('checkout'), tag('cart'), tag('promo')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: 'Promo engine fixtures needed.',
      manualNotes: 'Verify discount reflected in order summary before payment.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'A valid promo code SAVE20 exists', description: 'Create promo with 20% off, no expiry.', expectation: 'Promo is active in system.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'User applies SAVE20 at checkout', description: 'POST /checkout/promo with code.', expectation: 'Promo is accepted.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Order total is discounted by 20%', description: 'Compare pre- and post-promo totals.', expectation: 'Discount equals 20% of subtotal.' }
      ],
      createdAt: '2026-05-16T08:00:00Z',
      updatedAt: '2026-05-16T08:00:00Z'
    }
  ],
  ORDER: [
    {
      id: 'scenario-order-place',
      nodeId: 'node-order-root',
      scenarioKey: 'SCN-ORDER1',
      name: 'Customer places order and receives confirmation',
      source: 'AUTOMATION',
      cucumberId: 'order-place-happy-path',
      featureUri: 'features/order/place.feature',
      featureName: 'Order Lifecycle',
      lineNumber: 6,
      tags: [tag('order'), tag('lifecycle'), tag('smoke')],
      priority: 'CRITICAL',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Part of smoke suite.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Cart has items and payment method is set', description: null, expectation: 'Order is ready to place.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Customer submits checkout', description: 'POST /orders', expectation: 'Order is created with PENDING status.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Confirmation email is sent', description: 'Check notification queue.', expectation: 'Email event is dispatched within 5s.' }
      ],
      createdAt: '2026-05-08T08:00:00Z',
      updatedAt: '2026-05-08T08:00:00Z'
    },
    {
      id: 'scenario-order-cancel-before-ship',
      nodeId: 'node-order-cancel',
      scenarioKey: 'SCN-ORDER2',
      name: 'Order can be cancelled before shipment',
      source: 'AUTOMATION',
      cucumberId: 'order-cancel-pre-ship',
      featureUri: 'features/order/cancel.feature',
      featureName: 'Cancellation',
      lineNumber: 12,
      tags: [tag('order'), tag('cancellation'), tag('regression')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Covered in order regression.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'An order is in PENDING or CONFIRMED state', description: null, expectation: 'Order has not shipped.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Customer requests cancellation', description: 'POST /orders/{id}/cancel', expectation: 'Cancellation is accepted.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Order status changes to CANCELLED', description: 'GET /orders/{id}', expectation: 'Status is CANCELLED and refund is initiated.' }
      ],
      createdAt: '2026-05-09T08:00:00Z',
      updatedAt: '2026-05-09T08:00:00Z'
    },
    {
      id: 'scenario-order-cancel-after-ship',
      nodeId: 'node-order-cancel',
      scenarioKey: 'SCN-ORDER3',
      name: 'Cancellation after shipment is rejected',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Cancellation',
      lineNumber: null,
      tags: [tag('order'), tag('cancellation')],
      priority: 'MEDIUM',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: null,
      manualNotes: 'Must verify correct error message and no refund is triggered.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'An order is in SHIPPED state', description: null, expectation: 'Order has left warehouse.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Customer requests cancellation', description: 'POST /orders/{id}/cancel', expectation: 'Request is received.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Cancellation is rejected with 422', description: 'Check response.', expectation: 'Error code is ORDER_ALREADY_SHIPPED.' }
      ],
      createdAt: '2026-05-10T08:00:00Z',
      updatedAt: '2026-05-10T08:00:00Z'
    }
  ],
  WALLET: [
    mkScenario('wallet-topup-card',     'node-wallet-topup',    'SCN-WAL1',  'Top-up wallet with credit card',                         'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('topup'),tag('smoke')],          'CRITICAL', 'ACTIVE', 'Top-up',   '2026-05-01T08:00:00Z'),
    mkScenario('wallet-topup-bank',     'node-wallet-topup',    'SCN-WAL2',  'Top-up via bank transfer is credited within SLA',         'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('topup'),tag('regression')],     'HIGH',     'ACTIVE', 'Top-up',   '2026-05-01T09:00:00Z'),
    mkScenario('wallet-topup-limit',    'node-wallet-topup',    'SCN-WAL3',  'Top-up exceeding daily limit is rejected',                'MANUAL',     'AUTOMATABLE',  [tag('wallet'),tag('topup'),tag('limit')],          'HIGH',     'ACTIVE', 'Top-up',   '2026-05-02T08:00:00Z'),
    mkScenario('wallet-topup-retry',    'node-wallet-topup',    'SCN-WAL4',  'Failed top-up retries do not double-charge',              'MANUAL',     'AUTOMATABLE',  [tag('wallet'),tag('topup'),tag('idempotency')],    'CRITICAL', 'ACTIVE', 'Top-up',   '2026-05-02T09:00:00Z'),
    mkScenario('wallet-topup-promo',    'node-wallet-topup',    'SCN-WAL5',  'Promotional bonus applied on qualifying top-up',          'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('topup'),tag('promo')],          'MEDIUM',   'ACTIVE', 'Top-up',   '2026-05-03T08:00:00Z'),
    mkScenario('wallet-withdraw-bank',  'node-wallet-withdraw', 'SCN-WAL6',  'Withdraw to registered bank account succeeds',            'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('withdraw'),tag('smoke')],       'CRITICAL', 'ACTIVE', 'Withdraw', '2026-05-04T08:00:00Z'),
    mkScenario('wallet-withdraw-limit', 'node-wallet-withdraw', 'SCN-WAL7',  'Withdrawal exceeding balance is blocked',                  'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('withdraw'),tag('validation')],  'HIGH',     'ACTIVE', 'Withdraw', '2026-05-04T09:00:00Z'),
    mkScenario('wallet-withdraw-kyc',   'node-wallet-withdraw', 'SCN-WAL8',  'Unverified KYC blocks large withdrawal',                  'MANUAL',     'AUTOMATABLE',  [tag('wallet'),tag('withdraw'),tag('kyc')],         'HIGH',     'ACTIVE', 'Withdraw', '2026-05-05T08:00:00Z'),
    mkScenario('wallet-transfer-p2p',   'node-wallet-transfer', 'SCN-WAL9',  'Peer-to-peer transfer completes instantly',               'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('transfer'),tag('smoke')],       'CRITICAL', 'ACTIVE', 'Transfer', '2026-05-06T08:00:00Z'),
    mkScenario('wallet-transfer-split', 'node-wallet-transfer', 'SCN-WAL10', 'Split payment deducts correct amount from each wallet',   'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('transfer'),tag('regression')],  'HIGH',     'ACTIVE', 'Transfer', '2026-05-06T09:00:00Z'),
    mkScenario('wallet-transfer-ref',   'node-wallet-transfer', 'SCN-WAL11', 'Transfer with reference note is stored correctly',        'MANUAL',     'AUTOMATABLE',  [tag('wallet'),tag('transfer')],                   'MEDIUM',   'ACTIVE', 'Transfer', '2026-05-07T08:00:00Z'),
    mkScenario('wallet-history-page',   'node-wallet-history',  'SCN-WAL12', 'Transaction history paginates correctly',                 'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('history'),tag('pagination')],   'MEDIUM',   'ACTIVE', 'History',  '2026-05-08T08:00:00Z'),
    mkScenario('wallet-history-filter', 'node-wallet-history',  'SCN-WAL13', 'Filter by transaction type returns correct subset',       'AUTOMATION', 'AUTOMATED',    [tag('wallet'),tag('history'),tag('filter')],       'MEDIUM',   'ACTIVE', 'History',  '2026-05-08T09:00:00Z'),
    mkScenario('wallet-reward-cashback','node-wallet-reward',   'SCN-WAL14', 'Cashback is credited 24h after qualifying purchase',      'MANUAL',     'AUTOMATABLE',  [tag('wallet'),tag('rewards'),tag('cashback')],     'MEDIUM',   'ACTIVE', 'Rewards',  '2026-05-09T08:00:00Z'),
    mkScenario('wallet-reward-expire',  'node-wallet-reward',   'SCN-WAL15', 'Expired reward points are deducted on cycle end',         'MANUAL',     'MANUAL_ONLY',  [tag('wallet'),tag('rewards'),tag('expiry')],       'LOW',      'DRAFT',  'Rewards',  '2026-05-09T09:00:00Z'),
  ],
  SEARCH: [
    mkScenario('search-kw-exact',     'node-search-keyword',      'SCN-SRCH1',  'Exact keyword match returns top result',                  'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('keyword'),tag('smoke')],          'CRITICAL', 'ACTIVE', 'Keyword',      '2026-05-01T08:00:00Z'),
    mkScenario('search-kw-typo',      'node-search-keyword',      'SCN-SRCH2',  'Typo-tolerant search surfaces relevant results',          'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('keyword'),tag('fuzzy')],          'HIGH',     'ACTIVE', 'Keyword',      '2026-05-01T09:00:00Z'),
    mkScenario('search-kw-empty',     'node-search-keyword',      'SCN-SRCH3',  'Empty query returns featured/popular results',            'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('keyword')],                       'MEDIUM',   'ACTIVE', 'Keyword',      '2026-05-02T08:00:00Z'),
    mkScenario('search-kw-special',   'node-search-keyword',      'SCN-SRCH4',  'Special characters in query are sanitised safely',       'MANUAL',     'AUTOMATABLE', [tag('search'),tag('keyword'),tag('security')],       'HIGH',     'ACTIVE', 'Keyword',      '2026-05-02T09:00:00Z'),
    mkScenario('search-filter-cat',   'node-search-filter',       'SCN-SRCH5',  'Category filter narrows results correctly',               'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('filter'),tag('smoke')],           'HIGH',     'ACTIVE', 'Filter',       '2026-05-03T08:00:00Z'),
    mkScenario('search-filter-price', 'node-search-filter',       'SCN-SRCH6',  'Price range filter returns in-range products only',       'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('filter'),tag('regression')],      'HIGH',     'ACTIVE', 'Filter',       '2026-05-03T09:00:00Z'),
    mkScenario('search-filter-rating','node-search-filter',       'SCN-SRCH7',  'Rating filter excludes products below threshold',         'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('filter')],                        'MEDIUM',   'ACTIVE', 'Filter',       '2026-05-04T08:00:00Z'),
    mkScenario('search-filter-multi', 'node-search-filter',       'SCN-SRCH8',  'Multiple filters applied simultaneously are additive',   'MANUAL',     'AUTOMATABLE', [tag('search'),tag('filter'),tag('regression')],      'HIGH',     'ACTIVE', 'Filter',       '2026-05-04T09:00:00Z'),
    mkScenario('search-auto-trigger', 'node-search-autocomplete', 'SCN-SRCH9',  'Autocomplete triggers after 2 characters',               'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('autocomplete'),tag('smoke')],     'MEDIUM',   'ACTIVE', 'Autocomplete', '2026-05-05T08:00:00Z'),
    mkScenario('search-auto-debounce','node-search-autocomplete', 'SCN-SRCH10', 'Autocomplete debounces rapid keystrokes',                 'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('autocomplete')],                  'MEDIUM',   'ACTIVE', 'Autocomplete', '2026-05-05T09:00:00Z'),
    mkScenario('search-rank-boost',   'node-search-ranking',      'SCN-SRCH11', 'Boosted products appear above organic results',           'MANUAL',     'AUTOMATABLE', [tag('search'),tag('ranking'),tag('regression')],     'HIGH',     'ACTIVE', 'Ranking',      '2026-05-06T08:00:00Z'),
    mkScenario('search-rank-fresh',   'node-search-ranking',      'SCN-SRCH12', 'Freshness signal promotes recently updated products',    'MANUAL',     'MANUAL_ONLY', [tag('search'),tag('ranking')],                       'LOW',      'DRAFT',  'Ranking',      '2026-05-06T09:00:00Z'),
    mkScenario('search-analytics-log','node-search-analytics',    'SCN-SRCH13', 'Search events are logged with query and result count',   'AUTOMATION', 'AUTOMATED',   [tag('search'),tag('analytics'),tag('regression')],   'MEDIUM',   'ACTIVE', 'Analytics',    '2026-05-07T08:00:00Z'),
    mkScenario('search-analytics-ctr','node-search-analytics',    'SCN-SRCH14', 'Click-through rate tracked per result position',         'MANUAL',     'AUTOMATABLE', [tag('search'),tag('analytics')],                     'LOW',      'ACTIVE', 'Analytics',    '2026-05-07T09:00:00Z'),
  ],
  INFRA: [
    mkScenario('infra-health-api',   'node-infra-health',   'SCN-INF1',  'API gateway health endpoint returns 200 within 200ms',     'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('health'),tag('smoke')],        'CRITICAL', 'ACTIVE', 'Health',   '2026-05-01T08:00:00Z'),
    mkScenario('infra-health-db',    'node-infra-health',   'SCN-INF2',  'Database connection pool is healthy under load',           'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('health'),tag('database')],     'CRITICAL', 'ACTIVE', 'Health',   '2026-05-01T09:00:00Z'),
    mkScenario('infra-health-cache', 'node-infra-health',   'SCN-INF3',  'Redis cache hit rate remains above 85%',                   'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('health'),tag('cache')],        'HIGH',     'ACTIVE', 'Health',   '2026-05-02T08:00:00Z'),
    mkScenario('infra-health-queue', 'node-infra-health',   'SCN-INF4',  'Message queue consumer lag stays below threshold',        'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('health'),tag('queue')],        'HIGH',     'ACTIVE', 'Health',   '2026-05-02T09:00:00Z'),
    mkScenario('infra-sla-p99',      'node-infra-sla',      'SCN-INF5',  'p99 latency stays under 500ms during peak traffic',       'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('sla'),tag('performance')],     'CRITICAL', 'ACTIVE', 'SLA',      '2026-05-03T08:00:00Z'),
    mkScenario('infra-sla-uptime',   'node-infra-sla',      'SCN-INF6',  'Service achieves 99.9% uptime over 30-day window',        'MANUAL',     'MANUAL_ONLY', [tag('infra'),tag('sla'),tag('uptime')],          'CRITICAL', 'ACTIVE', 'SLA',      '2026-05-03T09:00:00Z'),
    mkScenario('infra-sla-error',    'node-infra-sla',      'SCN-INF7',  'Error rate stays below 0.1% under normal load',           'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('sla'),tag('reliability')],     'HIGH',     'ACTIVE', 'SLA',      '2026-05-04T08:00:00Z'),
    mkScenario('infra-dr-failover',  'node-infra-dr',       'SCN-INF8',  'Active-passive failover completes within 60 seconds',     'MANUAL',     'AUTOMATABLE', [tag('infra'),tag('disaster-recovery'),tag('failover')], 'CRITICAL', 'ACTIVE', 'DR',  '2026-05-05T08:00:00Z'),
    mkScenario('infra-dr-backup',    'node-infra-dr',       'SCN-INF9',  'Daily database backup completes and verifies integrity',  'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('disaster-recovery'),tag('backup')],   'CRITICAL', 'ACTIVE', 'DR',  '2026-05-05T09:00:00Z'),
    mkScenario('infra-dr-restore',   'node-infra-dr',       'SCN-INF10', 'Point-in-time restore recovers data within RPO',          'MANUAL',     'AUTOMATABLE', [tag('infra'),tag('disaster-recovery')],          'HIGH',     'DRAFT',  'DR',       '2026-05-06T08:00:00Z'),
    mkScenario('infra-sec-tls',      'node-infra-security', 'SCN-INF11', 'All endpoints enforce TLS 1.2 minimum',                   'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('security'),tag('tls')],        'CRITICAL', 'ACTIVE', 'Security', '2026-05-07T08:00:00Z'),
    mkScenario('infra-sec-headers',  'node-infra-security', 'SCN-INF12', 'HTTP security headers present on all responses',          'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('security'),tag('headers')],    'HIGH',     'ACTIVE', 'Security', '2026-05-07T09:00:00Z'),
    mkScenario('infra-sec-rate',     'node-infra-security', 'SCN-INF13', 'Rate limiter blocks abusive client IPs',                  'AUTOMATION', 'AUTOMATED',   [tag('infra'),tag('security'),tag('rate-limit')], 'HIGH',     'ACTIVE', 'Security', '2026-05-08T08:00:00Z'),
  ],
  NOTIFICATION: [
    {
      id: 'scenario-notif-email-delivery',
      nodeId: 'node-notif-email',
      scenarioKey: 'SCN-NOTIF1',
      name: 'Order confirmation email is delivered within SLA',
      source: 'AUTOMATION',
      cucumberId: 'notif-email-order-confirm',
      featureUri: 'features/notification/email.feature',
      featureName: 'Email',
      lineNumber: 10,
      tags: [tag('smoke')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATED',
      automatable: true,
      automationNotes: 'Uses mailhog test mailbox.',
      manualNotes: null,
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'Customer places an order', description: null, expectation: 'Order event is emitted.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Notification worker processes the event', description: 'Allow up to 10s for processing.', expectation: 'Email task is queued.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Email is delivered within 30 seconds', description: 'Check mailbox via mailhog API.', expectation: 'Email with order ID arrives in inbox.' }
      ],
      createdAt: '2026-05-06T08:00:00Z',
      updatedAt: '2026-05-06T08:00:00Z'
    },
    {
      id: 'scenario-notif-email-unsubscribe',
      nodeId: 'node-notif-email',
      scenarioKey: 'SCN-NOTIF2',
      name: 'Unsubscribed user does not receive marketing emails',
      source: 'MANUAL',
      cucumberId: null,
      featureUri: null,
      featureName: 'Email',
      lineNumber: null,
      tags: [tag('regression')],
      priority: 'HIGH',
      automationStatus: 'AUTOMATABLE',
      automatable: true,
      automationNotes: 'Needs unsubscribe fixture integration.',
      manualNotes: 'GDPR compliance check — critical path.',
      status: 'ACTIVE',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: 'User has unsubscribed from marketing emails', description: null, expectation: 'Preference is saved as unsubscribed.' },
        { sequenceNo: 2, keyword: 'WHEN', name: 'Marketing campaign is dispatched', description: 'Trigger campaign blast.', expectation: 'Campaign service processes recipients.' },
        { sequenceNo: 3, keyword: 'THEN', name: 'Unsubscribed user receives no email', description: 'Check mailhog for user address.', expectation: 'No email arrives for unsubscribed address.' }
      ],
      createdAt: '2026-05-07T08:00:00Z',
      updatedAt: '2026-05-07T08:00:00Z'
    },
    mkScenario('notif-email-template',   'node-notif-email', 'SCN-NOTIF3',  'Email template renders localised content correctly',      'AUTOMATION', 'AUTOMATED',   [tag('email'),tag('template'),tag('regression')], 'HIGH',   'ACTIVE', 'Email',     '2026-05-08T08:00:00Z'),
    mkScenario('notif-email-bounce',     'node-notif-email', 'SCN-NOTIF4',  'Bounced email is flagged and suppressed',                  'AUTOMATION', 'AUTOMATED',   [tag('email'),tag('bounce')],                     'HIGH',   'ACTIVE', 'Email',     '2026-05-08T09:00:00Z'),
    mkScenario('notif-email-retry',      'node-notif-email', 'SCN-NOTIF5',  'Transient SMTP failure triggers retry with backoff',       'MANUAL',     'AUTOMATABLE', [tag('email'),tag('retry')],                      'HIGH',   'ACTIVE', 'Email',     '2026-05-09T08:00:00Z'),
    mkScenario('notif-sms-otp',          'node-notif-sms',   'SCN-NOTIF6',  'OTP SMS is delivered within 30 seconds',                  'AUTOMATION', 'AUTOMATED',   [tag('sms'),tag('otp'),tag('smoke')],             'CRITICAL','ACTIVE', 'SMS',       '2026-05-10T08:00:00Z'),
    mkScenario('notif-sms-intl',         'node-notif-sms',   'SCN-NOTIF7',  'International SMS delivered to supported country codes',  'MANUAL',     'AUTOMATABLE', [tag('sms'),tag('international')],                'HIGH',   'ACTIVE', 'SMS',       '2026-05-10T09:00:00Z'),
    mkScenario('notif-sms-limit',        'node-notif-sms',   'SCN-NOTIF8',  'Rate limiting prevents SMS flood per user',               'AUTOMATION', 'AUTOMATED',   [tag('sms'),tag('rate-limit'),tag('security')],   'HIGH',   'ACTIVE', 'SMS',       '2026-05-11T08:00:00Z'),
    mkScenario('notif-push-token',       'node-notif-push',  'SCN-NOTIF9',  'Push notification delivered to valid device token',       'AUTOMATION', 'AUTOMATED',   [tag('push'),tag('smoke')],                       'HIGH',   'ACTIVE', 'Push',      '2026-05-12T08:00:00Z'),
    mkScenario('notif-push-expire',      'node-notif-push',  'SCN-NOTIF10', 'Expired device token is removed from registry',           'MANUAL',     'AUTOMATABLE', [tag('push'),tag('token')],                       'MEDIUM', 'ACTIVE', 'Push',      '2026-05-12T09:00:00Z'),
    mkScenario('notif-tmpl-variables',   'node-notif-tmpl',  'SCN-NOTIF11', 'Template variables are substituted before sending',       'AUTOMATION', 'AUTOMATED',   [tag('template'),tag('regression')],              'HIGH',   'ACTIVE', 'Templates', '2026-05-13T08:00:00Z'),
    mkScenario('notif-tmpl-locale',      'node-notif-tmpl',  'SCN-NOTIF12', 'Template selects correct locale based on user preference','AUTOMATION', 'AUTOMATED',   [tag('template'),tag('i18n')],                    'MEDIUM', 'ACTIVE', 'Templates', '2026-05-13T09:00:00Z'),
  ]
};

export const mockPlansByProject: Record<string, ReleasePlan[]> = {
  PAYMENT: [
    {
      id: 'plan-payment-2026-05',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: '2026.05 Regression',
      releaseVersion: '2026.05',
      releaseDate: null,
      description: 'Regression scope for payment release readiness.',
      status: 'IN_PROGRESS',
      createdAt: '2026-05-22T08:00:00Z',
      updatedAt: '2026-05-22T08:00:00Z',
      openedAt: '2026-05-22T08:00:00Z',
      openedBy: 'qa-payment@example.com',
      inProgressAt: '2026-05-22T09:00:00Z',
      closedAt: null,
      closedBy: null
    },
    {
      id: 'plan-payment-2026-04',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: '2026.04 Hotfix Validation',
      releaseVersion: '2026.04.1',
      releaseDate: null,
      description: 'Post-hotfix smoke and regression validation.',
      status: 'CLOSED',
      createdAt: '2026-04-10T08:00:00Z',
      updatedAt: '2026-04-18T16:30:00Z',
      openedAt: '2026-04-10T08:00:00Z',
      openedBy: 'qa-payment@example.com',
      inProgressAt: '2026-04-12T08:00:00Z',
      closedAt: '2026-04-18T16:30:00Z',
      closedBy: 'lead-payment@example.com'
    },
    {
      id: 'plan-payment-2026-06-prep',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: '2026.06 Prep',
      releaseVersion: null,
      releaseDate: '2026-06-30',
      description: 'Early preparation for June release scope.',
      status: 'OPEN',
      createdAt: '2026-05-25T08:00:00Z',
      updatedAt: '2026-05-25T08:00:00Z',
      openedAt: '2026-05-25T08:00:00Z',
      openedBy: 'qa-payment@example.com',
      inProgressAt: null,
      closedAt: null,
      closedBy: null
    }
  ]
};

export const mockBuildsByProject: Record<string, ProjectBuild[]> = {
  PAYMENT: [
    {
      id: 'build-payment-rc1',
      projectId: '1',
      projectKey: 'PAYMENT',
      projectName: 'Payment Service',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: 'Payment 2026.06 RC1',
      buildKey: 'PAY-2026-06-RC1',
      version: '2026.06.0-rc1',
      description: 'Sprint verification build for payment release readiness.', requirements: null,
      status: 'IN_PROGRESS',
      initiatedAt: '2026-05-24T08:00:00Z',
      inProgressAt: '2026-05-24T09:15:00Z',
      verifiedAt: null,
      createdBy: 'qa-payment@example.com',
      verifiedBy: null,
      createdAt: '2026-05-24T08:00:00Z',
      updatedAt: '2026-05-25T10:30:00Z',
      metrics: { buildId: 'build-payment-rc1', totalScenarios: 6, passed: 3, failed: 2, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 60, executionCoverage: 83.33 }
    },
    {
      id: 'build-payment-hotfix',
      projectId: '1',
      projectKey: 'PAYMENT',
      projectName: 'Payment Service',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: 'Payment Hotfix 2026.05.1',
      buildKey: 'PAY-2026-05-HF1',
      version: '2026.05.1',
      description: 'Closed hotfix verification build.', requirements: null,
      status: 'VERIFIED',
      initiatedAt: '2026-05-10T07:00:00Z',
      inProgressAt: '2026-05-10T07:20:00Z',
      verifiedAt: '2026-05-10T13:40:00Z',
      createdBy: 'qa-payment@example.com',
      verifiedBy: 'lead-payment@example.com',
      createdAt: '2026-05-10T07:00:00Z',
      updatedAt: '2026-05-10T13:40:00Z',
      metrics: { buildId: 'build-payment-hotfix', totalScenarios: 3, passed: 3, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 }
    }
  ],
  AUTH: [
    {
      id: 'build-auth-rc1',
      projectId: '2',
      projectKey: 'AUTH',
      projectName: 'Auth Service',
      squadId: 'squad-1',
      squadName: 'Identity',
      name: 'Auth 2026.06 RC1',
      buildKey: 'AUTH-2026-06-RC1',
      version: '2026.06.0-rc1',
      description: 'Identity dependency build for checkout release.', requirements: null,
      status: 'INITIATED',
      initiatedAt: '2026-05-25T08:30:00Z',
      inProgressAt: null,
      verifiedAt: null,
      createdBy: 'qa-auth@example.com',
      verifiedBy: null,
      createdAt: '2026-05-25T08:30:00Z',
      updatedAt: '2026-05-25T08:30:00Z',
      metrics: { buildId: 'build-auth-rc1', totalScenarios: 2, passed: 0, failed: 0, blocked: 0, skipped: 0, notExecuted: 2, passPercentage: 0, executionCoverage: 0 }
    }
  ],
  ORDER: [
    {
      id: 'build-order-rc1', projectId: '6', projectKey: 'ORDER', projectName: 'Order Management', squadId: 'squad-6', squadName: 'Order Fulfillment',
      name: 'Order 2026.06 RC1', buildKey: 'ORDER-2026-06-RC1', version: '2026.06.0-rc1', description: 'Order lifecycle verification for June release.', requirements: null,
      status: 'IN_PROGRESS', initiatedAt: '2026-05-24T09:00:00Z', inProgressAt: '2026-05-24T09:30:00Z', verifiedAt: null,
      createdBy: 'qa-order@example.com', verifiedBy: null, createdAt: '2026-05-24T09:00:00Z', updatedAt: '2026-05-25T10:00:00Z',
      metrics: { buildId: 'build-order-rc1', totalScenarios: 3, passed: 2, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 66.67, executionCoverage: 66.67 }
    }
  ],
  NOTIFICATION: [
    {
      id: 'build-notif-rc1', projectId: '5', projectKey: 'NOTIFICATION', projectName: 'Notification Service', squadId: 'squad-5', squadName: 'Notifications',
      name: 'Notification 2026.06 RC1', buildKey: 'NOTIF-2026-06-RC1', version: '2026.06.0-rc1', description: 'Notification delivery and template verification.', requirements: null,
      status: 'INITIATED', initiatedAt: '2026-05-25T10:00:00Z', inProgressAt: null, verifiedAt: null,
      createdBy: 'qa-notif@example.com', verifiedBy: null, createdAt: '2026-05-25T10:00:00Z', updatedAt: '2026-05-25T10:00:00Z',
      metrics: { buildId: 'build-notif-rc1', totalScenarios: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 0, executionCoverage: 0 }
    }
  ],
  WALLET: [
    {
      id: 'build-wallet-rc1', projectId: '7', projectKey: 'WALLET', projectName: 'Digital Wallet', squadId: 'squad-7', squadName: 'Wallet & Rewards',
      name: 'Wallet 2026.06 RC1', buildKey: 'WALLET-2026-06-RC1', version: '2026.06.0-rc1', description: 'Wallet top-up, withdraw and transfer verification.', requirements: null,
      status: 'IN_PROGRESS', initiatedAt: '2026-05-24T08:00:00Z', inProgressAt: '2026-05-24T08:30:00Z', verifiedAt: null,
      createdBy: 'qa-wallet@example.com', verifiedBy: null, createdAt: '2026-05-24T08:00:00Z', updatedAt: '2026-05-25T09:00:00Z',
      metrics: { buildId: 'build-wallet-rc1', totalScenarios: 8, passed: 6, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 75, executionCoverage: 87.5 }
    },
    {
      id: 'build-wallet-hf1', projectId: '7', projectKey: 'WALLET', projectName: 'Digital Wallet', squadId: 'squad-7', squadName: 'Wallet & Rewards',
      name: 'Wallet Hotfix 2026.05.1', buildKey: 'WALLET-2026-05-HF1', version: '2026.05.1', description: 'Hotfix for rewards expiry calculation.', requirements: null,
      status: 'VERIFIED', initiatedAt: '2026-05-12T07:00:00Z', inProgressAt: '2026-05-12T07:30:00Z', verifiedAt: '2026-05-12T14:00:00Z',
      createdBy: 'qa-wallet@example.com', verifiedBy: 'lead-wallet@example.com', createdAt: '2026-05-12T07:00:00Z', updatedAt: '2026-05-12T14:00:00Z',
      metrics: { buildId: 'build-wallet-hf1', totalScenarios: 4, passed: 4, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 }
    }
  ],
  SEARCH: [
    {
      id: 'build-search-rc1', projectId: '8', projectKey: 'SEARCH', projectName: 'Search & Discovery', squadId: 'squad-4', squadName: 'Catalog & Search',
      name: 'Search 2026.06 RC1', buildKey: 'SEARCH-2026-06-RC1', version: '2026.06.0-rc1', description: 'Search ranking and filter verification for June.', requirements: null,
      status: 'INITIATED', initiatedAt: '2026-05-25T11:00:00Z', inProgressAt: null, verifiedAt: null,
      createdBy: 'qa-search@example.com', verifiedBy: null, createdAt: '2026-05-25T11:00:00Z', updatedAt: '2026-05-25T11:00:00Z',
      metrics: { buildId: 'build-search-rc1', totalScenarios: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 0, executionCoverage: 0 }
    }
  ],
  INFRA: [
    {
      id: 'build-infra-rc1', projectId: '9', projectKey: 'INFRA', projectName: 'Platform Infra', squadId: 'squad-2', squadName: 'Infrastructure',
      name: 'Infra Health 2026.05', buildKey: 'INFRA-2026-05', version: '2026.05.0', description: 'Monthly infrastructure health and SLA verification.', requirements: null,
      status: 'VERIFIED', initiatedAt: '2026-05-05T06:00:00Z', inProgressAt: '2026-05-05T06:30:00Z', verifiedAt: '2026-05-05T16:00:00Z',
      createdBy: 'qa-infra@example.com', verifiedBy: 'lead-infra@example.com', createdAt: '2026-05-05T06:00:00Z', updatedAt: '2026-05-05T16:00:00Z',
      metrics: { buildId: 'build-infra-rc1', totalScenarios: 13, passed: 12, failed: 0, blocked: 0, skipped: 1, notExecuted: 0, passPercentage: 100, executionCoverage: 100 }
    }
  ],
  CHECKOUT: [
    {
      id: 'build-checkout-rc1',
      projectId: '4',
      projectKey: 'CHECKOUT',
      projectName: 'Checkout Flow',
      squadId: 'squad-3',
      squadName: 'Payments',
      name: 'Checkout 2026.06 RC1',
      buildKey: 'CHECKOUT-2026-06-RC1',
      version: '2026.06.0-rc1',
      description: 'Initiator squad build coordinating checkout release.', requirements: null,
      status: 'IN_PROGRESS',
      initiatedAt: '2026-05-24T08:30:00Z',
      inProgressAt: '2026-05-24T09:00:00Z',
      verifiedAt: null,
      createdBy: 'qa-checkout@example.com',
      verifiedBy: null,
      createdAt: '2026-05-24T08:30:00Z',
      updatedAt: '2026-05-25T08:45:00Z',
      metrics: { buildId: 'build-checkout-rc1', totalScenarios: 3, passed: 2, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 66.67, executionCoverage: 66.67 }
    }
  ]
};

export const mockBuildScenariosByBuild: Record<string, BuildScenario[]> = {
  'build-payment-rc1': [
    { id: 'bs-pay-1', scenarioId: 'scenario-refund-happy', scenarioKey: 'SCN-REFUND1', name: 'Refund approved card payment', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-24T09:12:00Z', addedAt: '2026-05-24T08:05:00Z', featureName: 'Refunds', directoryPath: 'payments/refunds' },
    { id: 'bs-pay-2', scenarioId: 'scenario-refund-partial', scenarioKey: 'SCN-REFUND2', name: 'Partial refund updates remaining capturable balance', priority: 'MEDIUM', expectedStatus: 'PASSED', latestStatus: 'FAILED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-24T09:18:00Z', addedAt: '2026-05-24T08:05:00Z', featureName: 'Refunds', directoryPath: 'payments/refunds' },
    { id: 'bs-pay-3', scenarioId: 'scenario-capture-timeout', scenarioKey: 'SCN-CAPTURE1', name: 'Capture retry after processor timeout', priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'MANUAL', executedBy: 'qa-payment@example.com', executedAt: '2026-05-24T10:40:00Z', addedAt: '2026-05-24T08:06:00Z', featureName: 'Capture and Settlement', directoryPath: 'payments/capture-settlement' },
    { id: 'bs-pay-4', scenarioId: 'scenario-webhook-retry', scenarioKey: 'SCN-WEBHOOK1', name: 'Webhook retry recovers from downstream 500', priority: 'MEDIUM', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-24T09:45:00Z', addedAt: '2026-05-24T08:07:00Z', featureName: 'Webhook Reconciliation', directoryPath: 'payments/webhook-reconciliation' },
    { id: 'bs-pay-5', scenarioId: 'scenario-settlement-cutoff', scenarioKey: 'SCN-CAPTURE2', name: 'Settlement batch respects daily cutoff window', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'FAILED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-24T09:30:00Z', addedAt: '2026-05-24T08:06:00Z', featureName: 'Capture and Settlement', directoryPath: 'payments/capture-settlement' },
    { id: 'bs-pay-6', scenarioId: 'scenario-dispute-evidence', scenarioKey: 'SCN-DISPUTE1', name: 'Evidence package can be submitted before dispute deadline', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL', executedBy: null, executedAt: null, addedAt: '2026-05-24T08:08:00Z', featureName: 'Disputes', directoryPath: 'risk-disputes/disputes' }
  ],
  'build-payment-hotfix': [
    { id: 'bs-pay-hf-1', scenarioId: 'scenario-refund-happy', scenarioKey: 'SCN-REFUND1', name: 'Refund approved card payment', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-10T11:12:00Z', addedAt: '2026-05-10T07:05:00Z', featureName: 'Refunds', directoryPath: 'payments/refunds' }
  ],
  'build-auth-rc1': [
    { id: 'bs-auth-1', scenarioId: 'scenario-login-valid', scenarioKey: 'SCN-LOGIN1', name: 'User logs in with valid credentials', priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL', executedBy: null, executedAt: null, addedAt: '2026-05-25T09:00:00Z', featureName: 'Login', directoryPath: 'login' },
    { id: 'bs-auth-2', scenarioId: 'scenario-login-locked', scenarioKey: 'SCN-LOGIN2', name: 'Locked account cannot obtain access token', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL', executedBy: null, executedAt: null, addedAt: '2026-05-25T09:01:00Z', featureName: 'Login', directoryPath: 'login' },
    { id: 'bs-auth-3', scenarioId: 'scenario-session-refresh', scenarioKey: 'SCN-SESSION1', name: 'Refresh token rotation invalidates previous token', priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL', executedBy: null, executedAt: null, addedAt: '2026-05-25T09:02:00Z', featureName: 'Session Security', directoryPath: 'session-security' }
  ],
  'build-checkout-rc1': [
    { id: 'bs-chkout-1', scenarioId: 'scenario-checkout-add-item', scenarioKey: 'SCN-CHKOUT1', name: 'Add item to cart persists across sessions', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-02', executedAt: '2026-05-25T10:00:00Z', addedAt: '2026-05-24T09:00:00Z', featureName: 'Cart Operations', directoryPath: 'checkout/cart-operations' },
    { id: 'bs-chkout-2', scenarioId: 'scenario-checkout-remove-item', scenarioKey: 'SCN-CHKOUT2', name: 'Remove item from cart updates total price', priority: 'MEDIUM', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-02', executedAt: '2026-05-25T10:05:00Z', addedAt: '2026-05-24T09:01:00Z', featureName: 'Cart Operations', directoryPath: 'checkout/cart-operations' },
    { id: 'bs-chkout-3', scenarioId: 'scenario-checkout-promo-code', scenarioKey: 'SCN-CHKOUT3', name: 'Valid promo code applies discount at checkout', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL', executedBy: null, executedAt: null, addedAt: '2026-05-24T09:02:00Z', featureName: 'Promotions', directoryPath: 'checkout/promotions' }
  ]
};

export const mockBuildAuditByBuild: Record<string, BuildAuditEvent[]> = {
  'build-payment-rc1': [
    { id: 'audit-pay-1', eventType: 'BUILD_OPENED', actor: 'qa-payment@example.com', occurredAt: '2026-05-24T08:00:00Z', metadata: { buildKey: 'PAY-2026-06-RC1', name: 'Payment May RC1' } },
    { id: 'audit-pay-2', eventType: 'SCENARIO_ADDED', actor: 'qa-payment@example.com', occurredAt: '2026-05-24T08:05:00Z', metadata: { count: 6, source: 'MANUAL' } },
    { id: 'audit-pay-3', eventType: 'EXECUTION_ADDED', actor: 'ci-runner-01', occurredAt: '2026-05-24T09:12:00Z', metadata: { runId: 'run-001', merged: 4, updated: 3 } },
    { id: 'audit-pay-4', eventType: 'SCENARIO_RESULT_UPDATED', actor: 'qa-payment@example.com', occurredAt: '2026-05-24T10:40:00Z', metadata: { scenarioKey: 'SCN-CAPTURE1', previousStatus: 'NOT_EXECUTED', newStatus: 'PASSED', source: 'MANUAL', notes: 'Verified manually after environment fix' } }
  ]
};

export const mockTribes: Tribe[] = [
  { id: 'tribe-1', name: 'Platform', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-2', name: 'Commerce', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-3', name: 'Growth', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-4', name: 'Mobile', createdAt: '2026-01-01T00:00:00Z' },
];

export const mockSquads: Record<string, Squad[]> = {
  'tribe-1': [
    { id: 'squad-1', name: 'Identity', tribeId: 'tribe-1', createdAt: '2026-01-10T00:00:00Z' },
    { id: 'squad-2', name: 'Infrastructure', tribeId: 'tribe-1', createdAt: '2026-01-10T00:00:00Z' },
  ],
  'tribe-2': [
    { id: 'squad-3', name: 'Payments', tribeId: 'tribe-2', createdAt: '2026-01-15T00:00:00Z' },
    { id: 'squad-4', name: 'Catalog & Search', tribeId: 'tribe-2', createdAt: '2026-01-15T00:00:00Z' },
    { id: 'squad-6', name: 'Order Fulfillment', tribeId: 'tribe-2', createdAt: '2026-02-01T00:00:00Z' },
  ],
  'tribe-3': [
    { id: 'squad-5', name: 'Notifications', tribeId: 'tribe-3', createdAt: '2026-02-10T00:00:00Z' },
    { id: 'squad-7', name: 'Wallet & Rewards', tribeId: 'tribe-3', createdAt: '2026-02-10T00:00:00Z' },
    { id: 'squad-8', name: 'Pricing', tribeId: 'tribe-3', createdAt: '2026-02-15T00:00:00Z' },
  ],
  'tribe-4': [
    { id: 'squad-9', name: 'iOS', tribeId: 'tribe-4', createdAt: '2026-03-01T00:00:00Z' },
    { id: 'squad-10', name: 'Android', tribeId: 'tribe-4', createdAt: '2026-03-01T00:00:00Z' },
  ],
};

export const mockUsers: User[] = [
  { id: 'user-1', email: 'alice@example.com', displayName: 'Alice Johnson', createdAt: '2026-01-05T00:00:00Z' },
  { id: 'user-2', email: 'bob@example.com', displayName: 'Bob Martinez', createdAt: '2026-01-06T00:00:00Z' },
  { id: 'user-3', email: 'carol@example.com', displayName: 'Carol Kim', createdAt: '2026-01-07T00:00:00Z' },
  { id: 'user-4', email: 'david@example.com', displayName: 'David Chen', createdAt: '2026-01-08T00:00:00Z' },
];

export const passRateTrend = {
  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'],
  datasets: [{
    label: 'Pass Rate %',
    data: [72, 78, 75, 82, 85, 80, 88],
    borderColor: '#0d9488',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    fill: true,
    tension: 0.4,
    pointRadius: 4,
    pointBackgroundColor: '#0d9488',
  }]
};

export const coverageByType = {
  labels: ['Automated', 'Manual', 'Automatable', 'Not Automatable'],
  datasets: [{
    data: [45, 30, 15, 10],
    backgroundColor: ['#0d9488', '#2563eb', '#d97706', '#6b7280'],
    borderWidth: 0,
  }]
};

export const mockSquadPlans: ReleasePlan[] = [
  {
    id: 'plan-squad3-may',
    squadId: 'squad-3',
    squadName: 'Payments',
    name: 'May Release Sprint',
    releaseVersion: 'v2.5.0',
    releaseDate: '2026-05-30',
    description: 'Payment and Checkout feature hardening for May release.',
    status: 'IN_PROGRESS',
    createdAt: '2026-05-01T09:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
    openedAt: '2026-05-01T09:00:00Z',
    openedBy: 'jane.smith',
    inProgressAt: '2026-05-10T08:00:00Z',
    closedAt: null,
    closedBy: null,
    totalBuilds: 2,
    verifiedBuilds: 1,
    totalProjects: 2
  },
  {
    id: 'plan-squad1-q2',
    squadId: 'squad-1',
    squadName: 'Identity',
    name: 'Q2 Auth Hardening',
    releaseVersion: 'v3.1.0',
    releaseDate: '2026-06-15',
    description: 'OAuth2 and session security improvements.',
    status: 'OPEN',
    createdAt: '2026-05-15T11:00:00Z',
    updatedAt: '2026-05-15T11:00:00Z',
    openedAt: '2026-05-15T11:00:00Z',
    openedBy: 'john.doe',
    inProgressAt: null,
    closedAt: null,
    closedBy: null,
    totalBuilds: 0,
    verifiedBuilds: 0,
    totalProjects: 0
  },
  {
    id: 'plan-squad4-catalog',
    squadId: 'squad-4',
    squadName: 'Catalog & Search',
    name: 'Catalog Search v2 Release',
    releaseVersion: 'v1.8.0',
    releaseDate: '2026-06-01',
    description: 'Search ranking improvements and inventory sync.',
    status: 'CLOSED',
    createdAt: '2026-04-01T09:00:00Z',
    updatedAt: '2026-05-15T14:00:00Z',
    openedAt: '2026-04-01T09:00:00Z',
    openedBy: 'alice.chen',
    inProgressAt: '2026-04-10T08:00:00Z',
    closedAt: '2026-05-15T14:00:00Z',
    closedBy: 'alice.chen',
    totalBuilds: 1,
    verifiedBuilds: 1,
    totalProjects: 1
  }
];

// ── Statistics overrides ─────────────────────────────────────────────────────
// Pre-computed realistic stats per project (totalScenarios reflects full suites
// in the real system, not just the display scenarios in this mock).
export const mockStatisticsOverride: Record<string, {
  totalScenarios: number; totalAutomated: number; totalAutomatable: number;
}> = {
  PAYMENT:      { totalScenarios: 412, totalAutomated: 280, totalAutomatable: 368 },
  AUTH:         { totalScenarios: 280, totalAutomated: 195, totalAutomatable: 250 },
  CATALOG:      { totalScenarios: 356, totalAutomated: 240, totalAutomatable: 320 },
  CHECKOUT:     { totalScenarios: 298, totalAutomated: 210, totalAutomatable: 270 },
  ORDER:        { totalScenarios: 340, totalAutomated: 230, totalAutomatable: 305 },
  NOTIFICATION: { totalScenarios: 188, totalAutomated: 130, totalAutomatable: 168 },
  WALLET:       { totalScenarios: 318, totalAutomated: 215, totalAutomatable: 285 },
  SEARCH:       { totalScenarios: 275, totalAutomated: 190, totalAutomatable: 248 },
  INFRA:        { totalScenarios: 156, totalAutomated: 112, totalAutomatable: 140 },
};

export const mockTagsByProject: Record<string, TagView[]> = {
  PAYMENT: [
    { id: 'tag-refund', sanitized: 'refund', display: 'refund' },
    { id: 'tag-payment', sanitized: 'payment', display: 'payment' },
    { id: 'tag-happy-path', sanitized: 'happy-path', display: 'happy-path' },
    { id: 'tag-partial', sanitized: 'partial', display: 'partial' },
    { id: 'tag-capture', sanitized: 'capture', display: 'capture' },
    { id: 'tag-settlement', sanitized: 'settlement', display: 'settlement' },
    { id: 'tag-critical', sanitized: 'critical', display: 'critical' },
    { id: 'tag-webhook', sanitized: 'webhook', display: 'webhook' },
    { id: 'tag-retry', sanitized: 'retry', display: 'retry' },
    { id: 'tag-integration', sanitized: 'integration', display: 'integration' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
    { id: 'tag-dispute', sanitized: 'dispute', display: 'dispute' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
  ],
  AUTH: [
    { id: 'tag-login', sanitized: 'login', display: 'login' },
    { id: 'tag-session', sanitized: 'session', display: 'session' },
    { id: 'tag-security', sanitized: 'security', display: 'security' },
    { id: 'tag-oauth', sanitized: 'oauth', display: 'oauth' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
  ],
  CHECKOUT: [
    { id: 'tag-checkout', sanitized: 'checkout', display: 'checkout' },
    { id: 'tag-cart', sanitized: 'cart', display: 'cart' },
    { id: 'tag-e2e', sanitized: 'e2e', display: 'e2e' },
    { id: 'tag-promo', sanitized: 'promo', display: 'promo' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
  ],
  ORDER: [
    { id: 'tag-order', sanitized: 'order', display: 'order' },
    { id: 'tag-cancellation', sanitized: 'cancellation', display: 'cancellation' },
    { id: 'tag-lifecycle', sanitized: 'lifecycle', display: 'lifecycle' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
  ],
  CATALOG: [
    { id: 'tag-search', sanitized: 'search', display: 'search' },
    { id: 'tag-inventory', sanitized: 'inventory', display: 'inventory' },
    { id: 'tag-product', sanitized: 'product', display: 'product' },
    { id: 'tag-filter', sanitized: 'filter', display: 'filter' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
  ],
  NOTIFICATION: [
    { id: 'tag-email', sanitized: 'email', display: 'email' },
    { id: 'tag-sms', sanitized: 'sms', display: 'sms' },
    { id: 'tag-push', sanitized: 'push', display: 'push' },
    { id: 'tag-template', sanitized: 'template', display: 'template' },
    { id: 'tag-otp', sanitized: 'otp', display: 'otp' },
    { id: 'tag-retry', sanitized: 'retry', display: 'retry' },
    { id: 'tag-bounce', sanitized: 'bounce', display: 'bounce' },
    { id: 'tag-i18n', sanitized: 'i18n', display: 'i18n' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
  ],
  WALLET: [
    { id: 'tag-wallet', sanitized: 'wallet', display: 'wallet' },
    { id: 'tag-topup', sanitized: 'topup', display: 'topup' },
    { id: 'tag-withdraw', sanitized: 'withdraw', display: 'withdraw' },
    { id: 'tag-transfer', sanitized: 'transfer', display: 'transfer' },
    { id: 'tag-rewards', sanitized: 'rewards', display: 'rewards' },
    { id: 'tag-cashback', sanitized: 'cashback', display: 'cashback' },
    { id: 'tag-kyc', sanitized: 'kyc', display: 'kyc' },
    { id: 'tag-limit', sanitized: 'limit', display: 'limit' },
    { id: 'tag-idempotency', sanitized: 'idempotency', display: 'idempotency' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
  ],
  SEARCH: [
    { id: 'tag-search', sanitized: 'search', display: 'search' },
    { id: 'tag-keyword', sanitized: 'keyword', display: 'keyword' },
    { id: 'tag-filter', sanitized: 'filter', display: 'filter' },
    { id: 'tag-autocomplete', sanitized: 'autocomplete', display: 'autocomplete' },
    { id: 'tag-ranking', sanitized: 'ranking', display: 'ranking' },
    { id: 'tag-analytics', sanitized: 'analytics', display: 'analytics' },
    { id: 'tag-fuzzy', sanitized: 'fuzzy', display: 'fuzzy' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
    { id: 'tag-security', sanitized: 'security', display: 'security' },
  ],
  INFRA: [
    { id: 'tag-infra', sanitized: 'infra', display: 'infra' },
    { id: 'tag-health', sanitized: 'health', display: 'health' },
    { id: 'tag-sla', sanitized: 'sla', display: 'sla' },
    { id: 'tag-performance', sanitized: 'performance', display: 'performance' },
    { id: 'tag-uptime', sanitized: 'uptime', display: 'uptime' },
    { id: 'tag-disaster-recovery', sanitized: 'disaster-recovery', display: 'disaster-recovery' },
    { id: 'tag-backup', sanitized: 'backup', display: 'backup' },
    { id: 'tag-failover', sanitized: 'failover', display: 'failover' },
    { id: 'tag-security', sanitized: 'security', display: 'security' },
    { id: 'tag-tls', sanitized: 'tls', display: 'tls' },
    { id: 'tag-smoke', sanitized: 'smoke', display: 'smoke' },
  ],
};

export const mockPlanBuilds: Record<string, PlanBuild[]> = {
  'plan-squad3-may': [
    {
      id: 'rpb-pay-rc1',
      buildId: 'build-payment-rc1',
      buildKey: 'PAYMENT-RC1',
      buildName: 'Payment May RC1',
      buildVersion: 'v2.5.0-rc1',
      projectId: '1',
      projectKey: 'PAYMENT',
      projectName: 'Payment Service',
      squadId: 'squad-3',
      squadName: 'Payments',
      status: 'IN_PROGRESS',
      initiatedAt: '2026-05-05T09:00:00Z',
      verifiedAt: null,
      addedAt: '2026-05-05T09:00:00Z',
      addedBy: 'jane.smith',
      metrics: { totalScenarios: 145, passed: 138, failed: 5, blocked: 0, skipped: 2, notExecuted: 0, passPercentage: 95.17, executionCoverage: 100 }
    },
    {
      id: 'rpb-checkout-rc1',
      buildId: 'build-checkout-rc1',
      buildKey: 'CHECKOUT-RC1',
      buildName: 'Checkout May RC1',
      buildVersion: 'v2.5.0-rc1',
      projectId: '4',
      projectKey: 'CHECKOUT',
      projectName: 'Checkout Flow',
      squadId: 'squad-3',
      squadName: 'Payments',
      status: 'VERIFIED',
      initiatedAt: '2026-05-06T10:00:00Z',
      verifiedAt: '2026-05-18T16:00:00Z',
      addedAt: '2026-05-06T10:00:00Z',
      addedBy: 'jane.smith',
      metrics: { totalScenarios: 82, passed: 82, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 }
    }
  ],
  'plan-squad4-catalog': [
    {
      id: 'rpb-catalog-v18',
      buildId: 'build-catalog-v18',
      buildKey: 'CATALOG-V18',
      buildName: 'Catalog v1.8.0',
      buildVersion: 'v1.8.0',
      projectId: '3',
      projectKey: 'CATALOG',
      projectName: 'Product Catalog',
      squadId: 'squad-4',
      squadName: 'Catalog & Search',
      status: 'VERIFIED',
      initiatedAt: '2026-04-10T10:00:00Z',
      verifiedAt: '2026-05-14T17:00:00Z',
      addedAt: '2026-04-10T10:00:00Z',
      addedBy: 'alice.chen',
      metrics: { totalScenarios: 312, passed: 312, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 }
    }
  ]
};

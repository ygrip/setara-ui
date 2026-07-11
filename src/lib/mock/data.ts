import type { Project } from '$lib/api/projects';
import type { AutomationRun } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { PlanBuild, ReleasePlan } from '$lib/api/plans';
import type { Scenario, TagView, TestDirectory } from '$lib/api/testcases';
import type { BuildAuditEvent, BuildScenario, ProjectBuild } from '$lib/api/builds';
import type { TrackedIssueSummary } from '$lib/api/issues';

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
  { id: '9',  squadId: 'squad-2',  projectKey: 'INFRA',     name: 'Platform Infra',        description: 'Infrastructure health and SLA tests',                   createdAt: '2026-04-15T10:00:00Z' },
  { id: '10', squadId: 'squad-8',  projectKey: 'PRICING',   name: 'Pricing Engine',        description: 'Dynamic pricing rules, promotions and bulk-tier tests',  createdAt: '2026-04-20T09:00:00Z' },
  { id: '11', squadId: 'squad-9',  projectKey: 'IOS',       name: 'iOS App',               description: 'iOS client UI, navigation and integration test suite',   createdAt: '2026-04-22T10:00:00Z' },
  { id: '12', squadId: 'squad-10', projectKey: 'ANDROID',   name: 'Android App',           description: 'Android client UI, deep-links and background sync tests', createdAt: '2026-04-22T11:00:00Z' },
  { id: '13', squadId: 'squad-7',  projectKey: 'LOYALTY',   name: 'Loyalty Programme',     description: 'Points accrual, tier upgrades and redemption scenarios',   createdAt: '2026-04-28T09:00:00Z' },
  { id: '14', squadId: 'squad-2',  projectKey: 'ANALYTICS', name: 'Analytics Platform',    description: 'Event tracking, funnel and cohort analysis test scenarios', createdAt: '2026-05-02T08:00:00Z' },
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
  PRICING: [
    { id: 'run-pri-001', projectId: '10', projectKey: 'PRICING', runnerId: 'ci-runner-08', status: 'PASSED',  branch: 'main',               environment: 'staging',    framework: 'cucumber', buildId: 'build-pricing-rc1', buildKey: 'pricing-rc1', buildName: 'Pricing 2026.06 RC1', commitSha: 'pri1a2b3c', jobName: 'regression',  startedAt: '2026-05-23T08:00:00Z', finishedAt: '2026-05-23T08:16:44Z', createdAt: '2026-05-23T08:00:00Z', totalScenarios: 88, passedScenarios: 84, failedScenarios: 3, skippedScenarios: 1 },
    { id: 'run-pri-002', projectId: '10', projectKey: 'PRICING', runnerId: 'ci-runner-08', status: 'FAILED',  branch: 'feature/bulk-tiers', environment: 'staging',    framework: 'cucumber', commitSha: 'pri4d5e6f', jobName: 'smoke',       startedAt: '2026-05-22T10:00:00Z', finishedAt: '2026-05-22T10:09:11Z', createdAt: '2026-05-22T10:00:00Z', totalScenarios: 35, passedScenarios: 28, failedScenarios: 7, skippedScenarios: 0 },
    { id: 'run-pri-003', projectId: '10', projectKey: 'PRICING', runnerId: 'ci-runner-08', status: 'PASSED',  branch: 'main',               environment: 'production', framework: 'cucumber', commitSha: 'pri7g8h9i', jobName: 'smoke',       startedAt: '2026-05-21T08:00:00Z', finishedAt: '2026-05-21T08:08:22Z', createdAt: '2026-05-21T08:00:00Z', totalScenarios: 35, passedScenarios: 35, failedScenarios: 0, skippedScenarios: 0 },
    { id: 'run-pri-004', projectId: '10', projectKey: 'PRICING', runnerId: 'ci-runner-08', status: 'PASSED',  branch: 'main',               environment: 'staging',    framework: 'cucumber', commitSha: 'prij0k1l2', jobName: 'regression',  startedAt: '2026-05-20T08:00:00Z', finishedAt: '2026-05-20T08:15:10Z', createdAt: '2026-05-20T08:00:00Z', totalScenarios: 86, passedScenarios: 82, failedScenarios: 4, skippedScenarios: 0 },
  ],
  IOS: [
    { id: 'run-ios-001', projectId: '11', projectKey: 'IOS', runnerId: 'xcode-runner-01', status: 'PASSED',  branch: 'main',              environment: 'staging',    framework: 'xctest',   buildId: 'build-ios-rc1', buildKey: 'ios-rc1', buildName: 'iOS App 2026.06 RC1', commitSha: 'ios1a2b3c', jobName: 'ui-regression', startedAt: '2026-05-23T09:00:00Z', finishedAt: '2026-05-23T09:32:18Z', createdAt: '2026-05-23T09:00:00Z', totalScenarios: 120, passedScenarios: 114, failedScenarios: 4, skippedScenarios: 2 },
    { id: 'run-ios-002', projectId: '11', projectKey: 'IOS', runnerId: 'xcode-runner-01', status: 'FAILED',  branch: 'feature/biometric', environment: 'staging',    framework: 'xctest',   commitSha: 'ios4d5e6f', jobName: 'smoke',         startedAt: '2026-05-22T09:00:00Z', finishedAt: '2026-05-22T09:14:55Z', createdAt: '2026-05-22T09:00:00Z', totalScenarios: 50, passedScenarios: 41, failedScenarios: 9, skippedScenarios: 0 },
    { id: 'run-ios-003', projectId: '11', projectKey: 'IOS', runnerId: 'xcode-runner-01', status: 'PASSED',  branch: 'main',              environment: 'production', framework: 'xctest',   commitSha: 'ios7g8h9i', jobName: 'smoke',         startedAt: '2026-05-21T09:00:00Z', finishedAt: '2026-05-21T09:12:00Z', createdAt: '2026-05-21T09:00:00Z', totalScenarios: 50, passedScenarios: 50, failedScenarios: 0, skippedScenarios: 0 },
    { id: 'run-ios-004', projectId: '11', projectKey: 'IOS', runnerId: 'xcode-runner-01', status: 'PARTIAL', branch: 'main',              environment: 'staging',    framework: 'xctest',   commitSha: 'iosj0k1l2', jobName: 'ui-regression', startedAt: '2026-05-20T09:00:00Z', finishedAt: '2026-05-20T09:30:44Z', createdAt: '2026-05-20T09:00:00Z', totalScenarios: 120, passedScenarios: 100, failedScenarios: 15, skippedScenarios: 5 },
  ],
  ANDROID: [
    { id: 'run-and-001', projectId: '12', projectKey: 'ANDROID', runnerId: 'android-runner-01', status: 'PASSED',  branch: 'main',             environment: 'staging',    framework: 'espresso', buildId: 'build-android-rc1', buildKey: 'android-rc1', buildName: 'Android App 2026.06 RC1', commitSha: 'and1a2b3c', jobName: 'ui-regression', startedAt: '2026-05-23T09:30:00Z', finishedAt: '2026-05-23T10:05:22Z', createdAt: '2026-05-23T09:30:00Z', totalScenarios: 115, passedScenarios: 109, failedScenarios: 4, skippedScenarios: 2 },
    { id: 'run-and-002', projectId: '12', projectKey: 'ANDROID', runnerId: 'android-runner-01', status: 'FAILED',  branch: 'feature/deeplink', environment: 'staging',    framework: 'espresso', commitSha: 'and4d5e6f', jobName: 'smoke',         startedAt: '2026-05-22T10:00:00Z', finishedAt: '2026-05-22T10:18:30Z', createdAt: '2026-05-22T10:00:00Z', totalScenarios: 48, passedScenarios: 38, failedScenarios: 10, skippedScenarios: 0 },
    { id: 'run-and-003', projectId: '12', projectKey: 'ANDROID', runnerId: 'android-runner-01', status: 'PASSED',  branch: 'main',             environment: 'production', framework: 'espresso', commitSha: 'and7g8h9i', jobName: 'smoke',         startedAt: '2026-05-21T10:00:00Z', finishedAt: '2026-05-21T10:15:10Z', createdAt: '2026-05-21T10:00:00Z', totalScenarios: 48, passedScenarios: 48, failedScenarios: 0, skippedScenarios: 0 },
    { id: 'run-and-004', projectId: '12', projectKey: 'ANDROID', runnerId: 'android-runner-01', status: 'PASSED',  branch: 'main',             environment: 'staging',    framework: 'espresso', commitSha: 'andj0k1l2', jobName: 'ui-regression', startedAt: '2026-05-20T09:30:00Z', finishedAt: '2026-05-20T10:04:18Z', createdAt: '2026-05-20T09:30:00Z', totalScenarios: 113, passedScenarios: 108, failedScenarios: 5, skippedScenarios: 0 },
  ],
  LOYALTY: [
    { id: 'run-loy-001', projectId: '13', projectKey: 'LOYALTY', runnerId: 'ci-runner-06', status: 'PASSED',  branch: 'main',               environment: 'staging',    framework: 'cucumber', buildId: 'build-loyalty-rc1', buildKey: 'loyalty-rc1', buildName: 'Loyalty 2026.06 RC1', commitSha: 'loy1a2b3c', jobName: 'regression',  startedAt: '2026-05-23T07:30:00Z', finishedAt: '2026-05-23T07:48:55Z', createdAt: '2026-05-23T07:30:00Z', totalScenarios: 76, passedScenarios: 72, failedScenarios: 3, skippedScenarios: 1 },
    { id: 'run-loy-002', projectId: '13', projectKey: 'LOYALTY', runnerId: 'ci-runner-06', status: 'FAILED',  branch: 'feature/tier-rules', environment: 'staging',    framework: 'cucumber', commitSha: 'loy4d5e6f', jobName: 'smoke',       startedAt: '2026-05-22T08:00:00Z', finishedAt: '2026-05-22T08:10:40Z', createdAt: '2026-05-22T08:00:00Z', totalScenarios: 30, passedScenarios: 22, failedScenarios: 8, skippedScenarios: 0 },
    { id: 'run-loy-003', projectId: '13', projectKey: 'LOYALTY', runnerId: 'ci-runner-06', status: 'PASSED',  branch: 'main',               environment: 'production', framework: 'cucumber', commitSha: 'loy7g8h9i', jobName: 'smoke',       startedAt: '2026-05-21T07:30:00Z', finishedAt: '2026-05-21T07:40:05Z', createdAt: '2026-05-21T07:30:00Z', totalScenarios: 30, passedScenarios: 30, failedScenarios: 0, skippedScenarios: 0 },
  ],
  ANALYTICS: [
    { id: 'run-ana-001', projectId: '14', projectKey: 'ANALYTICS', runnerId: 'ci-runner-07', status: 'PASSED',  branch: 'main',              environment: 'staging',    framework: 'cucumber', buildId: 'build-analytics-rc1', buildKey: 'analytics-rc1', buildName: 'Analytics 2026.06 RC1', commitSha: 'ana1a2b3c', jobName: 'regression',   startedAt: '2026-05-23T06:00:00Z', finishedAt: '2026-05-23T06:20:30Z', createdAt: '2026-05-23T06:00:00Z', totalScenarios: 70, passedScenarios: 67, failedScenarios: 2, skippedScenarios: 1 },
    { id: 'run-ana-002', projectId: '14', projectKey: 'ANALYTICS', runnerId: 'ci-runner-07', status: 'FAILED',  branch: 'feature/funnels',   environment: 'staging',    framework: 'cucumber', commitSha: 'ana4d5e6f', jobName: 'smoke',        startedAt: '2026-05-22T06:00:00Z', finishedAt: '2026-05-22T06:11:22Z', createdAt: '2026-05-22T06:00:00Z', totalScenarios: 28, passedScenarios: 21, failedScenarios: 7, skippedScenarios: 0 },
    { id: 'run-ana-003', projectId: '14', projectKey: 'ANALYTICS', runnerId: 'ci-runner-07', status: 'PASSED',  branch: 'main',              environment: 'production', framework: 'cucumber', commitSha: 'ana7g8h9i', jobName: 'health-check', startedAt: '2026-05-21T06:00:00Z', finishedAt: '2026-05-21T06:18:44Z', createdAt: '2026-05-21T06:00:00Z', totalScenarios: 70, passedScenarios: 70, failedScenarios: 0, skippedScenarios: 0 },
  ],
};

export const mockApiKeysByProject: Record<string, ApiKey[]> = {
  PAYMENT:   [
    { id: 'key-001', name: 'CI Pipeline',    keyPrefix: 'stk_ci_pay',   scopes: 'automation:write', createdAt: '2026-01-20T10:00:00Z', revokedAt: null },
    { id: 'key-002', name: 'Staging Runner', keyPrefix: 'stk_stg_pay',  scopes: 'automation:write', createdAt: '2026-02-10T09:00:00Z', revokedAt: null },
  ],
  AUTH:      [{ id: 'key-003', name: 'Auth CI',         keyPrefix: 'stk_ci_auth',  scopes: 'automation:write', createdAt: '2026-02-05T11:00:00Z', revokedAt: null }],
  PRICING:   [{ id: 'key-010', name: 'Pricing CI',      keyPrefix: 'stk_ci_pri',   scopes: 'automation:write', createdAt: '2026-04-25T09:00:00Z', revokedAt: null }],
  IOS:       [{ id: 'key-011', name: 'Xcode Cloud',     keyPrefix: 'stk_xc_ios',   scopes: 'automation:write', createdAt: '2026-04-28T10:00:00Z', revokedAt: null }],
  ANDROID:   [{ id: 'key-012', name: 'Android CI',      keyPrefix: 'stk_ci_and',   scopes: 'automation:write', createdAt: '2026-04-28T11:00:00Z', revokedAt: null }],
  LOYALTY:   [{ id: 'key-013', name: 'Loyalty CI',      keyPrefix: 'stk_ci_loy',   scopes: 'automation:write', createdAt: '2026-05-03T09:00:00Z', revokedAt: null }],
  ANALYTICS: [{ id: 'key-014', name: 'Analytics CI',    keyPrefix: 'stk_ci_ana',   scopes: 'automation:write', createdAt: '2026-05-05T08:00:00Z', revokedAt: null }],
  CATALOG:   [],
  CHECKOUT:  [],
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
  PRICING: [
    { id: 'node-pri-root',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-PRI01', name: 'Pricing Rules',      slug: 'pricing-rules',   path: 'pricing-rules',              scenarioCount: 8, createdAt: '2026-04-22T00:00:00Z' },
    { id: 'node-pri-base',   parentId: 'node-pri-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-PRI02', name: 'Base Price',         slug: 'base-price',      path: 'pricing-rules/base-price',   scenarioCount: 4, createdAt: '2026-04-22T00:00:00Z' },
    { id: 'node-pri-promo',  parentId: 'node-pri-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-PRI03', name: 'Promotions',         slug: 'promotions',      path: 'pricing-rules/promotions',   scenarioCount: 4, createdAt: '2026-04-23T00:00:00Z' },
    { id: 'node-pri-bulk',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-PRI04', name: 'Bulk & Tier Pricing', slug: 'bulk-tier',      path: 'bulk-tier',                  scenarioCount: 6, createdAt: '2026-04-24T00:00:00Z' },
    { id: 'node-pri-dynamic',parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-PRI05', name: 'Dynamic Pricing',    slug: 'dynamic-pricing', path: 'dynamic-pricing',            scenarioCount: 4, createdAt: '2026-04-25T00:00:00Z' },
  ],
  IOS: [
    { id: 'node-ios-root',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-IOS01', name: 'Core Flows',       slug: 'core-flows',     path: 'core-flows',               scenarioCount: 10, createdAt: '2026-04-24T00:00:00Z' },
    { id: 'node-ios-auth',   parentId: 'node-ios-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-IOS02', name: 'Auth & Biometrics',slug: 'auth-biometrics',path: 'core-flows/auth-biometrics', scenarioCount: 5,  createdAt: '2026-04-24T00:00:00Z' },
    { id: 'node-ios-nav',    parentId: 'node-ios-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-IOS03', name: 'Navigation',       slug: 'navigation',     path: 'core-flows/navigation',     scenarioCount: 4,  createdAt: '2026-04-25T00:00:00Z' },
    { id: 'node-ios-push',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-IOS04', name: 'Push Notifications',slug: 'push-notif',    path: 'push-notifications',        scenarioCount: 4,  createdAt: '2026-04-26T00:00:00Z' },
    { id: 'node-ios-offline',parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-IOS05', name: 'Offline Mode',     slug: 'offline',        path: 'offline-mode',              scenarioCount: 3,  createdAt: '2026-04-27T00:00:00Z' },
  ],
  ANDROID: [
    { id: 'node-and-root',    parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-AND01', name: 'Core Flows',        slug: 'core-flows',     path: 'core-flows',               scenarioCount: 9,  createdAt: '2026-04-24T00:00:00Z' },
    { id: 'node-and-auth',    parentId: 'node-and-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-AND02', name: 'Auth & Biometrics', slug: 'auth-biometrics',path: 'core-flows/auth-biometrics', scenarioCount: 5,  createdAt: '2026-04-24T00:00:00Z' },
    { id: 'node-and-deeplink',parentId: 'node-and-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-AND03', name: 'Deep Links',        slug: 'deep-links',     path: 'core-flows/deep-links',     scenarioCount: 4,  createdAt: '2026-04-25T00:00:00Z' },
    { id: 'node-and-bg',      parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-AND04', name: 'Background Sync',   slug: 'bg-sync',        path: 'background-sync',           scenarioCount: 4,  createdAt: '2026-04-26T00:00:00Z' },
    { id: 'node-and-widget',  parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-AND05', name: 'Widget & Shortcut', slug: 'widget',         path: 'widget-shortcut',           scenarioCount: 3,  createdAt: '2026-04-27T00:00:00Z' },
  ],
  LOYALTY: [
    { id: 'node-loy-root',     parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-LOY01', name: 'Points & Accrual',  slug: 'points-accrual', path: 'points-accrual',           scenarioCount: 8,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-loy-earn',     parentId: 'node-loy-root',   nodeType: 'DIRECTORY', directoryId: 'DIR-LOY02', name: 'Earning Rules',     slug: 'earning-rules',  path: 'points-accrual/earning',   scenarioCount: 5,  createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-loy-tiers',    parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-LOY03', name: 'Tier Management',   slug: 'tier-mgmt',      path: 'tier-management',          scenarioCount: 5,  createdAt: '2026-05-02T00:00:00Z' },
    { id: 'node-loy-redeem',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-LOY04', name: 'Redemption',        slug: 'redemption',     path: 'redemption',               scenarioCount: 5,  createdAt: '2026-05-03T00:00:00Z' },
  ],
  ANALYTICS: [
    { id: 'node-ana-root',     parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-ANA01', name: 'Event Tracking',    slug: 'events',         path: 'events',                   scenarioCount: 7,  createdAt: '2026-05-04T00:00:00Z' },
    { id: 'node-ana-funnel',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-ANA02', name: 'Funnels',           slug: 'funnels',        path: 'funnels',                  scenarioCount: 5,  createdAt: '2026-05-05T00:00:00Z' },
    { id: 'node-ana-cohort',   parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-ANA03', name: 'Cohort Analysis',   slug: 'cohorts',        path: 'cohorts',                  scenarioCount: 4,  createdAt: '2026-05-06T00:00:00Z' },
    { id: 'node-ana-pipeline', parentId: null,              nodeType: 'DIRECTORY', directoryId: 'DIR-ANA04', name: 'Data Pipeline',     slug: 'pipeline',       path: 'data-pipeline',            scenarioCount: 4,  createdAt: '2026-05-07T00:00:00Z' },
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
  ],
  PRICING: [
    mkScenario('pri-base-list',    'node-pri-base',    'SCN-PRI1',  'List price returned for known SKU',                       'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('smoke')],                     'CRITICAL', 'ACTIVE', 'Base Price',    '2026-04-22T08:00:00Z'),
    mkScenario('pri-base-override','node-pri-base',    'SCN-PRI2',  'Merchant price override supersedes catalogue price',      'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('override'),tag('regression')], 'HIGH',     'ACTIVE', 'Base Price',    '2026-04-22T09:00:00Z'),
    mkScenario('pri-base-currency','node-pri-base',    'SCN-PRI3',  'Price is returned in requested currency',                 'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('currency')],                  'HIGH',     'ACTIVE', 'Base Price',    '2026-04-23T08:00:00Z'),
    mkScenario('pri-base-unknown', 'node-pri-base',    'SCN-PRI4',  'Unknown SKU returns 404 with error code',                 'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('validation')],                'MEDIUM',   'ACTIVE', 'Base Price',    '2026-04-23T09:00:00Z'),
    mkScenario('pri-promo-pct',    'node-pri-promo',   'SCN-PRI5',  'Percentage discount promo reduces price correctly',       'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('promo'),tag('smoke')],         'HIGH',     'ACTIVE', 'Promotions',    '2026-04-24T08:00:00Z'),
    mkScenario('pri-promo-fixed',  'node-pri-promo',   'SCN-PRI6',  'Fixed amount discount applied to eligible items only',   'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('promo'),tag('regression')],    'HIGH',     'ACTIVE', 'Promotions',    '2026-04-24T09:00:00Z'),
    mkScenario('pri-promo-stack',  'node-pri-promo',   'SCN-PRI7',  'Non-stackable promotions reject second coupon',           'MANUAL',     'AUTOMATABLE', [tag('pricing'),tag('promo'),tag('validation')],    'HIGH',     'ACTIVE', 'Promotions',    '2026-04-25T08:00:00Z'),
    mkScenario('pri-promo-expire', 'node-pri-promo',   'SCN-PRI8',  'Expired promotion code returns clear error',              'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('promo')],                     'MEDIUM',   'ACTIVE', 'Promotions',    '2026-04-25T09:00:00Z'),
    mkScenario('pri-bulk-tier1',   'node-pri-bulk',    'SCN-PRI9',  'Tier 1 bulk discount applied at threshold quantity',      'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('bulk'),tag('smoke')],          'HIGH',     'ACTIVE', 'Bulk & Tier',   '2026-04-26T08:00:00Z'),
    mkScenario('pri-bulk-tier2',   'node-pri-bulk',    'SCN-PRI10', 'Tier 2 discount replaces tier 1 at higher quantity',      'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('bulk'),tag('regression')],     'HIGH',     'ACTIVE', 'Bulk & Tier',   '2026-04-26T09:00:00Z'),
    mkScenario('pri-bulk-mixed',   'node-pri-bulk',    'SCN-PRI11', 'Mixed cart with bulk and non-bulk items prices correctly', 'MANUAL',     'AUTOMATABLE', [tag('pricing'),tag('bulk')],                      'MEDIUM',   'ACTIVE', 'Bulk & Tier',   '2026-04-27T08:00:00Z'),
    mkScenario('pri-dynamic-peak', 'node-pri-dynamic', 'SCN-PRI12', 'Dynamic surcharge applied during peak demand window',     'MANUAL',     'AUTOMATABLE', [tag('pricing'),tag('dynamic')],                   'MEDIUM',   'ACTIVE', 'Dynamic',       '2026-04-28T08:00:00Z'),
    mkScenario('pri-dynamic-floor','node-pri-dynamic', 'SCN-PRI13', 'Dynamic price never drops below configured floor',        'AUTOMATION', 'AUTOMATED',   [tag('pricing'),tag('dynamic'),tag('validation')],  'HIGH',     'ACTIVE', 'Dynamic',       '2026-04-28T09:00:00Z'),
    mkScenario('pri-dynamic-audit','node-pri-dynamic', 'SCN-PRI14', 'Each price change is recorded in the audit log',          'MANUAL',     'MANUAL_ONLY', [tag('pricing'),tag('audit')],                     'LOW',      'DRAFT',  'Dynamic',       '2026-04-29T08:00:00Z'),
  ],
  IOS: [
    mkScenario('ios-auth-biometric','node-ios-auth',   'SCN-IOS1',  'Face ID login completes within 2 seconds',                'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('biometric'),tag('smoke')],          'CRITICAL', 'ACTIVE', 'Auth',         '2026-04-24T08:00:00Z'),
    mkScenario('ios-auth-fallback', 'node-ios-auth',   'SCN-IOS2',  'Fallback to PIN when Face ID fails three times',          'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('biometric'),tag('regression')],    'HIGH',     'ACTIVE', 'Auth',         '2026-04-24T09:00:00Z'),
    mkScenario('ios-auth-token',    'node-ios-auth',   'SCN-IOS3',  'Auth token refreshes silently in background',             'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('session'),tag('regression')],       'HIGH',     'ACTIVE', 'Auth',         '2026-04-25T08:00:00Z'),
    mkScenario('ios-auth-logout',   'node-ios-auth',   'SCN-IOS4',  'Force logout clears all keychain tokens',                 'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('security')],                       'CRITICAL', 'ACTIVE', 'Auth',         '2026-04-25T09:00:00Z'),
    mkScenario('ios-auth-oauth',    'node-ios-auth',   'SCN-IOS5',  'OAuth sign-in via Google completes end-to-end',           'MANUAL',     'AUTOMATABLE', [tag('ios'),tag('oauth')],                          'HIGH',     'ACTIVE', 'Auth',         '2026-04-26T08:00:00Z'),
    mkScenario('ios-nav-tab',       'node-ios-nav',    'SCN-IOS6',  'Tab bar navigates to correct section on tap',             'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('navigation'),tag('smoke')],         'HIGH',     'ACTIVE', 'Navigation',   '2026-04-27T08:00:00Z'),
    mkScenario('ios-nav-back',      'node-ios-nav',    'SCN-IOS7',  'Back gesture returns to previous screen correctly',       'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('navigation')],                     'MEDIUM',   'ACTIVE', 'Navigation',   '2026-04-27T09:00:00Z'),
    mkScenario('ios-nav-deeplink',  'node-ios-nav',    'SCN-IOS8',  'Universal link opens correct in-app destination',         'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('navigation'),tag('deeplink')],      'HIGH',     'ACTIVE', 'Navigation',   '2026-04-28T08:00:00Z'),
    mkScenario('ios-push-receive',  'node-ios-push',   'SCN-IOS9',  'Push notification is received and displayed in tray',     'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('push'),tag('smoke')],               'HIGH',     'ACTIVE', 'Push',         '2026-04-29T08:00:00Z'),
    mkScenario('ios-push-tap',      'node-ios-push',   'SCN-IOS10', 'Tapping notification deeplinks to correct screen',        'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('push'),tag('deeplink')],            'HIGH',     'ACTIVE', 'Push',         '2026-04-29T09:00:00Z'),
    mkScenario('ios-push-badge',    'node-ios-push',   'SCN-IOS11', 'App badge count reflects unread notification count',      'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('push')],                           'MEDIUM',   'ACTIVE', 'Push',         '2026-04-30T08:00:00Z'),
    mkScenario('ios-offline-cache', 'node-ios-offline','SCN-IOS12', 'Previously viewed content available offline',             'MANUAL',     'AUTOMATABLE', [tag('ios'),tag('offline'),tag('cache')],            'HIGH',     'ACTIVE', 'Offline',      '2026-05-01T08:00:00Z'),
    mkScenario('ios-offline-sync',  'node-ios-offline','SCN-IOS13', 'Pending actions sync to server on reconnection',          'MANUAL',     'AUTOMATABLE', [tag('ios'),tag('offline'),tag('sync')],             'HIGH',     'ACTIVE', 'Offline',      '2026-05-01T09:00:00Z'),
    mkScenario('ios-offline-banner','node-ios-offline','SCN-IOS14', 'Offline banner shown when network is unavailable',        'AUTOMATION', 'AUTOMATED',   [tag('ios'),tag('offline')],                        'MEDIUM',   'DRAFT',  'Offline',      '2026-05-02T08:00:00Z'),
  ],
  ANDROID: [
    mkScenario('and-auth-biometric','node-and-auth',    'SCN-AND1',  'Fingerprint login completes within 2 seconds',            'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('biometric'),tag('smoke')],     'CRITICAL', 'ACTIVE', 'Auth',          '2026-04-24T08:00:00Z'),
    mkScenario('and-auth-fallback', 'node-and-auth',    'SCN-AND2',  'Fallback to PIN when fingerprint fails three times',       'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('biometric'),tag('regression')],'HIGH',     'ACTIVE', 'Auth',          '2026-04-24T09:00:00Z'),
    mkScenario('and-auth-token',    'node-and-auth',    'SCN-AND3',  'Auth token refreshes silently in background',             'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('session'),tag('regression')],  'HIGH',     'ACTIVE', 'Auth',          '2026-04-25T08:00:00Z'),
    mkScenario('and-auth-logout',   'node-and-auth',    'SCN-AND4',  'Force logout clears all account manager tokens',          'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('security')],                   'CRITICAL', 'ACTIVE', 'Auth',          '2026-04-25T09:00:00Z'),
    mkScenario('and-auth-oauth',    'node-and-auth',    'SCN-AND5',  'OAuth sign-in via Google completes end-to-end',           'MANUAL',     'AUTOMATABLE', [tag('android'),tag('oauth')],                      'HIGH',     'ACTIVE', 'Auth',          '2026-04-26T08:00:00Z'),
    mkScenario('and-deep-scheme',   'node-and-deeplink','SCN-AND6',  'Custom URI scheme opens correct in-app destination',      'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('deeplink'),tag('smoke')],       'HIGH',     'ACTIVE', 'Deep Links',    '2026-04-27T08:00:00Z'),
    mkScenario('and-deep-applink',  'node-and-deeplink','SCN-AND7',  'Verified App Link bypasses disambiguation dialog',        'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('deeplink'),tag('regression')],  'HIGH',     'ACTIVE', 'Deep Links',    '2026-04-27T09:00:00Z'),
    mkScenario('and-deep-backstack','node-and-deeplink','SCN-AND8',  'Back stack is correct after deep-link navigation',        'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('deeplink'),tag('navigation')],  'MEDIUM',   'ACTIVE', 'Deep Links',    '2026-04-28T08:00:00Z'),
    mkScenario('and-bg-sync',       'node-and-bg',      'SCN-AND9',  'WorkManager job syncs data in background correctly',      'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('background'),tag('sync')],      'HIGH',     'ACTIVE', 'Background',    '2026-04-29T08:00:00Z'),
    mkScenario('and-bg-battery',    'node-and-bg',      'SCN-AND10', 'Doze mode does not prevent critical sync tasks',          'MANUAL',     'AUTOMATABLE', [tag('android'),tag('background'),tag('battery')],   'HIGH',     'ACTIVE', 'Background',    '2026-04-29T09:00:00Z'),
    mkScenario('and-bg-retry',      'node-and-bg',      'SCN-AND11', 'Failed background sync retries with exponential backoff', 'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('background'),tag('retry')],     'MEDIUM',   'ACTIVE', 'Background',    '2026-04-30T08:00:00Z'),
    mkScenario('and-widget-render', 'node-and-widget',  'SCN-AND12', 'Home screen widget renders latest data',                  'MANUAL',     'AUTOMATABLE', [tag('android'),tag('widget')],                      'MEDIUM',   'ACTIVE', 'Widget',        '2026-05-01T08:00:00Z'),
    mkScenario('and-widget-tap',    'node-and-widget',  'SCN-AND13', 'Widget tap opens app at correct screen',                  'AUTOMATION', 'AUTOMATED',   [tag('android'),tag('widget'),tag('navigation')],    'MEDIUM',   'ACTIVE', 'Widget',        '2026-05-01T09:00:00Z'),
    mkScenario('and-widget-update', 'node-and-widget',  'SCN-AND14', 'Widget data refreshes every 30 minutes',                  'MANUAL',     'MANUAL_ONLY', [tag('android'),tag('widget')],                      'LOW',      'DRAFT',  'Widget',        '2026-05-02T08:00:00Z'),
  ],
  LOYALTY: [
    mkScenario('loy-earn-purchase', 'node-loy-earn',   'SCN-LOY1',  'Points credited after successful purchase',               'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('points'),tag('smoke')],         'CRITICAL', 'ACTIVE', 'Earning',       '2026-05-01T08:00:00Z'),
    mkScenario('loy-earn-rate',     'node-loy-earn',   'SCN-LOY2',  'Earn rate multiplier applied on bonus category',          'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('points'),tag('regression')],    'HIGH',     'ACTIVE', 'Earning',       '2026-05-01T09:00:00Z'),
    mkScenario('loy-earn-partial',  'node-loy-earn',   'SCN-LOY3',  'Partial refund reverses proportional points',             'MANUAL',     'AUTOMATABLE', [tag('loyalty'),tag('points'),tag('refund')],         'HIGH',     'ACTIVE', 'Earning',       '2026-05-02T08:00:00Z'),
    mkScenario('loy-earn-cap',      'node-loy-earn',   'SCN-LOY4',  'Daily earn cap prevents over-accrual',                   'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('points'),tag('limit')],          'HIGH',     'ACTIVE', 'Earning',       '2026-05-02T09:00:00Z'),
    mkScenario('loy-earn-expire',   'node-loy-earn',   'SCN-LOY5',  'Points expire after 12-month inactivity window',         'MANUAL',     'MANUAL_ONLY', [tag('loyalty'),tag('points'),tag('expiry')],         'MEDIUM',   'DRAFT',  'Earning',       '2026-05-03T08:00:00Z'),
    mkScenario('loy-tier-upgrade',  'node-loy-tiers',  'SCN-LOY6',  'Tier upgraded when threshold balance is crossed',        'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('tier'),tag('smoke')],            'CRITICAL', 'ACTIVE', 'Tiers',         '2026-05-04T08:00:00Z'),
    mkScenario('loy-tier-perks',    'node-loy-tiers',  'SCN-LOY7',  'Gold tier unlocks free shipping perk',                   'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('tier'),tag('perk')],             'HIGH',     'ACTIVE', 'Tiers',         '2026-05-04T09:00:00Z'),
    mkScenario('loy-tier-downgrade','node-loy-tiers',  'SCN-LOY8',  'Tier downgrade runs at annual review if below threshold', 'MANUAL',     'AUTOMATABLE', [tag('loyalty'),tag('tier')],                         'MEDIUM',   'ACTIVE', 'Tiers',         '2026-05-05T08:00:00Z'),
    mkScenario('loy-redeem-partial','node-loy-redeem', 'SCN-LOY9',  'Partial redemption deducts correct points balance',       'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('redemption'),tag('smoke')],      'CRITICAL', 'ACTIVE', 'Redemption',    '2026-05-06T08:00:00Z'),
    mkScenario('loy-redeem-full',   'node-loy-redeem', 'SCN-LOY10', 'Full redemption zeroes balance without negative balance', 'AUTOMATION', 'AUTOMATED',   [tag('loyalty'),tag('redemption'),tag('regression')], 'HIGH',     'ACTIVE', 'Redemption',    '2026-05-06T09:00:00Z'),
    mkScenario('loy-redeem-expired','node-loy-redeem', 'SCN-LOY11', 'Redemption with expired points shows clear error',        'MANUAL',     'AUTOMATABLE', [tag('loyalty'),tag('redemption')],                   'MEDIUM',   'ACTIVE', 'Redemption',    '2026-05-07T08:00:00Z'),
    mkScenario('loy-redeem-voucher','node-loy-redeem', 'SCN-LOY12', 'Points converted to voucher code for third-party use',    'MANUAL',     'AUTOMATABLE', [tag('loyalty'),tag('redemption'),tag('voucher')],    'MEDIUM',   'DRAFT',  'Redemption',    '2026-05-07T09:00:00Z'),
  ],
  ANALYTICS: [
    mkScenario('ana-evt-pageview',  'node-ana-root',    'SCN-ANA1',  'Page-view event is logged with correct metadata',         'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('events'),tag('smoke')],        'CRITICAL', 'ACTIVE', 'Events',        '2026-05-04T08:00:00Z'),
    mkScenario('ana-evt-custom',    'node-ana-root',    'SCN-ANA2',  'Custom event payload is validated against schema',        'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('events'),tag('validation')],   'HIGH',     'ACTIVE', 'Events',        '2026-05-04T09:00:00Z'),
    mkScenario('ana-evt-dedup',     'node-ana-root',    'SCN-ANA3',  'Duplicate event within idempotency window is dropped',    'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('events'),tag('idempotency')],  'HIGH',     'ACTIVE', 'Events',        '2026-05-05T08:00:00Z'),
    mkScenario('ana-evt-latency',   'node-ana-root',    'SCN-ANA4',  'Event ingestion latency stays below 500ms p99',           'MANUAL',     'AUTOMATABLE', [tag('analytics'),tag('events'),tag('performance')],  'HIGH',     'ACTIVE', 'Events',        '2026-05-05T09:00:00Z'),
    mkScenario('ana-funnel-basic',  'node-ana-funnel',  'SCN-ANA5',  'Funnel conversion rate calculated correctly',             'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('funnel'),tag('smoke')],         'HIGH',     'ACTIVE', 'Funnels',       '2026-05-06T08:00:00Z'),
    mkScenario('ana-funnel-drop',   'node-ana-funnel',  'SCN-ANA6',  'Drop-off at each funnel step is correctly identified',    'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('funnel'),tag('regression')],   'HIGH',     'ACTIVE', 'Funnels',       '2026-05-06T09:00:00Z'),
    mkScenario('ana-funnel-segment','node-ana-funnel',  'SCN-ANA7',  'Funnel filtered by user segment returns subset data',     'MANUAL',     'AUTOMATABLE', [tag('analytics'),tag('funnel'),tag('segment')],      'MEDIUM',   'ACTIVE', 'Funnels',       '2026-05-07T08:00:00Z'),
    mkScenario('ana-cohort-define', 'node-ana-cohort',  'SCN-ANA8',  'Cohort definition saves and applies retention window',    'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('cohort'),tag('smoke')],         'HIGH',     'ACTIVE', 'Cohorts',       '2026-05-08T08:00:00Z'),
    mkScenario('ana-cohort-chart',  'node-ana-cohort',  'SCN-ANA9',  'Cohort retention chart renders data for 12 weeks',        'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('cohort')],                     'MEDIUM',   'ACTIVE', 'Cohorts',       '2026-05-08T09:00:00Z'),
    mkScenario('ana-pipeline-ingest','node-ana-pipeline','SCN-ANA10','Batch ingestion pipeline processes 1M events under 5m',   'MANUAL',     'AUTOMATABLE', [tag('analytics'),tag('pipeline'),tag('performance')], 'HIGH',     'ACTIVE', 'Pipeline',      '2026-05-09T08:00:00Z'),
    mkScenario('ana-pipeline-schema','node-ana-pipeline','SCN-ANA11','Schema evolution does not break existing downstream jobs', 'AUTOMATION', 'AUTOMATED',   [tag('analytics'),tag('pipeline'),tag('regression')],  'HIGH',     'ACTIVE', 'Pipeline',      '2026-05-09T09:00:00Z'),
    mkScenario('ana-pipeline-retry','node-ana-pipeline','SCN-ANA12', 'Failed pipeline stage retries and resumes correctly',     'MANUAL',     'AUTOMATABLE', [tag('analytics'),tag('pipeline'),tag('retry')],       'MEDIUM',   'DRAFT',  'Pipeline',      '2026-05-10T08:00:00Z'),
  ],
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
  ],
  PRICING: [
    { id: 'plan-pricing-2026-05', squadId: 'squad-8', squadName: 'Pricing', name: '2026.05 Pricing Engine Release', releaseVersion: '2026.05', releaseDate: '2026-05-28', description: 'Pricing rules and bulk tier launch verification.', status: 'IN_PROGRESS', createdAt: '2026-05-10T09:00:00Z', updatedAt: '2026-05-22T10:00:00Z', openedAt: '2026-05-10T09:00:00Z', openedBy: 'qa-pricing@example.com', inProgressAt: '2026-05-15T08:00:00Z', closedAt: null, closedBy: null },
    { id: 'plan-pricing-2026-04', squadId: 'squad-8', squadName: 'Pricing', name: '2026.04 Promo Hotfix',           releaseVersion: '2026.04.2', releaseDate: null,          description: 'Hotfix for promotional discount calculation bug.', status: 'CLOSED', createdAt: '2026-04-18T08:00:00Z', updatedAt: '2026-04-22T16:00:00Z', openedAt: '2026-04-18T08:00:00Z', openedBy: 'qa-pricing@example.com', inProgressAt: '2026-04-19T08:00:00Z', closedAt: '2026-04-22T16:00:00Z', closedBy: 'lead-pricing@example.com' },
  ],
  IOS: [
    { id: 'plan-ios-2026-05', squadId: 'squad-9', squadName: 'iOS', name: 'iOS 2026.05 Sprint', releaseVersion: '5.2.0', releaseDate: '2026-05-31', description: 'Biometric auth and deep-link improvements.', status: 'IN_PROGRESS', createdAt: '2026-05-05T09:00:00Z', updatedAt: '2026-05-24T11:00:00Z', openedAt: '2026-05-05T09:00:00Z', openedBy: 'qa-ios@example.com', inProgressAt: '2026-05-12T08:00:00Z', closedAt: null, closedBy: null },
    { id: 'plan-ios-2026-04', squadId: 'squad-9', squadName: 'iOS', name: 'iOS 2026.04 Release', releaseVersion: '5.1.0', releaseDate: null,          description: 'April feature release verification.', status: 'CLOSED', createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-30T17:00:00Z', openedAt: '2026-04-01T09:00:00Z', openedBy: 'qa-ios@example.com', inProgressAt: '2026-04-08T08:00:00Z', closedAt: '2026-04-30T17:00:00Z', closedBy: 'lead-mobile@example.com' },
  ],
  ANDROID: [
    { id: 'plan-android-2026-05', squadId: 'squad-10', squadName: 'Android', name: 'Android 2026.05 Sprint', releaseVersion: '6.2.0', releaseDate: '2026-05-31', description: 'Biometric auth and background sync improvements.', status: 'IN_PROGRESS', createdAt: '2026-05-05T10:00:00Z', updatedAt: '2026-05-24T11:00:00Z', openedAt: '2026-05-05T10:00:00Z', openedBy: 'qa-android@example.com', inProgressAt: '2026-05-12T09:00:00Z', closedAt: null, closedBy: null },
    { id: 'plan-android-2026-04', squadId: 'squad-10', squadName: 'Android', name: 'Android 2026.04 Release', releaseVersion: '6.1.0', releaseDate: null,           description: 'April feature release verification.', status: 'CLOSED', createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-30T17:00:00Z', openedAt: '2026-04-01T10:00:00Z', openedBy: 'qa-android@example.com', inProgressAt: '2026-04-08T09:00:00Z', closedAt: '2026-04-30T17:00:00Z', closedBy: 'lead-mobile@example.com' },
  ],
  LOYALTY: [
    { id: 'plan-loyalty-2026-05', squadId: 'squad-7', squadName: 'Wallet & Rewards', name: 'Loyalty 2026.05 Launch', releaseVersion: '1.0.0', releaseDate: '2026-05-29', description: 'Initial loyalty programme launch scope.', status: 'IN_PROGRESS', createdAt: '2026-05-08T09:00:00Z', updatedAt: '2026-05-23T10:00:00Z', openedAt: '2026-05-08T09:00:00Z', openedBy: 'qa-wallet@example.com', inProgressAt: '2026-05-14T08:00:00Z', closedAt: null, closedBy: null },
  ],
  ANALYTICS: [
    { id: 'plan-analytics-2026-05', squadId: 'squad-2', squadName: 'Infrastructure', name: 'Analytics Platform v1 GA', releaseVersion: '1.0.0', releaseDate: '2026-05-30', description: 'General availability of analytics event pipeline and funnels.', status: 'IN_PROGRESS', createdAt: '2026-05-10T08:00:00Z', updatedAt: '2026-05-23T09:00:00Z', openedAt: '2026-05-10T08:00:00Z', openedBy: 'qa-infra@example.com', inProgressAt: '2026-05-16T08:00:00Z', closedAt: null, closedBy: null },
    { id: 'plan-analytics-2026-04', squadId: 'squad-2', squadName: 'Infrastructure', name: 'Analytics MVP', releaseVersion: '0.9.0', releaseDate: null, description: 'MVP verification for event tracking and basic dashboards.', status: 'CLOSED', createdAt: '2026-04-10T08:00:00Z', updatedAt: '2026-04-30T16:00:00Z', openedAt: '2026-04-10T08:00:00Z', openedBy: 'qa-infra@example.com', inProgressAt: '2026-04-15T08:00:00Z', closedAt: '2026-04-30T16:00:00Z', closedBy: 'lead-infra@example.com' },
  ],
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
  ],
  PRICING: [
    { id: 'build-pricing-rc1', projectId: '10', projectKey: 'PRICING', projectName: 'Pricing Engine', squadId: 'squad-8', squadName: 'Pricing', name: 'Pricing 2026.05 RC1', buildKey: 'PRI-2026-05-RC1', version: '2026.05.0-rc1', description: 'Pricing rules and bulk-tier release verification.', requirements: null, status: 'IN_PROGRESS', initiatedAt: '2026-05-20T09:00:00Z', inProgressAt: '2026-05-20T09:30:00Z', verifiedAt: null, createdBy: 'qa-pricing@example.com', verifiedBy: null, createdAt: '2026-05-20T09:00:00Z', updatedAt: '2026-05-24T10:00:00Z', metrics: { buildId: 'build-pricing-rc1', totalScenarios: 6, passed: 4, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 66.67, executionCoverage: 83.33 } },
    { id: 'build-pricing-hf1',  projectId: '10', projectKey: 'PRICING', projectName: 'Pricing Engine', squadId: 'squad-8', squadName: 'Pricing', name: 'Promo Hotfix 2026.04.2', buildKey: 'PRI-2026-04-HF2', version: '2026.04.2', description: 'Verified hotfix for promotional calculation.', requirements: null, status: 'VERIFIED', initiatedAt: '2026-04-18T09:00:00Z', inProgressAt: '2026-04-18T09:30:00Z', verifiedAt: '2026-04-22T15:00:00Z', createdBy: 'qa-pricing@example.com', verifiedBy: 'lead-pricing@example.com', createdAt: '2026-04-18T09:00:00Z', updatedAt: '2026-04-22T15:00:00Z', metrics: { buildId: 'build-pricing-hf1', totalScenarios: 3, passed: 3, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } },
  ],
  IOS: [
    { id: 'build-ios-rc1', projectId: '11', projectKey: 'IOS', projectName: 'iOS App', squadId: 'squad-9', squadName: 'iOS', name: 'iOS 2026.05 RC1', buildKey: 'IOS-2026-05-RC1', version: '5.2.0-rc1', description: 'Biometric and deep-link verification for May release.', requirements: null, status: 'IN_PROGRESS', initiatedAt: '2026-05-20T10:00:00Z', inProgressAt: '2026-05-20T10:30:00Z', verifiedAt: null, createdBy: 'qa-ios@example.com', verifiedBy: null, createdAt: '2026-05-20T10:00:00Z', updatedAt: '2026-05-24T12:00:00Z', metrics: { buildId: 'build-ios-rc1', totalScenarios: 7, passed: 5, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 71.43, executionCoverage: 85.71 } },
    { id: 'build-ios-510', projectId: '11', projectKey: 'IOS', projectName: 'iOS App', squadId: 'squad-9', squadName: 'iOS', name: 'iOS 2026.04 Release', buildKey: 'IOS-2026-04', version: '5.1.0', description: 'April release verified build.', requirements: null, status: 'VERIFIED', initiatedAt: '2026-04-20T09:00:00Z', inProgressAt: '2026-04-20T09:30:00Z', verifiedAt: '2026-04-29T16:00:00Z', createdBy: 'qa-ios@example.com', verifiedBy: 'lead-mobile@example.com', createdAt: '2026-04-20T09:00:00Z', updatedAt: '2026-04-29T16:00:00Z', metrics: { buildId: 'build-ios-510', totalScenarios: 5, passed: 5, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } },
  ],
  ANDROID: [
    { id: 'build-android-rc1', projectId: '12', projectKey: 'ANDROID', projectName: 'Android App', squadId: 'squad-10', squadName: 'Android', name: 'Android 2026.05 RC1', buildKey: 'AND-2026-05-RC1', version: '6.2.0-rc1', description: 'Biometric and background sync verification for May release.', requirements: null, status: 'IN_PROGRESS', initiatedAt: '2026-05-20T10:00:00Z', inProgressAt: '2026-05-20T10:30:00Z', verifiedAt: null, createdBy: 'qa-android@example.com', verifiedBy: null, createdAt: '2026-05-20T10:00:00Z', updatedAt: '2026-05-24T12:00:00Z', metrics: { buildId: 'build-android-rc1', totalScenarios: 7, passed: 5, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 71.43, executionCoverage: 85.71 } },
    { id: 'build-android-610', projectId: '12', projectKey: 'ANDROID', projectName: 'Android App', squadId: 'squad-10', squadName: 'Android', name: 'Android 2026.04 Release', buildKey: 'AND-2026-04', version: '6.1.0', description: 'April release verified build.', requirements: null, status: 'VERIFIED', initiatedAt: '2026-04-20T10:00:00Z', inProgressAt: '2026-04-20T10:30:00Z', verifiedAt: '2026-04-29T16:30:00Z', createdBy: 'qa-android@example.com', verifiedBy: 'lead-mobile@example.com', createdAt: '2026-04-20T10:00:00Z', updatedAt: '2026-04-29T16:30:00Z', metrics: { buildId: 'build-android-610', totalScenarios: 5, passed: 5, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } },
  ],
  LOYALTY: [
    { id: 'build-loyalty-rc1', projectId: '13', projectKey: 'LOYALTY', projectName: 'Loyalty Programme', squadId: 'squad-7', squadName: 'Wallet & Rewards', name: 'Loyalty 2026.05 RC1', buildKey: 'LOY-2026-05-RC1', version: '1.0.0-rc1', description: 'Initial launch verification for loyalty programme.', requirements: null, status: 'IN_PROGRESS', initiatedAt: '2026-05-18T09:00:00Z', inProgressAt: '2026-05-18T09:30:00Z', verifiedAt: null, createdBy: 'qa-wallet@example.com', verifiedBy: null, createdAt: '2026-05-18T09:00:00Z', updatedAt: '2026-05-24T10:00:00Z', metrics: { buildId: 'build-loyalty-rc1', totalScenarios: 6, passed: 5, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 83.33, executionCoverage: 83.33 } },
  ],
  ANALYTICS: [
    { id: 'build-analytics-rc1', projectId: '14', projectKey: 'ANALYTICS', projectName: 'Analytics Platform', squadId: 'squad-2', squadName: 'Infrastructure', name: 'Analytics 2026.05 RC1', buildKey: 'ANA-2026-05-RC1', version: '1.0.0-rc1', description: 'GA release verification for analytics event pipeline.', requirements: null, status: 'IN_PROGRESS', initiatedAt: '2026-05-19T09:00:00Z', inProgressAt: '2026-05-19T09:30:00Z', verifiedAt: null, createdBy: 'qa-infra@example.com', verifiedBy: null, createdAt: '2026-05-19T09:00:00Z', updatedAt: '2026-05-24T10:00:00Z', metrics: { buildId: 'build-analytics-rc1', totalScenarios: 5, passed: 4, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 80, executionCoverage: 80 } },
    { id: 'build-analytics-mvp', projectId: '14', projectKey: 'ANALYTICS', projectName: 'Analytics Platform', squadId: 'squad-2', squadName: 'Infrastructure', name: 'Analytics MVP 0.9.0', buildKey: 'ANA-2026-04-MVP', version: '0.9.0', description: 'MVP verified build — event tracking and dashboards.', requirements: null, status: 'VERIFIED', initiatedAt: '2026-04-22T09:00:00Z', inProgressAt: '2026-04-22T09:30:00Z', verifiedAt: '2026-04-29T15:00:00Z', createdBy: 'qa-infra@example.com', verifiedBy: 'lead-infra@example.com', createdAt: '2026-04-22T09:00:00Z', updatedAt: '2026-04-29T15:00:00Z', metrics: { buildId: 'build-analytics-mvp', totalScenarios: 4, passed: 4, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } },
  ],
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
    { id: 'bs-chkout-1', scenarioId: 'scenario-checkout-add-item',    scenarioKey: 'SCN-CHKOUT1', name: 'Add item to cart persists across sessions',    priority: 'HIGH',   expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-02',           executedAt: '2026-05-25T10:00:00Z', addedAt: '2026-05-24T09:00:00Z', featureName: 'Cart Operations', directoryPath: 'checkout/cart-operations' },
    { id: 'bs-chkout-2', scenarioId: 'scenario-checkout-remove-item', scenarioKey: 'SCN-CHKOUT2', name: 'Remove item from cart updates total price',   priority: 'MEDIUM', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-02',           executedAt: '2026-05-25T10:05:00Z', addedAt: '2026-05-24T09:01:00Z', featureName: 'Cart Operations', directoryPath: 'checkout/cart-operations' },
    { id: 'bs-chkout-3', scenarioId: 'scenario-checkout-promo-code',  scenarioKey: 'SCN-CHKOUT3', name: 'Valid promo code applies discount at checkout', priority: 'HIGH',   expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,                     executedAt: null,                   addedAt: '2026-05-24T09:02:00Z', featureName: 'Promotions',      directoryPath: 'checkout/promotions' }
  ],
  'build-pricing-rc1': [
    { id: 'bs-pri-1', scenarioId: 'pri-base-list',    scenarioKey: 'SCN-PRI1',  name: 'List price returned for known SKU',                    priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-08', executedAt: '2026-05-21T08:10:00Z', addedAt: '2026-05-20T09:10:00Z', featureName: 'Base Price',   directoryPath: 'pricing-rules/base-price' },
    { id: 'bs-pri-2', scenarioId: 'pri-base-override', scenarioKey: 'SCN-PRI2',  name: 'Merchant price override supersedes catalogue price',  priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-08', executedAt: '2026-05-21T08:15:00Z', addedAt: '2026-05-20T09:11:00Z', featureName: 'Base Price',   directoryPath: 'pricing-rules/base-price' },
    { id: 'bs-pri-3', scenarioId: 'pri-promo-pct',    scenarioKey: 'SCN-PRI5',  name: 'Percentage discount promo reduces price correctly',    priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-08', executedAt: '2026-05-21T08:20:00Z', addedAt: '2026-05-20T09:12:00Z', featureName: 'Promotions',   directoryPath: 'pricing-rules/promotions' },
    { id: 'bs-pri-4', scenarioId: 'pri-promo-expire', scenarioKey: 'SCN-PRI8',  name: 'Expired promotion code returns clear error',           priority: 'MEDIUM',   expectedStatus: 'PASSED', latestStatus: 'FAILED',       source: 'AUTOMATION', executedBy: 'ci-runner-08', executedAt: '2026-05-21T08:25:00Z', addedAt: '2026-05-20T09:13:00Z', featureName: 'Promotions',   directoryPath: 'pricing-rules/promotions' },
    { id: 'bs-pri-5', scenarioId: 'pri-bulk-tier1',   scenarioKey: 'SCN-PRI9',  name: 'Tier 1 bulk discount applied at threshold quantity',   priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-08', executedAt: '2026-05-21T08:30:00Z', addedAt: '2026-05-20T09:14:00Z', featureName: 'Bulk & Tier',  directoryPath: 'bulk-tier' },
    { id: 'bs-pri-6', scenarioId: 'pri-promo-stack',  scenarioKey: 'SCN-PRI7',  name: 'Non-stackable promotions reject second coupon',        priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,           executedAt: null,                   addedAt: '2026-05-20T09:15:00Z', featureName: 'Promotions',   directoryPath: 'pricing-rules/promotions' },
  ],
  'build-ios-rc1': [
    { id: 'bs-ios-1', scenarioId: 'ios-auth-biometric',scenarioKey: 'SCN-IOS1',  name: 'Face ID login completes within 2 seconds',            priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:10:00Z', addedAt: '2026-05-20T10:10:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-ios-2', scenarioId: 'ios-auth-fallback', scenarioKey: 'SCN-IOS2',  name: 'Fallback to PIN when Face ID fails three times',       priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:15:00Z', addedAt: '2026-05-20T10:11:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-ios-3', scenarioId: 'ios-auth-token',    scenarioKey: 'SCN-IOS3',  name: 'Auth token refreshes silently in background',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:20:00Z', addedAt: '2026-05-20T10:12:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-ios-4', scenarioId: 'ios-nav-tab',       scenarioKey: 'SCN-IOS6',  name: 'Tab bar navigates to correct section on tap',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:25:00Z', addedAt: '2026-05-20T10:13:00Z', featureName: 'Navigation', directoryPath: 'core-flows/navigation' },
    { id: 'bs-ios-5', scenarioId: 'ios-nav-deeplink',  scenarioKey: 'SCN-IOS8',  name: 'Universal link opens correct in-app destination',      priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'FAILED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:30:00Z', addedAt: '2026-05-20T10:14:00Z', featureName: 'Navigation', directoryPath: 'core-flows/navigation' },
    { id: 'bs-ios-6', scenarioId: 'ios-push-receive',  scenarioKey: 'SCN-IOS9',  name: 'Push notification is received and displayed in tray',  priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'xcode-runner-01', executedAt: '2026-05-22T10:35:00Z', addedAt: '2026-05-20T10:15:00Z', featureName: 'Push', directoryPath: 'push-notifications' },
    { id: 'bs-ios-7', scenarioId: 'ios-offline-cache', scenarioKey: 'SCN-IOS12', name: 'Previously viewed content available offline',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,             executedAt: null,                   addedAt: '2026-05-20T10:16:00Z', featureName: 'Offline', directoryPath: 'offline-mode' },
  ],
  'build-android-rc1': [
    { id: 'bs-and-1', scenarioId: 'and-auth-biometric',scenarioKey: 'SCN-AND1',  name: 'Fingerprint login completes within 2 seconds',         priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:10:00Z', addedAt: '2026-05-20T10:10:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-and-2', scenarioId: 'and-auth-fallback', scenarioKey: 'SCN-AND2',  name: 'Fallback to PIN when fingerprint fails three times',    priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:15:00Z', addedAt: '2026-05-20T10:11:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-and-3', scenarioId: 'and-auth-token',    scenarioKey: 'SCN-AND3',  name: 'Auth token refreshes silently in background',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:20:00Z', addedAt: '2026-05-20T10:12:00Z', featureName: 'Auth', directoryPath: 'core-flows/auth-biometrics' },
    { id: 'bs-and-4', scenarioId: 'and-deep-scheme',   scenarioKey: 'SCN-AND6',  name: 'Custom URI scheme opens correct in-app destination',   priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:25:00Z', addedAt: '2026-05-20T10:13:00Z', featureName: 'Deep Links', directoryPath: 'core-flows/deep-links' },
    { id: 'bs-and-5', scenarioId: 'and-deep-applink',  scenarioKey: 'SCN-AND7',  name: 'Verified App Link bypasses disambiguation dialog',      priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'FAILED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:30:00Z', addedAt: '2026-05-20T10:14:00Z', featureName: 'Deep Links', directoryPath: 'core-flows/deep-links' },
    { id: 'bs-and-6', scenarioId: 'and-bg-sync',       scenarioKey: 'SCN-AND9',  name: 'WorkManager job syncs data in background correctly',   priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'android-runner-01', executedAt: '2026-05-22T10:35:00Z', addedAt: '2026-05-20T10:15:00Z', featureName: 'Background', directoryPath: 'background-sync' },
    { id: 'bs-and-7', scenarioId: 'and-widget-render', scenarioKey: 'SCN-AND12', name: 'Home screen widget renders latest data',                priority: 'MEDIUM',   expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,               executedAt: null,                   addedAt: '2026-05-20T10:16:00Z', featureName: 'Widget', directoryPath: 'widget-shortcut' },
  ],
  'build-loyalty-rc1': [
    { id: 'bs-loy-1', scenarioId: 'loy-earn-purchase', scenarioKey: 'SCN-LOY1',  name: 'Points credited after successful purchase',            priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-06', executedAt: '2026-05-20T09:10:00Z', addedAt: '2026-05-18T09:10:00Z', featureName: 'Earning', directoryPath: 'points-accrual/earning' },
    { id: 'bs-loy-2', scenarioId: 'loy-earn-rate',     scenarioKey: 'SCN-LOY2',  name: 'Earn rate multiplier applied on bonus category',       priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-06', executedAt: '2026-05-20T09:15:00Z', addedAt: '2026-05-18T09:11:00Z', featureName: 'Earning', directoryPath: 'points-accrual/earning' },
    { id: 'bs-loy-3', scenarioId: 'loy-tier-upgrade',  scenarioKey: 'SCN-LOY6',  name: 'Tier upgraded when threshold balance is crossed',      priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-06', executedAt: '2026-05-20T09:20:00Z', addedAt: '2026-05-18T09:12:00Z', featureName: 'Tiers', directoryPath: 'tier-management' },
    { id: 'bs-loy-4', scenarioId: 'loy-tier-perks',    scenarioKey: 'SCN-LOY7',  name: 'Gold tier unlocks free shipping perk',                 priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-06', executedAt: '2026-05-20T09:25:00Z', addedAt: '2026-05-18T09:13:00Z', featureName: 'Tiers', directoryPath: 'tier-management' },
    { id: 'bs-loy-5', scenarioId: 'loy-redeem-partial',scenarioKey: 'SCN-LOY9',  name: 'Partial redemption deducts correct points balance',    priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-06', executedAt: '2026-05-20T09:30:00Z', addedAt: '2026-05-18T09:14:00Z', featureName: 'Redemption', directoryPath: 'redemption' },
    { id: 'bs-loy-6', scenarioId: 'loy-earn-partial',  scenarioKey: 'SCN-LOY3',  name: 'Partial refund reverses proportional points',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,           executedAt: null,                   addedAt: '2026-05-18T09:15:00Z', featureName: 'Earning', directoryPath: 'points-accrual/earning' },
  ],
  'build-analytics-rc1': [
    { id: 'bs-ana-1', scenarioId: 'ana-evt-pageview',  scenarioKey: 'SCN-ANA1',  name: 'Page-view event is logged with correct metadata',      priority: 'CRITICAL', expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-07', executedAt: '2026-05-21T09:10:00Z', addedAt: '2026-05-19T09:10:00Z', featureName: 'Events',  directoryPath: 'events' },
    { id: 'bs-ana-2', scenarioId: 'ana-evt-custom',    scenarioKey: 'SCN-ANA2',  name: 'Custom event payload is validated against schema',      priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-07', executedAt: '2026-05-21T09:15:00Z', addedAt: '2026-05-19T09:11:00Z', featureName: 'Events',  directoryPath: 'events' },
    { id: 'bs-ana-3', scenarioId: 'ana-funnel-basic',  scenarioKey: 'SCN-ANA5',  name: 'Funnel conversion rate calculated correctly',          priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-07', executedAt: '2026-05-21T09:20:00Z', addedAt: '2026-05-19T09:12:00Z', featureName: 'Funnels', directoryPath: 'funnels' },
    { id: 'bs-ana-4', scenarioId: 'ana-cohort-define', scenarioKey: 'SCN-ANA8',  name: 'Cohort definition saves and applies retention window', priority: 'HIGH',     expectedStatus: 'PASSED', latestStatus: 'PASSED',       source: 'AUTOMATION', executedBy: 'ci-runner-07', executedAt: '2026-05-21T09:25:00Z', addedAt: '2026-05-19T09:13:00Z', featureName: 'Cohorts', directoryPath: 'cohorts' },
    { id: 'bs-ana-5', scenarioId: 'ana-pipeline-ingest',scenarioKey:'SCN-ANA10', name: 'Batch ingestion pipeline processes 1M events under 5m', priority: 'HIGH',    expectedStatus: 'PASSED', latestStatus: 'NOT_EXECUTED', source: 'MANUAL',     executedBy: null,           executedAt: null,                   addedAt: '2026-05-19T09:14:00Z', featureName: 'Pipeline',directoryPath: 'data-pipeline' },
  ],
};

export const mockBuildAuditByBuild: Record<string, BuildAuditEvent[]> = {
  'build-payment-rc1': [
    { id: 'audit-pay-1', eventType: 'BUILD_OPENED',            actor: 'qa-payment@example.com',  occurredAt: '2026-05-24T08:00:00Z', metadata: { buildKey: 'PAY-2026-06-RC1', name: 'Payment May RC1' } },
    { id: 'audit-pay-2', eventType: 'SCENARIO_ADDED',          actor: 'qa-payment@example.com',  occurredAt: '2026-05-24T08:05:00Z', metadata: { count: 6, source: 'MANUAL' } },
    { id: 'audit-pay-3', eventType: 'EXECUTION_ADDED',         actor: 'ci-runner-01',             occurredAt: '2026-05-24T09:12:00Z', metadata: { runId: 'run-001', merged: 4, updated: 3 } },
    { id: 'audit-pay-4', eventType: 'SCENARIO_RESULT_UPDATED', actor: 'qa-payment@example.com',  occurredAt: '2026-05-24T10:40:00Z', metadata: { scenarioKey: 'SCN-CAPTURE1', previousStatus: 'NOT_EXECUTED', newStatus: 'PASSED', source: 'MANUAL', notes: 'Verified manually after environment fix' } }
  ],
  'build-pricing-rc1': [
    { id: 'audit-pri-1', eventType: 'BUILD_OPENED',    actor: 'qa-pricing@example.com', occurredAt: '2026-05-20T09:00:00Z', metadata: { buildKey: 'PRI-2026-05-RC1', name: 'Pricing 2026.05 RC1' } },
    { id: 'audit-pri-2', eventType: 'SCENARIO_ADDED',  actor: 'qa-pricing@example.com', occurredAt: '2026-05-20T09:10:00Z', metadata: { count: 6, source: 'MIXED' } },
    { id: 'audit-pri-3', eventType: 'EXECUTION_ADDED', actor: 'ci-runner-08',           occurredAt: '2026-05-21T08:10:00Z', metadata: { runId: 'run-pri-001', merged: 5, updated: 5 } },
    { id: 'audit-pri-4', eventType: 'SCENARIO_RESULT_UPDATED', actor: 'qa-pricing@example.com', occurredAt: '2026-05-22T11:00:00Z', metadata: { scenarioKey: 'SCN-PRI8', previousStatus: 'NOT_EXECUTED', newStatus: 'FAILED', source: 'AUTOMATION', notes: 'Promo expiry check regressed after config change' } }
  ],
  'build-ios-rc1': [
    { id: 'audit-ios-1', eventType: 'BUILD_OPENED',    actor: 'qa-ios@example.com',    occurredAt: '2026-05-20T10:00:00Z', metadata: { buildKey: 'IOS-2026-05-RC1', name: 'iOS 2026.05 RC1' } },
    { id: 'audit-ios-2', eventType: 'SCENARIO_ADDED',  actor: 'qa-ios@example.com',    occurredAt: '2026-05-20T10:10:00Z', metadata: { count: 7, source: 'MIXED' } },
    { id: 'audit-ios-3', eventType: 'EXECUTION_ADDED', actor: 'xcode-runner-01',       occurredAt: '2026-05-22T10:10:00Z', metadata: { runId: 'run-ios-001', merged: 6, updated: 5 } },
    { id: 'audit-ios-4', eventType: 'SCENARIO_RESULT_UPDATED', actor: 'qa-ios@example.com', occurredAt: '2026-05-23T14:00:00Z', metadata: { scenarioKey: 'SCN-IOS8', previousStatus: 'NOT_EXECUTED', newStatus: 'FAILED', source: 'AUTOMATION', notes: 'Universal link routing broken by iOS 17.5 update' } }
  ],
  'build-android-rc1': [
    { id: 'audit-and-1', eventType: 'BUILD_OPENED',    actor: 'qa-android@example.com', occurredAt: '2026-05-20T10:00:00Z', metadata: { buildKey: 'AND-2026-05-RC1', name: 'Android 2026.05 RC1' } },
    { id: 'audit-and-2', eventType: 'SCENARIO_ADDED',  actor: 'qa-android@example.com', occurredAt: '2026-05-20T10:10:00Z', metadata: { count: 7, source: 'MIXED' } },
    { id: 'audit-and-3', eventType: 'EXECUTION_ADDED', actor: 'android-runner-01',      occurredAt: '2026-05-22T10:10:00Z', metadata: { runId: 'run-and-001', merged: 6, updated: 5 } },
    { id: 'audit-and-4', eventType: 'SCENARIO_RESULT_UPDATED', actor: 'qa-android@example.com', occurredAt: '2026-05-23T15:00:00Z', metadata: { scenarioKey: 'SCN-AND7', previousStatus: 'NOT_EXECUTED', newStatus: 'FAILED', source: 'AUTOMATION', notes: 'App link verification fails on API level 33 devices' } }
  ],
  'build-loyalty-rc1': [
    { id: 'audit-loy-1', eventType: 'BUILD_OPENED',    actor: 'qa-wallet@example.com', occurredAt: '2026-05-18T09:00:00Z', metadata: { buildKey: 'LOY-2026-05-RC1', name: 'Loyalty 2026.05 RC1' } },
    { id: 'audit-loy-2', eventType: 'SCENARIO_ADDED',  actor: 'qa-wallet@example.com', occurredAt: '2026-05-18T09:10:00Z', metadata: { count: 6, source: 'MIXED' } },
    { id: 'audit-loy-3', eventType: 'EXECUTION_ADDED', actor: 'ci-runner-06',          occurredAt: '2026-05-20T09:10:00Z', metadata: { runId: 'run-loy-001', merged: 5, updated: 5 } },
  ],
  'build-analytics-rc1': [
    { id: 'audit-ana-1', eventType: 'BUILD_OPENED',    actor: 'qa-infra@example.com',  occurredAt: '2026-05-19T09:00:00Z', metadata: { buildKey: 'ANA-2026-05-RC1', name: 'Analytics 2026.05 RC1' } },
    { id: 'audit-ana-2', eventType: 'SCENARIO_ADDED',  actor: 'qa-infra@example.com',  occurredAt: '2026-05-19T09:10:00Z', metadata: { count: 5, source: 'MIXED' } },
    { id: 'audit-ana-3', eventType: 'EXECUTION_ADDED', actor: 'ci-runner-07',          occurredAt: '2026-05-21T09:10:00Z', metadata: { runId: 'run-ana-001', merged: 4, updated: 4 } },
  ],
};

export const mockTribes: Tribe[] = [
  { id: 'tribe-1', name: 'Platform', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-2', name: 'Commerce', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-3', name: 'Growth', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-4', name: 'Mobile', createdAt: '2026-01-01T00:00:00Z' },
];

export const mockSquads: Record<string, Squad[]> = {
  'tribe-1': [
    { id: 'squad-1', name: 'Identity', tribeId: 'tribe-1', issueTrackerProjectKey: null, createdAt: '2026-01-10T00:00:00Z' },
    { id: 'squad-2', name: 'Infrastructure', tribeId: 'tribe-1', issueTrackerProjectKey: null, createdAt: '2026-01-10T00:00:00Z' },
  ],
  'tribe-2': [
    { id: 'squad-3', name: 'Payments', tribeId: 'tribe-2', issueTrackerProjectKey: 'PAY', createdAt: '2026-01-15T00:00:00Z' },
    { id: 'squad-4', name: 'Catalog & Search', tribeId: 'tribe-2', issueTrackerProjectKey: null, createdAt: '2026-01-15T00:00:00Z' },
    { id: 'squad-6', name: 'Order Fulfillment', tribeId: 'tribe-2', issueTrackerProjectKey: null, createdAt: '2026-02-01T00:00:00Z' },
  ],
  'tribe-3': [
    { id: 'squad-5', name: 'Notifications', tribeId: 'tribe-3', issueTrackerProjectKey: null, createdAt: '2026-02-10T00:00:00Z' },
    { id: 'squad-7', name: 'Wallet & Rewards', tribeId: 'tribe-3', issueTrackerProjectKey: null, createdAt: '2026-02-10T00:00:00Z' },
    { id: 'squad-8', name: 'Pricing', tribeId: 'tribe-3', issueTrackerProjectKey: null, createdAt: '2026-02-15T00:00:00Z' },
  ],
  'tribe-4': [
    { id: 'squad-9', name: 'iOS', tribeId: 'tribe-4', issueTrackerProjectKey: null, createdAt: '2026-03-01T00:00:00Z' },
    { id: 'squad-10', name: 'Android', tribeId: 'tribe-4', issueTrackerProjectKey: null, createdAt: '2026-03-01T00:00:00Z' },
  ],
};

export const mockUsers: User[] = [
  { id: 'user-1', email: 'alice@example.com', displayName: 'Alice Johnson', createdAt: '2026-01-05T00:00:00Z', disabledAt: null, pendingPasswordChange: false },
  { id: 'user-2', email: 'bob@example.com', displayName: 'Bob Martinez', createdAt: '2026-01-06T00:00:00Z', disabledAt: null, pendingPasswordChange: false },
  { id: 'user-3', email: 'carol@example.com', displayName: 'Carol Kim', createdAt: '2026-01-07T00:00:00Z', disabledAt: null, pendingPasswordChange: false },
  { id: 'user-4', email: 'david@example.com', displayName: 'David Chen', createdAt: '2026-01-08T00:00:00Z', disabledAt: null, pendingPasswordChange: false },
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
  // squad-2: Infrastructure
  { id: 'plan-squad2-infra-q2', squadId: 'squad-2', squadName: 'Infrastructure', name: 'Q2 Platform Hardening', releaseVersion: 'v2.0.0', releaseDate: '2026-06-30', description: 'Infrastructure reliability, SLA monitoring and analytics platform GA.', status: 'IN_PROGRESS', createdAt: '2026-05-01T08:00:00Z', updatedAt: '2026-05-23T09:00:00Z', openedAt: '2026-05-01T08:00:00Z', openedBy: 'bob.martinez', inProgressAt: '2026-05-12T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 2, verifiedBuilds: 0, totalProjects: 2 },
  { id: 'plan-squad2-infra-apr', squadId: 'squad-2', squadName: 'Infrastructure', name: 'April SLA Review',     releaseVersion: 'v1.9.0', releaseDate: null,          description: 'Monthly SLA verification and disaster recovery drill.', status: 'CLOSED', createdAt: '2026-04-01T08:00:00Z', updatedAt: '2026-04-30T15:00:00Z', openedAt: '2026-04-01T08:00:00Z', openedBy: 'bob.martinez', inProgressAt: '2026-04-05T08:00:00Z', closedAt: '2026-04-30T15:00:00Z', closedBy: 'lead-infra@example.com', totalBuilds: 1, verifiedBuilds: 1, totalProjects: 1 },
  // squad-5: Notifications
  { id: 'plan-squad5-notif-q2', squadId: 'squad-5', squadName: 'Notifications', name: 'Q2 Notification Suite', releaseVersion: 'v3.0.0', releaseDate: '2026-06-15', description: 'FCM push migration, template versioning and i18n improvements.', status: 'IN_PROGRESS', createdAt: '2026-05-08T09:00:00Z', updatedAt: '2026-05-23T11:00:00Z', openedAt: '2026-05-08T09:00:00Z', openedBy: 'carol.kim', inProgressAt: '2026-05-14T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 1, verifiedBuilds: 0, totalProjects: 1 },
  { id: 'plan-squad5-notif-apr', squadId: 'squad-5', squadName: 'Notifications', name: 'April Channel Audit',  releaseVersion: null,     releaseDate: null,          description: 'Bounce and retry behaviour audit across all channels.', status: 'CLOSED', createdAt: '2026-04-05T09:00:00Z', updatedAt: '2026-04-28T14:00:00Z', openedAt: '2026-04-05T09:00:00Z', openedBy: 'carol.kim', inProgressAt: '2026-04-07T08:00:00Z', closedAt: '2026-04-28T14:00:00Z', closedBy: 'lead-notif@example.com', totalBuilds: 0, verifiedBuilds: 0, totalProjects: 1 },
  // squad-6: Order Fulfillment
  { id: 'plan-squad6-order-q2', squadId: 'squad-6', squadName: 'Order Fulfillment', name: 'Q2 Order Lifecycle',    releaseVersion: 'v4.1.0', releaseDate: '2026-06-20', description: 'Returns, partial cancellation and SLA alerting for Q2.', status: 'IN_PROGRESS', createdAt: '2026-05-10T09:00:00Z', updatedAt: '2026-05-24T10:00:00Z', openedAt: '2026-05-10T09:00:00Z', openedBy: 'david.chen', inProgressAt: '2026-05-15T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 1, verifiedBuilds: 0, totalProjects: 1 },
  { id: 'plan-squad6-order-may', squadId: 'squad-6', squadName: 'Order Fulfillment', name: 'May Hotfix Validation', releaseVersion: 'v4.0.1', releaseDate: null,          description: 'Verification of cancellation-after-shipment hotfix.', status: 'CLOSED', createdAt: '2026-05-05T08:00:00Z', updatedAt: '2026-05-09T16:00:00Z', openedAt: '2026-05-05T08:00:00Z', openedBy: 'david.chen', inProgressAt: '2026-05-06T08:00:00Z', closedAt: '2026-05-09T16:00:00Z', closedBy: 'lead-order@example.com', totalBuilds: 0, verifiedBuilds: 0, totalProjects: 1 },
  // squad-7: Wallet & Rewards
  { id: 'plan-squad7-wallet-q2', squadId: 'squad-7', squadName: 'Wallet & Rewards', name: 'Q2 Wallet + Loyalty', releaseVersion: 'v2.8.0', releaseDate: '2026-06-25', description: 'Wallet KYC improvements and initial loyalty programme launch.', status: 'IN_PROGRESS', createdAt: '2026-05-08T09:00:00Z', updatedAt: '2026-05-24T10:00:00Z', openedAt: '2026-05-08T09:00:00Z', openedBy: 'alice.chen', inProgressAt: '2026-05-14T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 2, verifiedBuilds: 0, totalProjects: 2 },
  // squad-8: Pricing
  { id: 'plan-squad8-pricing-may', squadId: 'squad-8', squadName: 'Pricing', name: 'May Pricing Release',  releaseVersion: 'v1.5.0', releaseDate: '2026-05-28', description: 'Bulk tier pricing and dynamic surcharge launch.', status: 'IN_PROGRESS', createdAt: '2026-05-10T09:00:00Z', updatedAt: '2026-05-23T10:00:00Z', openedAt: '2026-05-10T09:00:00Z', openedBy: 'bob.martinez', inProgressAt: '2026-05-16T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 1, verifiedBuilds: 0, totalProjects: 1 },
  { id: 'plan-squad8-pricing-apr', squadId: 'squad-8', squadName: 'Pricing', name: 'April Promo Hotfix',   releaseVersion: 'v1.4.2', releaseDate: null,          description: 'Promotional discount calculation hotfix validation.', status: 'CLOSED', createdAt: '2026-04-18T08:00:00Z', updatedAt: '2026-04-22T16:00:00Z', openedAt: '2026-04-18T08:00:00Z', openedBy: 'bob.martinez', inProgressAt: '2026-04-19T08:00:00Z', closedAt: '2026-04-22T16:00:00Z', closedBy: 'lead-pricing@example.com', totalBuilds: 1, verifiedBuilds: 1, totalProjects: 1 },
  // squad-9: iOS
  { id: 'plan-squad9-ios-may', squadId: 'squad-9', squadName: 'iOS', name: 'iOS May Sprint',     releaseVersion: '5.2.0', releaseDate: '2026-05-31', description: 'Biometric auth, deep links and offline mode improvements.', status: 'IN_PROGRESS', createdAt: '2026-05-05T09:00:00Z', updatedAt: '2026-05-24T11:00:00Z', openedAt: '2026-05-05T09:00:00Z', openedBy: 'carol.kim', inProgressAt: '2026-05-12T08:00:00Z', closedAt: null, closedBy: null, totalBuilds: 1, verifiedBuilds: 0, totalProjects: 1 },
  { id: 'plan-squad9-ios-apr', squadId: 'squad-9', squadName: 'iOS', name: 'iOS April Release', releaseVersion: '5.1.0', releaseDate: null,          description: 'April feature release — OAuth and navigation fixes.', status: 'CLOSED', createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-30T17:00:00Z', openedAt: '2026-04-01T09:00:00Z', openedBy: 'carol.kim', inProgressAt: '2026-04-08T08:00:00Z', closedAt: '2026-04-30T17:00:00Z', closedBy: 'lead-mobile@example.com', totalBuilds: 1, verifiedBuilds: 1, totalProjects: 1 },
  // squad-10: Android
  { id: 'plan-squad10-and-may', squadId: 'squad-10', squadName: 'Android', name: 'Android May Sprint',     releaseVersion: '6.2.0', releaseDate: '2026-05-31', description: 'Biometric auth, background sync and widget improvements.', status: 'IN_PROGRESS', createdAt: '2026-05-05T10:00:00Z', updatedAt: '2026-05-24T11:00:00Z', openedAt: '2026-05-05T10:00:00Z', openedBy: 'david.chen', inProgressAt: '2026-05-12T09:00:00Z', closedAt: null, closedBy: null, totalBuilds: 1, verifiedBuilds: 0, totalProjects: 1 },
  { id: 'plan-squad10-and-apr', squadId: 'squad-10', squadName: 'Android', name: 'Android April Release', releaseVersion: '6.1.0', releaseDate: null,           description: 'April feature release — deep links and back-stack fixes.', status: 'CLOSED', createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-30T17:00:00Z', openedAt: '2026-04-01T10:00:00Z', openedBy: 'david.chen', inProgressAt: '2026-04-08T09:00:00Z', closedAt: '2026-04-30T17:00:00Z', closedBy: 'lead-mobile@example.com', totalBuilds: 1, verifiedBuilds: 1, totalProjects: 1 },
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
  PRICING:      { totalScenarios: 220, totalAutomated: 148, totalAutomatable: 196 },
  IOS:          { totalScenarios: 195, totalAutomated: 122, totalAutomatable: 170 },
  ANDROID:      { totalScenarios: 188, totalAutomated: 118, totalAutomatable: 164 },
  LOYALTY:      { totalScenarios: 165, totalAutomated: 108, totalAutomatable: 145 },
  ANALYTICS:    { totalScenarios: 142, totalAutomated:  98, totalAutomatable: 128 },
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
  PRICING: [
    { id: 'tag-pricing',    sanitized: 'pricing',    display: 'pricing' },
    { id: 'tag-promo',      sanitized: 'promo',      display: 'promo' },
    { id: 'tag-override',   sanitized: 'override',   display: 'override' },
    { id: 'tag-bulk',       sanitized: 'bulk',       display: 'bulk' },
    { id: 'tag-dynamic',    sanitized: 'dynamic',    display: 'dynamic' },
    { id: 'tag-currency',   sanitized: 'currency',   display: 'currency' },
    { id: 'tag-audit',      sanitized: 'audit',      display: 'audit' },
    { id: 'tag-smoke',      sanitized: 'smoke',      display: 'smoke' },
    { id: 'tag-regression', sanitized: 'regression', display: 'regression' },
    { id: 'tag-validation', sanitized: 'validation', display: 'validation' },
  ],
  IOS: [
    { id: 'tag-ios',         sanitized: 'ios',         display: 'ios' },
    { id: 'tag-biometric',   sanitized: 'biometric',   display: 'biometric' },
    { id: 'tag-navigation',  sanitized: 'navigation',  display: 'navigation' },
    { id: 'tag-deeplink',    sanitized: 'deeplink',    display: 'deeplink' },
    { id: 'tag-push',        sanitized: 'push',        display: 'push' },
    { id: 'tag-offline',     sanitized: 'offline',     display: 'offline' },
    { id: 'tag-oauth',       sanitized: 'oauth',       display: 'oauth' },
    { id: 'tag-session',     sanitized: 'session',     display: 'session' },
    { id: 'tag-cache',       sanitized: 'cache',       display: 'cache' },
    { id: 'tag-smoke',       sanitized: 'smoke',       display: 'smoke' },
    { id: 'tag-regression',  sanitized: 'regression',  display: 'regression' },
    { id: 'tag-security',    sanitized: 'security',    display: 'security' },
  ],
  ANDROID: [
    { id: 'tag-android',     sanitized: 'android',    display: 'android' },
    { id: 'tag-biometric',   sanitized: 'biometric',  display: 'biometric' },
    { id: 'tag-deeplink',    sanitized: 'deeplink',   display: 'deeplink' },
    { id: 'tag-navigation',  sanitized: 'navigation', display: 'navigation' },
    { id: 'tag-background',  sanitized: 'background', display: 'background' },
    { id: 'tag-sync',        sanitized: 'sync',       display: 'sync' },
    { id: 'tag-battery',     sanitized: 'battery',    display: 'battery' },
    { id: 'tag-widget',      sanitized: 'widget',     display: 'widget' },
    { id: 'tag-oauth',       sanitized: 'oauth',      display: 'oauth' },
    { id: 'tag-session',     sanitized: 'session',    display: 'session' },
    { id: 'tag-retry',       sanitized: 'retry',      display: 'retry' },
    { id: 'tag-smoke',       sanitized: 'smoke',      display: 'smoke' },
    { id: 'tag-regression',  sanitized: 'regression', display: 'regression' },
    { id: 'tag-security',    sanitized: 'security',   display: 'security' },
  ],
  LOYALTY: [
    { id: 'tag-loyalty',     sanitized: 'loyalty',    display: 'loyalty' },
    { id: 'tag-points',      sanitized: 'points',     display: 'points' },
    { id: 'tag-tier',        sanitized: 'tier',       display: 'tier' },
    { id: 'tag-perk',        sanitized: 'perk',       display: 'perk' },
    { id: 'tag-redemption',  sanitized: 'redemption', display: 'redemption' },
    { id: 'tag-expiry',      sanitized: 'expiry',     display: 'expiry' },
    { id: 'tag-voucher',     sanitized: 'voucher',    display: 'voucher' },
    { id: 'tag-refund',      sanitized: 'refund',     display: 'refund' },
    { id: 'tag-limit',       sanitized: 'limit',      display: 'limit' },
    { id: 'tag-smoke',       sanitized: 'smoke',      display: 'smoke' },
    { id: 'tag-regression',  sanitized: 'regression', display: 'regression' },
  ],
  ANALYTICS: [
    { id: 'tag-analytics',   sanitized: 'analytics',   display: 'analytics' },
    { id: 'tag-events',      sanitized: 'events',      display: 'events' },
    { id: 'tag-funnel',      sanitized: 'funnel',      display: 'funnel' },
    { id: 'tag-cohort',      sanitized: 'cohort',      display: 'cohort' },
    { id: 'tag-pipeline',    sanitized: 'pipeline',    display: 'pipeline' },
    { id: 'tag-segment',     sanitized: 'segment',     display: 'segment' },
    { id: 'tag-idempotency', sanitized: 'idempotency', display: 'idempotency' },
    { id: 'tag-performance', sanitized: 'performance', display: 'performance' },
    { id: 'tag-retry',       sanitized: 'retry',       display: 'retry' },
    { id: 'tag-validation',  sanitized: 'validation',  display: 'validation' },
    { id: 'tag-smoke',       sanitized: 'smoke',       display: 'smoke' },
    { id: 'tag-regression',  sanitized: 'regression',  display: 'regression' },
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
    { id: 'rpb-catalog-v18', buildId: 'build-catalog-v18', buildKey: 'CATALOG-V18', buildName: 'Catalog v1.8.0', buildVersion: 'v1.8.0', projectId: '3', projectKey: 'CATALOG', projectName: 'Product Catalog', squadId: 'squad-4', squadName: 'Catalog & Search', status: 'VERIFIED', initiatedAt: '2026-04-10T10:00:00Z', verifiedAt: '2026-05-14T17:00:00Z', addedAt: '2026-04-10T10:00:00Z', addedBy: 'alice.chen', metrics: { totalScenarios: 312, passed: 312, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } }
  ],
  'plan-squad2-infra-q2': [
    { id: 'rpb-infra-2026-05', buildId: 'build-infra-rc1',     buildKey: 'INFRA-2026-05',     buildName: 'Infra Health 2026.05',    buildVersion: '2026.05.0', projectId: '9',  projectKey: 'INFRA',     projectName: 'Platform Infra',      squadId: 'squad-2', squadName: 'Infrastructure', status: 'VERIFIED',    initiatedAt: '2026-05-05T06:00:00Z', verifiedAt: '2026-05-05T16:00:00Z', addedAt: '2026-05-01T08:10:00Z', addedBy: 'bob.martinez', metrics: { totalScenarios: 13, passed: 12, failed: 0, blocked: 0, skipped: 1, notExecuted: 0, passPercentage: 100, executionCoverage: 100 } },
    { id: 'rpb-ana-rc1',       buildId: 'build-analytics-rc1', buildKey: 'ANA-2026-05-RC1',   buildName: 'Analytics 2026.05 RC1',  buildVersion: '1.0.0-rc1', projectId: '14', projectKey: 'ANALYTICS', projectName: 'Analytics Platform',  squadId: 'squad-2', squadName: 'Infrastructure', status: 'IN_PROGRESS', initiatedAt: '2026-05-19T09:00:00Z', verifiedAt: null,                   addedAt: '2026-05-01T08:15:00Z', addedBy: 'bob.martinez', metrics: { totalScenarios: 5, passed: 4, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 80, executionCoverage: 80 } },
  ],
  'plan-squad5-notif-q2': [
    { id: 'rpb-notif-rc1', buildId: 'build-notif-rc1', buildKey: 'NOTIF-2026-06-RC1', buildName: 'Notification 2026.06 RC1', buildVersion: '2026.06.0-rc1', projectId: '5', projectKey: 'NOTIFICATION', projectName: 'Notification Service', squadId: 'squad-5', squadName: 'Notifications', status: 'INITIATED', initiatedAt: '2026-05-25T10:00:00Z', verifiedAt: null, addedAt: '2026-05-08T09:10:00Z', addedBy: 'carol.kim', metrics: { totalScenarios: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, passPercentage: 0, executionCoverage: 0 } },
  ],
  'plan-squad6-order-q2': [
    { id: 'rpb-order-rc1', buildId: 'build-order-rc1', buildKey: 'ORDER-2026-06-RC1', buildName: 'Order 2026.06 RC1', buildVersion: '2026.06.0-rc1', projectId: '6', projectKey: 'ORDER', projectName: 'Order Management', squadId: 'squad-6', squadName: 'Order Fulfillment', status: 'IN_PROGRESS', initiatedAt: '2026-05-24T09:00:00Z', verifiedAt: null, addedAt: '2026-05-10T09:10:00Z', addedBy: 'david.chen', metrics: { totalScenarios: 3, passed: 2, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 66.67, executionCoverage: 66.67 } },
  ],
  'plan-squad7-wallet-q2': [
    { id: 'rpb-wallet-rc1', buildId: 'build-wallet-rc1', buildKey: 'WALLET-2026-06-RC1', buildName: 'Wallet 2026.06 RC1', buildVersion: '2026.06.0-rc1', projectId: '7', projectKey: 'WALLET', projectName: 'Digital Wallet', squadId: 'squad-7', squadName: 'Wallet & Rewards', status: 'IN_PROGRESS', initiatedAt: '2026-05-24T08:00:00Z', verifiedAt: null, addedAt: '2026-05-08T09:10:00Z', addedBy: 'alice.chen', metrics: { totalScenarios: 8, passed: 6, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 75, executionCoverage: 87.5 } },
    { id: 'rpb-loyalty-rc1', buildId: 'build-loyalty-rc1', buildKey: 'LOY-2026-05-RC1', buildName: 'Loyalty 2026.05 RC1', buildVersion: '1.0.0-rc1', projectId: '13', projectKey: 'LOYALTY', projectName: 'Loyalty Programme', squadId: 'squad-7', squadName: 'Wallet & Rewards', status: 'IN_PROGRESS', initiatedAt: '2026-05-18T09:00:00Z', verifiedAt: null, addedAt: '2026-05-08T09:15:00Z', addedBy: 'alice.chen', metrics: { totalScenarios: 6, passed: 5, failed: 0, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 83.33, executionCoverage: 83.33 } },
  ],
  'plan-squad8-pricing-may': [
    { id: 'rpb-pricing-rc1', buildId: 'build-pricing-rc1', buildKey: 'PRI-2026-05-RC1', buildName: 'Pricing 2026.05 RC1', buildVersion: '2026.05.0-rc1', projectId: '10', projectKey: 'PRICING', projectName: 'Pricing Engine', squadId: 'squad-8', squadName: 'Pricing', status: 'IN_PROGRESS', initiatedAt: '2026-05-20T09:00:00Z', verifiedAt: null, addedAt: '2026-05-10T09:10:00Z', addedBy: 'bob.martinez', metrics: { totalScenarios: 6, passed: 4, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 66.67, executionCoverage: 83.33 } },
  ],
  'plan-squad9-ios-may': [
    { id: 'rpb-ios-rc1', buildId: 'build-ios-rc1', buildKey: 'IOS-2026-05-RC1', buildName: 'iOS 2026.05 RC1', buildVersion: '5.2.0-rc1', projectId: '11', projectKey: 'IOS', projectName: 'iOS App', squadId: 'squad-9', squadName: 'iOS', status: 'IN_PROGRESS', initiatedAt: '2026-05-20T10:00:00Z', verifiedAt: null, addedAt: '2026-05-05T09:10:00Z', addedBy: 'carol.kim', metrics: { totalScenarios: 7, passed: 5, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 71.43, executionCoverage: 85.71 } },
  ],
  'plan-squad10-and-may': [
    { id: 'rpb-android-rc1', buildId: 'build-android-rc1', buildKey: 'AND-2026-05-RC1', buildName: 'Android 2026.05 RC1', buildVersion: '6.2.0-rc1', projectId: '12', projectKey: 'ANDROID', projectName: 'Android App', squadId: 'squad-10', squadName: 'Android', status: 'IN_PROGRESS', initiatedAt: '2026-05-20T10:00:00Z', verifiedAt: null, addedAt: '2026-05-05T10:10:00Z', addedBy: 'david.chen', metrics: { totalScenarios: 7, passed: 5, failed: 1, blocked: 0, skipped: 0, notExecuted: 1, passPercentage: 71.43, executionCoverage: 85.71 } },
  ],
};

// ── Issue tracker (Jira) mock links ─────────────────────────────────────────
function issue(linkedIssueId: string, issueKey: string, type: string, summary: string, status: string, priority: string): TrackedIssueSummary {
  return { linkedIssueId, issueType: type, issueKey, issueSummary: summary, issueStatus: status, issuePriority: priority, issueUrl: `https://tracker.example/browse/${issueKey}` };
}

export const mockLinkedIssuesByExecution: Record<string, TrackedIssueSummary[]> = {
  'run-002': [
    issue('li-run002-1', 'QA-101', 'Bug', 'Refund flow throws 500 on partial refund', 'In Progress', 'High'),
    issue('li-run002-2', 'QA-102', 'Bug', 'Smoke test flaky on staging environment', 'Open', 'Medium'),
  ],
  'run-chk-002': [
    issue('li-runchk002-1', 'QA-201', 'Bug', 'Voucher code rejected when applied twice', 'Open', 'High'),
  ],
};

export const mockLinkedIssuesByBuild: Record<string, TrackedIssueSummary[]> = {
  'build-payment-rc1': [
    issue('li-buildpayrc1-1', 'QA-103', 'Bug', 'Build RC1 regression: currency rounding off by 1 cent', 'Open', 'Critical'),
  ],
};

export const mockLinkedIssuesByPlan: Record<string, TrackedIssueSummary[]> = {
  'plan-squad3-may': [
    issue('li-plansq3may-1', 'QA-104', 'Task', 'Confirm sign-off with payments compliance before release', 'To Do', 'Medium'),
    issue('li-plansq3may-2', 'QA-105', 'Bug', 'Checkout voucher issue blocks release candidate', 'Open', 'High'),
  ],
};

import type { Project } from '$lib/api/projects';
import type { AutomationRun } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { PlanBuild, ReleasePlan } from '$lib/api/plans';
import type { Scenario, TestDirectory } from '$lib/api/testcases';
import type { BuildAuditEvent, BuildScenario, ProjectBuild } from '$lib/api/builds';

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
  CHECKOUT: [],
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
    { id: 'node-notif-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF01', name: 'Delivery Channels', slug: 'delivery-channels', path: 'delivery-channels', scenarioCount: 3, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-notif-email', parentId: 'node-notif-root', nodeType: 'DIRECTORY', directoryId: 'DIR-NOTIF02', name: 'Email', slug: 'email', path: 'delivery-channels/email', scenarioCount: 2, createdAt: '2026-05-02T00:00:00Z' },
  ]
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
      tags: ['refund', 'regression'],
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
      tags: ['refund', 'balance'],
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
      tags: ['refund', 'idempotency'],
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
      tags: ['capture', 'resilience'],
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
      tags: ['settlement', 'batch'],
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
      tags: ['webhook', 'retry'],
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
      tags: ['dispute', 'evidence'],
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
      tags: ['dispute', 'deadline'],
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
      tags: ['auth', 'smoke'],
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
      tags: ['auth', 'security'],
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
      tags: ['auth', 'session'],
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
      tags: ['catalog', 'search', 'ranking'],
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
      tags: ['catalog', 'filter'],
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
      tags: ['catalog', 'inventory', 'stock'],
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
      tags: ['catalog', 'inventory', 'event'],
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
      tags: ['checkout', 'cart'],
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
      tags: ['checkout', 'cart', 'price'],
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
      tags: ['checkout', 'promo', 'discount'],
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
      tags: ['order', 'smoke'],
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
      tags: ['order', 'cancel'],
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
      tags: ['order', 'cancel', 'edge-case'],
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
      tags: ['notification', 'email', 'sla'],
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
      tags: ['notification', 'email', 'gdpr'],
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
    }
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
      description: 'Sprint verification build for payment release readiness.',
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
      description: 'Closed hotfix verification build.',
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
      description: 'Identity dependency build for checkout release.',
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
      description: 'Initiator squad build coordinating checkout release.',
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
    { id: 'bs-pay-hf-1', scenarioId: 'scenario-refund-happy', scenarioKey: 'SCN-REFUND1', name: 'Refund approved card payment', priority: 'HIGH', expectedStatus: 'PASSED', latestStatus: 'PASSED', source: 'AUTOMATION', executedBy: 'ci-runner-01', executedAt: '2026-05-10T11:12:00Z', addedAt: '2026-05-10T07:05:00Z' }
  ],
  'build-auth-rc1': [],
  'build-checkout-rc1': []
};

export const mockBuildAuditByBuild: Record<string, BuildAuditEvent[]> = {
  'build-payment-rc1': [
    { id: 'audit-pay-1', eventType: 'BUILD_OPENED', actor: 'qa-payment@example.com', occurredAt: '2026-05-24T08:00:00Z', metadata: { buildKey: 'PAY-2026-06-RC1' } },
    { id: 'audit-pay-2', eventType: 'SCENARIO_ADDED', actor: 'qa-payment@example.com', occurredAt: '2026-05-24T08:05:00Z', metadata: { count: 6 } },
    { id: 'audit-pay-3', eventType: 'EXECUTION_ADDED', actor: 'ci-runner-01', occurredAt: '2026-05-24T09:12:00Z', metadata: { runId: 'run-001' } }
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

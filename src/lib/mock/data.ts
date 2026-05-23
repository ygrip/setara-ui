import type { Project } from '$lib/api/projects';
import type { AutomationRun } from '$lib/api/runs';
import type { ApiKey } from '$lib/api/apikeys';
import type { Tribe, Squad, User } from '$lib/api/organization';
import type { ReleasePlan } from '$lib/api/plans';
import type { Scenario, TestNode } from '$lib/api/testcases';

export const mockProjects: Project[] = [
  { id: '1', squadId: null, projectKey: 'PAYMENT', name: 'Payment Service', description: 'Core payment gateway integration tests', createdAt: '2026-01-15T10:00:00Z' },
  { id: '2', squadId: null, projectKey: 'AUTH', name: 'Auth Service', description: 'SSO and identity management test suite', createdAt: '2026-02-01T09:00:00Z' },
  { id: '3', squadId: null, projectKey: 'CATALOG', name: 'Product Catalog', description: 'Product search and inventory scenarios', createdAt: '2026-02-20T14:00:00Z' },
  { id: '4', squadId: null, projectKey: 'CHECKOUT', name: 'Checkout Flow', description: 'End-to-end checkout automation', createdAt: '2026-03-05T11:00:00Z' },
];

export const mockRunsByProject: Record<string, AutomationRun[]> = {
  PAYMENT: [
    { id: 'run-001', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'a1b2c3d4', jobName: 'regression', startedAt: '2026-05-23T08:00:00Z', finishedAt: '2026-05-23T08:12:34Z', createdAt: '2026-05-23T08:00:00Z' },
    { id: 'run-002', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-02', status: 'FAILED', branch: 'feature/refund', environment: 'staging', framework: 'cucumber', commitSha: 'e5f6g7h8', jobName: 'smoke', startedAt: '2026-05-22T14:00:00Z', finishedAt: '2026-05-22T14:05:11Z', createdAt: '2026-05-22T14:00:00Z' },
    { id: 'run-003', projectId: '1', projectKey: 'PAYMENT', runnerId: 'ci-runner-01', status: 'PASSED', branch: 'main', environment: 'production', framework: 'cucumber', commitSha: 'i9j0k1l2', jobName: 'smoke', startedAt: '2026-05-21T09:00:00Z', finishedAt: '2026-05-21T09:08:45Z', createdAt: '2026-05-21T09:00:00Z' },
  ],
  AUTH: [
    { id: 'run-004', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'RUNNING', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: null, jobName: 'regression', startedAt: '2026-05-23T09:30:00Z', finishedAt: null, createdAt: '2026-05-23T09:30:00Z' },
    { id: 'run-005', projectId: '2', projectKey: 'AUTH', runnerId: 'ci-runner-03', status: 'PASSED', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'm3n4o5p6', jobName: 'regression', startedAt: '2026-05-22T10:00:00Z', finishedAt: '2026-05-22T10:22:00Z', createdAt: '2026-05-22T10:00:00Z' },
  ],
  CATALOG: [
    { id: 'run-006', projectId: '3', projectKey: 'CATALOG', runnerId: 'ci-runner-02', status: 'PARTIAL', branch: 'main', environment: 'staging', framework: 'cucumber', commitSha: 'q7r8s9t0', jobName: 'full-suite', startedAt: '2026-05-23T07:00:00Z', finishedAt: '2026-05-23T07:35:22Z', createdAt: '2026-05-23T07:00:00Z' },
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

export const mockNodesByProject: Record<string, TestNode[]> = {
  PAYMENT: [
    { id: 'node-pay-root', parentId: null, nodeType: 'DIRECTORY', directoryId: 'DIR-PAYMENT01', name: 'Payments', slug: 'payments', path: 'payments', createdAt: '2026-05-01T00:00:00Z' },
    { id: 'node-refund', parentId: null, nodeType: 'FEATURE', directoryId: null, name: 'Refunds', slug: 'refunds', path: 'refunds', createdAt: '2026-05-01T00:00:00Z' }
  ],
  AUTH: [
    { id: 'node-login', parentId: null, nodeType: 'FEATURE', directoryId: null, name: 'Login', slug: 'login', path: 'login', createdAt: '2026-05-01T00:00:00Z' }
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
    }
  ]
};

export const mockPlansByProject: Record<string, ReleasePlan[]> = {
  PAYMENT: [
    {
      id: 'plan-payment-2026-05',
      projectId: '1',
      projectKey: 'PAYMENT',
      name: '2026.05 Regression',
      releaseVersion: '2026.05',
      description: 'Regression scope for payment release readiness.',
      status: 'ACTIVE',
      passThreshold: 95,
      coverageThreshold: 90,
      createdAt: '2026-05-22T08:00:00Z',
      updatedAt: '2026-05-22T08:00:00Z'
    }
  ]
};

export const mockTribes: Tribe[] = [
  { id: 'tribe-1', name: 'Platform', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'tribe-2', name: 'Commerce', createdAt: '2026-01-01T00:00:00Z' },
];

export const mockSquads: Record<string, Squad[]> = {
  'tribe-1': [
    { id: 'squad-1', name: 'Identity', tribeId: 'tribe-1', createdAt: '2026-01-10T00:00:00Z' },
    { id: 'squad-2', name: 'Infrastructure', tribeId: 'tribe-1', createdAt: '2026-01-10T00:00:00Z' },
  ],
  'tribe-2': [
    { id: 'squad-3', name: 'Payments', tribeId: 'tribe-2', createdAt: '2026-01-15T00:00:00Z' },
    { id: 'squad-4', name: 'Catalog & Search', tribeId: 'tribe-2', createdAt: '2026-01-15T00:00:00Z' },
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

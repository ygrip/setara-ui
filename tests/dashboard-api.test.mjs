import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'src/lib/api/dashboard.ts'), 'utf8');
const loader = readFileSync(join(root, 'src/routes/(app)/dashboard/+page.ts'), 'utf8');

describe('Dashboard aggregate client contract', () => {
  it('uses one aggregate endpoint for every dashboard region', () => {
    assert.match(source, /apiFetch\(`\/api\/dashboard\?\$\{params\}`\)/);
    assert.match(source, /summary: DashboardSummary/);
    assert.match(source, /trends: DashboardTrendPoint\[\]/);
    assert.match(source, /attentionItems: DashboardAttentionItem\[\]/);
    assert.match(source, /projects: DashboardProjectOverview\[\]/);
    assert.equal((loader.match(/await getDashboard\(/g) ?? []).length, 1);
  });

  it('keeps mock mode aligned with period, health, trend, and attention semantics', () => {
    assert.match(source, /export function createMockDashboard/);
    assert.match(source, /previousStart/);
    assert.match(source, /function qualityHealth/);
    assert.match(source, /function mockTrends/);
    assert.match(source, /function mockAttention/);
    assert.match(source, /const unit = kind === 'percentage'[\s\S]*\? ' pts' : ''/);
    assert.match(source, /\$\{unit\} vs previous period/);
    assert.match(source, /valueLabel = 'No runs'/);
  });
});

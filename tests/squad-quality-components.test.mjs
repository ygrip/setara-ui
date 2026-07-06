import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(root, `src/lib/components/squad/${name}`), 'utf8');

describe('Squad quality components', () => {
  it('uses six shared MetricCards and truthful unavailable values', () => { const metrics = read('SquadMetricStrip.svelte'); assert.equal((metrics.match(/<MetricCard/g) ?? []).length, 6); assert.match(metrics, /'N\/A'/); assert.match(metrics, /'No runs'/); });
  it('uses adaptive percent trend and preset controls', () => { const trend = read('SquadTrendPanel.svelte'); assert.match(trend, /Math\.min\(\.\.\.values\) >= 80 \? 75 : 0/); assert.match(trend, /'7d', '30d', '90d', 'custom'/); assert.match(trend, /percentMinimum=\{minimum\}/); });
  it('keeps attention and project rows accessible', () => { assert.match(read('SquadNeedsAttention.svelte'), /<EmptyState title="All good"/); const table = read('SquadProjectsTable.svelte'); assert.match(table, /<table>/); assert.match(table, /QualityStatusBadge/); assert.match(table, /InlineProgress/); });
});

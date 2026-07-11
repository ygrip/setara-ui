import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const metricCard = readFileSync(join(root, 'src/lib/components/MetricCard.svelte'), 'utf8');
const dashboard = readFileSync(join(root, 'src/routes/(app)/dashboard/+page.svelte'), 'utf8');

describe('MetricCard decision context', () => {
  it('supports independent status, delta, progress, sparkline, and action regions', () => {
    for (const prop of [
      'statusLabel',
      'statusTone',
      'deltaLabel',
      'deltaDirection',
      'deltaPositive',
      'progressValue',
      'sparklineValues',
      'actionLabel'
    ]) {
      assert.match(metricCard, new RegExp(`\\b${prop}\\b`));
    }

    assert.match(metricCard, /role="progressbar"/);
    assert.match(metricCard, /aria-valuenow=/);
    assert.match(metricCard, /metric-delta--positive/);
    assert.match(metricCard, /metric-delta--negative/);
    assert.match(metricCard, /<Sparkline values=/);
  });

  it('uses five dashboard KPI cards with aggregate values and deltas', () => {
    for (const label of [
      'Quality health',
      'Projects',
      'Test scenarios',
      'Automation coverage',
      'Pass rate'
    ]) {
      assert.match(dashboard, new RegExp(`label="${label}"`));
    }
    assert.match(dashboard, /deltaLabel=\{summary\.qualityHealth\.deltaLabel\}/);
    assert.match(dashboard, /progressValue=\{summary\.qualityHealth\.value\}/);
    assert.doesNotMatch(dashboard, /value=\{summary\?\.totalSquads/);
  });
});

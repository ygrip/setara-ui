import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const builder = readFileSync(join(root, 'src/lib/components/qualityTrendChart.ts'), 'utf8');
const theme = readFileSync(join(root, 'src/lib/components/chartTheme.ts'), 'utf8');
const executions = readFileSync(join(root, 'src/routes/(app)/projects/[projectKey]/executions/+page.svelte'), 'utf8');

describe('Quality trend data contract', () => {
  it('keeps one volume bar and two percentage lines in stable order', () => {
    assert.equal((builder.match(/type: 'bar'/g) ?? []).length, 1);
    assert.equal((builder.match(/type: 'line'/g) ?? []).length, 2);
    assert.match(builder, /label: 'Total scenarios'[\s\S]*yAxisID: 'yVolume'[\s\S]*order: 3/);
    assert.match(builder, /label: 'Pass rate %'[\s\S]*yAxisID: 'yPercent'[\s\S]*order: 1/);
    assert.match(builder, /label: 'Automation coverage %'[\s\S]*yAxisID: 'yPercent'[\s\S]*order: 2/);
  });

  it('keeps mixed percent and volume scales centralized', () => {
    assert.match(theme, /export type CartesianAxisMode = 'percent' \| 'mixed'/);
    assert.match(theme, /percentMinimum = 0/);
    assert.match(theme, /const percentAxis = \{[\s\S]*min: percentMinimum,[\s\S]*max: 100/);
    assert.match(theme, /yPercent: \{[\s\S]*\.\.\.percentAxis/);
    assert.match(theme, /yVolume:[\s\S]*beginAtZero: true/);
    assert.match(theme, /export function compactChartNumber/);
    assert.match(executions, /yAxisID: 'yPercent'/);
    assert.match(executions, /yAxisID: 'yVolume'/);
    assert.match(executions, /axisMode="mixed"/);
  });
});

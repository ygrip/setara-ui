import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(root, `src/lib/components/projects/${name}`), 'utf8');

describe('Project listing components', () => {
  it('uses responsive four three two one column layouts', () => {
    const grid = read('ProjectGrid.svelte');
    assert.match(grid, /min-width: 768px[\s\S]*repeat\(2/);
    assert.match(grid, /min-width: 1024px[\s\S]*repeat\(3/);
    assert.match(grid, /min-width: 1280px[\s\S]*repeat\(4/);
  });

  it('exposes labeled filters and selected view state', () => {
    const toolbar = read('ProjectToolbar.svelte');
    assert.match(toolbar, /aria-label="Project controls"/);
    assert.match(toolbar, /aria-pressed=\{view === 'grid'\}/);
    assert.match(toolbar, /All statuses/);
    assert.match(toolbar, /All domains/);
  });

  it('provides semantic operational list and matching skeleton regions', () => {
    assert.match(read('ProjectListTable.svelte'), /<table>/);
    assert.match(read('ProjectListTable.svelte'), /min-width: 62rem/);
    assert.match(read('ProjectListingSkeleton.svelte'), /Loading project summary/);
  });

  it('reuses the shared MetricCard for summary metrics', () => {
    const summary = read('ProjectSummaryRow.svelte');
    assert.match(summary, /import MetricCard from '\$lib\/components\/MetricCard\.svelte'/);
    assert.equal((summary.match(/<MetricCard/g) ?? []).length, 5);
    assert.doesNotMatch(summary, /ProjectSummaryCard/);
  });
});

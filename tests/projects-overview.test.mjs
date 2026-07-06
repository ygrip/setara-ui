import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const table = read('src/lib/components/dashboard/ProjectsOverviewTable.svelte');
const dashboard = read('src/routes/(app)/dashboard/+page.svelte');

describe('Projects overview', () => {
  it('shows every operational quality column', () => {
    for (const heading of [
      'Project',
      'Scenarios',
      'Automation',
      'Pass rate',
      'Open failures',
      'Status',
      'Last activity'
    ]) {
      assert.match(table, new RegExp(`<th>${heading}</th>`));
    }
  });

  it('keeps no-runs, failure severity, status, progress, and navigation explicit', () => {
    assert.match(table, /project\.finishedExecutions === 0/);
    assert.match(table, />No runs</);
    assert.match(table, /failure-count--\{failureTone/);
    assert.match(table, /<InlineProgress/);
    assert.match(table, /<QualityStatusBadge/);
    assert.match(table, /href="\/projects\/\{project\.projectKey\}"/);
  });

  it('provides loading, error, unavailable, and empty states', () => {
    assert.match(table, /\{#if loading\}/);
    assert.match(table, /\{:else if error\}/);
    assert.match(table, /\{:else if unavailable\}/);
    assert.match(table, /\{:else if projects\.length === 0\}/);
  });

  it('wires squad attention table without inventing placeholders', () => {
    assert.match(dashboard, /squads=\{dashboard\?\.squads \?\? \[\]\}/);
    assert.match(dashboard, /loading=\{!dashboard && !dashboardError\}/);
    assert.doesNotMatch(dashboard, /Recent Projects/);
    assert.doesNotMatch(dashboard, /<DataTable>/);
  });
});

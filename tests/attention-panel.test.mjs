import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const panel = read('src/lib/components/dashboard/NeedsAttentionPanel.svelte');
const item = read('src/lib/components/dashboard/AttentionItem.svelte');
const status = read('src/lib/components/dashboard/QualityStatusBadge.svelte');
const dashboard = read('src/routes/(app)/dashboard/+page.svelte');

describe('Needs attention panel', () => {
  it('provides loading, unavailable, calm empty, and populated states', () => {
    assert.match(panel, /\{#if loading\}/);
    assert.match(panel, /\{:else if unavailable\}/);
    assert.match(panel, /import EmptyState from/);
    assert.equal((panel.match(/<EmptyState/g) ?? []).length, 2);
    assert.match(panel, /No urgent issues/);
    assert.match(panel, /Active projects are within the current quality thresholds\./);
    assert.match(panel, /\{#each items as item/);
    assert.match(panel, /role="list"/);
    assert.match(panel, /role="listitem"/);
  });

  it('makes each item a project link with non-color severity and status text', () => {
    assert.match(item, /href="\/projects\/\{item\.projectKey\}"/);
    assert.match(item, /aria-label=\{severityLabel\}/);
    assert.match(item, /<QualityStatusBadge status=\{item\.status\}/);
    assert.match(status, /Needs review/);
    assert.match(status, /High risk/);
    assert.match(status, /No runs/);
  });

  it('places the chart and attention panel in a responsive decision grid', () => {
    assert.match(dashboard, /class="decision-grid"/);
    assert.match(dashboard, /<NeedsAttentionPanel/);
    assert.match(dashboard, /@media \(max-width: 1050px\)/);
  });
});

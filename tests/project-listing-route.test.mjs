import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(join(root, 'src/routes/(app)/projects/+page.svelte'), 'utf8');
const loader = readFileSync(join(root, 'src/routes/(app)/projects/+page.ts'), 'utf8');

describe('Project listing route orchestration', () => {
  it('loads one overview contract and ignores stale requests', () => {
    assert.equal((loader.match(/await getProjectOverview\(/g) ?? []).length, 1);
    assert.match(page, /const requestId = \+\+requestSequence/);
    assert.match(page, /requestId !== requestSequence/);
    assert.match(page, /overview = \{ \.\.\.next, items: \[\.\.\.overview\.items, \.\.\.next\.items\] \}/);
  });

  it('persists view mode and preserves data during refresh errors', () => {
    assert.match(page, /setara\.projects\.viewMode/);
    assert.match(page, /localStorage\.setItem\(VIEW_MODE_KEY, value\)/);
    assert.match(page, /Showing the latest available data/);
    assert.match(page, /No projects found/);
    assert.match(page, /Clear filters/);
  });

  it('loads later pages automatically without a manual load button', () => {
    assert.match(page, /new IntersectionObserver/);
    assert.match(page, /rootMargin: '320px 0px'/);
    assert.match(page, /refresh\(current\.page\.number \+ 1, true\)/);
    assert.match(page, /bind:this=\{sentinel\}/);
    assert.doesNotMatch(page, /Load more projects/);
  });
});

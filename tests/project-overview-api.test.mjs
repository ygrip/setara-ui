import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'src/lib/api/projects.ts'), 'utf8');

describe('Project overview API contract', () => {
  it('uses one typed aggregate endpoint and omits empty filters', () => {
    assert.match(source, /export type ProjectOverviewResponse/);
    assert.match(source, /apiFetch\(`\/api\/projects\/overview\$\{suffix\}`\)/);
    assert.match(source, /if \(request\.search\?\.trim\(\)\)/);
    assert.match(source, /if \(request\.status\)/);
    assert.match(source, /if \(request\.domain\?\.trim\(\)\)/);
  });

  it('keeps deterministic mock filtering sorting and paging aligned', () => {
    assert.match(source, /export function createMockProjectOverview/);
    assert.match(source, /const statusCycle: ProjectHealthStatus\[\]/);
    assert.match(source, /item\.healthStatus === request\.status/);
    assert.match(source, /compareOverview\(left, right, sort, order\)/);
    assert.match(source, /filtered\.slice\(page \* size/);
  });
});

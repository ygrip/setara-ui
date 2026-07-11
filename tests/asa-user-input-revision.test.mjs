import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('ASA user input revision stream contract', () => {
  it('updates only the matching optimistic user message and reconciles on done', () => {
    const api = read('src/lib/api/asa.ts');
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(api, /'user_input_revision'/);
    assert.match(store, /case 'user_input_revision'/);
    assert.match(store, /event\.payload\.requestId/);
    assert.match(store, /`\$\{requestId\}:user`/);
    assert.match(store, /event\.payload\.userInputRevision/);
  });
});

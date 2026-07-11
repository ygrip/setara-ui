import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/lib/api/asa.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/lib/stores/asa.svelte.ts', import.meta.url), 'utf8');

test('reload action invalidates SvelteKit data without refreshing the document', () => {
  assert.match(api, /'reload_page:v1'/);
  assert.match(store, /actionRegistry\.set\('reload_page:v1'/);
  assert.match(store, /invalidateAll/);
  assert.doesNotMatch(store, /location\.reload/);
});

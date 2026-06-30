import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA timing event contract', () => {
  it('accepts timing events without rendering them as chat content', () => {
    const api = read('src/lib/api/asa.ts');
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(api, /'timing'/);
    assert.match(store, /case 'timing':/);
    assert.match(store, /asaLog\('chat:timing', event\.payload\)/);
    const timingCase = store.match(/case 'timing':[\s\S]*?break;/)?.[0] ?? '';
    assert.doesNotMatch(timingCase, /updateAssistant/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA API tunnel credentials', () => {
  it('sends cross-origin credentials for API fetches and chat SSE streams', () => {
    const client = read('src/lib/api/client.ts');
    const asa = read('src/lib/api/asa.ts');

    assert.match(client, /credentials: init\.credentials \?\? 'include'/);
    assert.match(client, /credentials: 'include'/);

    const chatFetch = asa.match(/fetch\(`\$\{getApiBaseUrl\(\)\}\/api\/asa\/chat`, \{[\s\S]*?\n\s*\}\);/)?.[0] ?? '';
    assert.match(chatFetch, /credentials: 'include'/);
  });
});

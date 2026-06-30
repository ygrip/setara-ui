import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('execution websocket contract', () => {
  it('does not open authenticated execution sockets without a configured token', () => {
    const realtime = read('src/lib/api/realtime.ts');
    const dashboard = read('src/routes/(app)/dashboard/+page.svelte');

    assert.match(realtime, /const token = getWebSocketToken\(\);\s*if \(!token\) return '';/);
    assert.match(dashboard, /const url = executionSocketUrl\(projectKey\);/);
    assert.match(dashboard, /if \(!isStaticMockMode\(\) && !url\) return;/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA live stream rendering', () => {
  it('renders in-flight assistant tokens as plain text until the stream completes', () => {
    const api = read('src/lib/api/asa.ts');
    const store = read('src/lib/stores/asa.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.match(api, /streaming\?: boolean/);
    assert.match(store, /role: 'assistant', content: '', timestamp, streaming: true/);
    assert.match(store, /finally \{[\s\S]*?this\.updateAssistant\(requestId, \{ streaming: false \}\)/);
    assert.match(store, /cancel\(\) \{[\s\S]*?this\.updateAssistant\(requestId, \{ streaming: false \}\)/);

    assert.match(orb, /msg\.role === 'assistant' && msg\.streaming/);
    assert.match(orb, /<div class="msg-streaming">\{msg\.content\}<\/div>/);
    assert.match(orb, /\.msg-streaming \{[\s\S]*?white-space: pre-wrap;[\s\S]*?overflow-wrap: anywhere;/);
    assert.match(orb, /:else if msg\.role === 'assistant'[\s\S]*?<div class="msg-md">\{@html renderMarkdown\(msg\.content\)\}<\/div>/);
  });
});

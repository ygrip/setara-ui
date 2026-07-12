import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('ASA sidecar model ownership', () => {
  it('keeps STT and TTS models server-side instead of shipping a stale browser cache', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const api = read('src/lib/api/asa.ts');

    assert.equal(existsSync(join(root, 'src/lib/voice/model-cache.ts')), false);
    assert.equal(existsSync(join(root, 'src/lib/voice/model-manifest.json')), false);
    assert.match(sidecar, /new SttSession\(\{/);
    assert.match(sidecar, /openSttStream\(prepared\.voiceSessionId\)/);
    assert.doesNotMatch(api, /apiFetch\('\/api\/asa\/voice\/transcribe'/);
    assert.match(api, /apiFetch\('\/api\/asa\/voice\/synthesize\/stream'/);
  });
});

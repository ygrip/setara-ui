import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA sidecar voice payload contract', () => {
  it('passes structured sidecar voice input to ASA chat', () => {
    const api = read('src/lib/api/asa.ts');
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.match(api, /source: 'moonshine' \| 'sidecar'/);
    assert.match(sidecar, /export interface SidecarTranscript/);
    assert.match(sidecar, /voiceInput: AsaVoiceInput/);
    assert.match(sidecar, /source: 'sidecar'/);
    assert.match(sidecar, /rawText: raw/);
    assert.match(sidecar, /normalizedText: normalized\.normalizedText\.trim\(\) \|\| raw/);
    assert.match(sidecar, /resolvedText: text/);
    assert.match(sidecar, /matches\.slice\(0, 20\)\.map/);
    assert.match(orb, /sidecarVoice\.onTranscript = \(text, voiceInput\) => \{ void asa\.send\(text, voiceInput\); \}/);
  });
});

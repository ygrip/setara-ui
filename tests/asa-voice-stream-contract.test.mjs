import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA voice stream contract', () => {
  it('keeps voice side effects isolated from chat stream failures', () => {
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(store, /let gotDone = false/);
    assert.match(store, /gotDone = true/);
    assert.match(store, /if \(gotDone \|\| fullContent\.trim\(\)\.length > 0\) \{\s*ok = true;/);
    assert.match(store, /private safeVoiceCall\(label: string, fn: \(\) => void\): boolean/);
    assert.match(store, /this\.safeVoiceCall\('beginSpeech', \(\) => sidecarVoice\.beginSpeech\(\)\)/);
    assert.match(store, /gotSpeech = this\.safeVoiceCall\('speakText', \(\) => sidecarVoice\.speakText\(speechText\)\)/);
    assert.match(store, /this\.safeVoiceCall\('stopAudio', \(\) => sidecarVoice\.stopAudio\(\)\)/);
    assert.match(store, /this\.safeVoiceCall\('endTurn', \(\) =>\s*sidecarVoice\.endTurn/);

    const speechCase = store.match(/case 'speech': \{[\s\S]*?break;\n\s*\}/)?.[0] ?? '';
    assert.doesNotMatch(speechCase, /sidecarVoice\.speakText\(String\(event\.payload\.text/);
  });

  it('flushes a final buffered SSE data line before closing the reader', () => {
    const api = read('src/lib/api/asa.ts');

    assert.match(api, /const enqueueLine = \(line: string\) =>/);
    assert.match(api, /buf \+= decoder\.decode\(\)/);
    assert.match(api, /if \(buf\.trim\(\)\) \{\s*for \(const line of buf\.split\('\\n'\)\) enqueueLine\(line\);/);
  });
});

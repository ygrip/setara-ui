import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA lightweight hands-free contracts', () => {
  it('does not load Silero ML VAD unless explicitly opted in', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(sidecar, /const ML_VAD_PREF_KEY = 'setara\.asa\.voice\.mlVad'/);
    assert.match(sidecar, /private shouldUseMlVad\(\): boolean/);
    assert.match(sidecar, /localStorage\.getItem\(ML_VAD_PREF_KEY\) === '1'/);
    assert.match(sidecar, /if \(this\.shouldUseMlVad\(\)\) \{[\s\S]*const vad = await createMlVad/);
    assert.match(sidecar, /this\.micVad = vad/);
  });

  it('disconnects energy VAD nodes and keeps the mic stream across ignored listening cycles', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(sidecar, /private vadSource: MediaStreamAudioSourceNode \| null = null/);
    assert.match(sidecar, /try \{ this\.vadSource\?\.disconnect\(\); \} catch/);
    assert.match(sidecar, /this\.vadSource = null/);
    assert.match(sidecar, /private rearmAfterNoise\(tooShort: boolean, tooQuiet: boolean\): void \{[\s\S]*void this\.armHandsFree\(\)/);
    assert.doesNotMatch(sidecar, /private rearmAfterNoise[\s\S]{0,260}releaseStream/);
  });

  it('does not console-log every streamed token payload', () => {
    const debug = read('src/lib/asa-debug.ts');
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(debug, /localStorage\.getItem\('asa\.debug'\) === '1'/);
    assert.doesNotMatch(debug, /import\.meta\.env\.DEV\s*\|\|/);
    assert.doesNotMatch(store, /^\s*asaLog\('chat', 'event', event\.eventType, event\.payload\)/m);
    assert.match(store, /if \(event\.eventType !== 'token'\) asaLog\('chat', 'event', event\.eventType, event\.payload\)/);
  });
});

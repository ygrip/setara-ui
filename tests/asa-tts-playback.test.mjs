import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA TTS streamed playback contract', () => {
  it('keeps browser PCM playback buffered, measured, and cancellable', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(sidecar, /const TTS_FRAME_MS = 160/);
    assert.match(sidecar, /const TTS_PREROLL_MS = 240/);
    assert.match(sidecar, /const TTS_UNDERRUN_RECOVERY_MS = 80/);
    assert.match(sidecar, /ttsPlayback = \$state<TtsPlaybackStats>/);
    assert.match(sidecar, /underruns \+= 1/);
    assert.match(sidecar, /TTS stream playback stats/);
    assert.match(sidecar, /this\.streamSources\.add\(src\)/);
    assert.match(sidecar, /this\.streamSources\.clear\(\)/);
    assert.match(sidecar, /new DataView\(bytes\.buffer, bytes\.byteOffset, usable\)/);
    assert.doesNotMatch(sidecar, /new Int16Array\(bytes\.buffer, bytes\.byteOffset/);

    const stopAudio = sidecar.match(/stopAudio\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
    assert.doesNotMatch(stopAudio, /onended = null/);
    assert.match(stopAudio, /this\.speechGen \+= 1/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('ASA sidecar voice contracts', () => {
  it('captures constrained microphone audio and falls back to batch transcription', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /const AUDIO_CONSTRAINTS: MediaStreamConstraints/);
    assert.match(voice, /echoCancellation: true/);
    assert.match(voice, /noiseSuppression: true/);
    assert.match(voice, /autoGainControl: true/);
    assert.match(voice, /navigator\.mediaDevices\.getUserMedia\(AUDIO_CONSTRAINTS\)/);
    assert.match(voice, /const result = await transcribeAudio\(blob\)/);
  });

  it('normalizes and routes structured sidecar transcripts', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /normalizeTranscript\(raw, 'en'\)/);
    assert.match(voice, /new EntityResolver\(this\.catalog\)\.resolve/);
    assert.match(voice, /source: 'sidecar'/);
    assert.match(voice, /routeVoiceTranscript\(this\.wakeMode, transcript\.text\)/);
    assert.match(voice, /this\.onTranscript\(route\.command/);
  });

  it('keeps one hands-free session across noise and wake transitions', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /private armingHandsFree: Promise<void> \| null = null/);
    assert.match(voice, /if \(this\.armingHandsFree\) return this\.armingHandsFree/);
    assert.match(voice, /this\.wakeMode = route\.nextMode/);
    assert.match(voice, /void this\.armHandsFree\(\); \/\/ nothing usable/);
  });

  it('bounds audio buffered while the streaming STT socket connects', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /private pendingSttFrames: ArrayBuffer\[\] = \[\]/);
    assert.match(voice, /this\.pendingSttFrames\.length < MAX_PENDING_STT_FRAMES/);
    assert.match(voice, /for \(const b of this\.pendingSttFrames\) ws\.send\(b\)/);
    assert.match(voice, /ws\.send\('flush'\)/);
  });

  it('persists only current sidecar voice preferences', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    for (const field of ['ttsEnabled', 'voiceId', 'speakOnlyShort', 'handsFree', 'earcons']) {
      assert.match(voice, new RegExp(`${field}:`));
    }
    assert.doesNotMatch(voice, /pitch:|language:/);
  });

  it('loads the server-owned voice catalog and entity catalog', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const api = read('src/lib/api/asa.ts');

    assert.match(voice, /this\.voices = await fetchVoiceCatalog\(\)/);
    assert.match(voice, /this\.catalog = await fetchEntityCatalog\(\)/);
    assert.match(api, /apiFetch\('\/api\/asa\/voice\/models'\)/);
    assert.match(api, /apiFetch\('\/api\/asa\/entity-catalog'\)/);
  });

  it('uses streamed server TTS with a batch fallback', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /synthesizeSpeechStream\(text, this\.voiceId \?\? undefined\)/);
    assert.match(voice, /await this\.synthAndPlayBatch\(text, gen, ctx\)/);
    assert.match(voice, /const blob = await synthesizeSpeech\(text, this\.voiceId \?\? undefined\)/);
    assert.doesNotMatch(voice, /RunAnywhere|MoonshineSttEngine/);
  });

  it('makes barge-in cancel queued and active playback generations', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const stopAudio = voice.slice(voice.indexOf('stopAudio(): void'), voice.indexOf('playCue(cue: Cue)'));

    assert.match(stopAudio, /this\.speechGen \+= 1/);
    assert.match(stopAudio, /this\.speakChain = Promise\.resolve\(\)/);
    assert.match(stopAudio, /this\.currentSource\.stop\(\)/);
    assert.match(stopAudio, /for \(const src of this\.streamSources\)/);
    assert.match(stopAudio, /this\.streamSources\.clear\(\)/);
  });
});

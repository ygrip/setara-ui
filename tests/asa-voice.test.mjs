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

  it('keeps long manual dictation separate from bounded hands-free utterances', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const startRecording = voice.slice(voice.indexOf('async startRecording()'), voice.indexOf('async stopRecording()'));
    const stopRecording = voice.slice(voice.indexOf('async stopRecording()'), voice.indexOf('private async processBlob'));
    const beginVadCapture = voice.slice(voice.indexOf('private beginVadCapture'), voice.indexOf('private async endVadCapture'));

    assert.match(voice, /const MANUAL_MAX_RECORD_MS = 5 \* 60_000/);
    assert.match(voice, /const HANDS_FREE_MAX_UTTERANCE_MS = 12_000/);
    assert.match(startRecording, /MANUAL_MAX_RECORD_MS/);
    assert.doesNotMatch(startRecording, /this\.beginStreamCapture\(\)/);
    assert.match(beginVadCapture, /this\.beginStreamCapture\(\)/);
    assert.match(stopRecording, /await this\.endStreamCapture\(\)/);
    assert.match(stopRecording, /return this\.processBlob\(blob\)/);
    assert.doesNotMatch(stopRecording, /return this\.finalizeTranscript\(finalText\)/);
    assert.match(beginVadCapture, /HANDS_FREE_MAX_UTTERANCE_MS/);
  });

  it('plays the hands-free processing cue only for a confirmed command', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const endVadCapture = voice.slice(voice.indexOf('private async endVadCapture'), voice.indexOf('private rearmAfterNoise'));
    const reviewBranch = endVadCapture.slice(endVadCapture.indexOf("if (route.action === 'review')"));

    assert.doesNotMatch(endVadCapture.slice(0, endVadCapture.indexOf("if (route.action === 'review')")), /playCue\('processing'\)/);
    assert.match(reviewBranch, /playCue\('processing'\)/);
    assert.match(endVadCapture, /this\.processBlob\(blob, false\)/);
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
    const persist = voice.slice(voice.indexOf('private persist()'), voice.indexOf('private releaseStream'));

    for (const field of ['ttsEnabled', 'voiceId', 'speakOnlyShort', 'handsFree', 'earcons']) {
      assert.match(persist, new RegExp(`${field}:`));
    }
    assert.doesNotMatch(persist, /pitch:|language:/);
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

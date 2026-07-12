import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('ASA sidecar voice contracts', () => {
  it('captures constrained microphone audio concurrently with the v2 session handshake', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const constraints = read('src/lib/voice/audio/audio-constraints.ts');

    assert.match(constraints, /export function buildMicrophoneConstraints/);
    assert.match(constraints, /echoCancellation: true/);
    assert.match(constraints, /autoGainControl: true/);
    assert.match(voice, /navigator\.mediaDevices\.getUserMedia\(\{ audio: this\.microphoneConstraints\(\) \}\)/);
    assert.match(voice, /const sessionOpening = this\.openSttSession\(mode\)/);
    assert.match(voice, /const captureStarted = await this\.startPcmCapture\(\)/);
    assert.match(voice, /if \(!captureStarted\)/);
    assert.match(voice, /await sessionOpening/);
    assert.match(voice, /await session\.open\(\)/);
    assert.match(voice, /!session\?\.isReady/);
    assert.doesNotMatch(voice, /MediaRecorder|new Blob|transcribeAudio/);
  });

  it('normalizes and routes structured sidecar transcripts', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /normalizeTranscript\(raw, 'en'\)/);
    assert.match(voice, /new EntityResolver\(this\.catalog\)\.resolve/);
    assert.match(voice, /source: 'sidecar'/);
    assert.match(voice, /routeVoiceTranscript\(this\.wakeMode, transcript\.text\)/);
    assert.match(voice, /this\.onTranscript\(routedTranscript\.text/);
  });

  it('configures command, hands-free, and dictation as distinct v2 policies', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const policy = read('src/lib/voice/stt-stream/mode-policy.ts');
    const startRecording = voice.slice(voice.indexOf('async startRecording('), voice.indexOf('async stopRecording()'));
    const beginVadCapture = voice.slice(voice.indexOf('private async beginVadCapture'), voice.indexOf('private async endVadCapture'));

    assert.match(policy, /command:[\s\S]*maxDurationSeconds: 15/);
    assert.match(policy, /hands_free:[\s\S]*maxDurationSeconds: 30/);
    assert.match(policy, /dictation:[\s\S]*maxDurationSeconds: 300/);
    assert.match(startRecording, /this\.openSttSession\(mode\)/);
    assert.match(beginVadCapture, /STT_MODE_POLICIES\.hands_free/);
    assert.doesNotMatch(voice, /12_000|MANUAL_MAX_RECORD_MS/);
  });

  it('offers accessible command and dictation capture while keeping review-only finals editable', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');
    const policy = read('src/lib/voice/stt-stream/mode-policy.ts');

    assert.match(orb, /let manualVoiceMode = \$state<ManualVoiceMode>\('command'\)/);
    assert.match(orb, /sidecarVoice\.startRecording\(manualVoiceMode\)/);
    assert.match(orb, /function toggleManualVoiceMode\(\) \{/);
    assert.match(orb, /manualVoiceMode = manualVoiceMode === 'command' \? 'dictation' : 'command';/);
    assert.match(orb, /disabled=\{sidecarVoice\.busy\}/);
    assert.match(orb, /Record Command \(up to 15 seconds/);
    assert.match(orb, /Record Dictation \(up to 5 minutes/);
    assert.match(orb, /sidecarVoice\.onReviewTranscript = \(transcript\)/);
    assert.match(orb, /showTranscriptForReview\(transcript\)/);
    assert.match(orb, /sidecarVoice\.resumeHandsFreeAfterReview\(\)/);
    assert.match(policy, /autoSubmit: 'never'/);
    assert.match(voice, /sttFinalDisposition\(mode, result\) === 'auto_submit'/);
    assert.match(voice, /this\.onTranscript\?\.\(transcript\.text, transcript\.voiceInput\)/);
    assert.match(voice, /this\.onReviewTranscript\?\.\(routedTranscript\)/);
  });

  it('keeps selector, auto-stop, idle refresh, and cleanup races lifecycle-safe', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.equal(orb.match(/onclick=\{toggleManualVoiceMode\}/g)?.length, 1);
    assert.equal(orb.match(/disabled=\{sidecarVoice\.busy\}/g)?.length, 1);
    assert.doesNotMatch(orb, /class="orb-voice-mode"/);
    assert.match(orb, /event\.shiftKey && \(event\.key === 'm' \|\| event\.key === 'M'\)/);
    assert.match(orb, /if \(asa\.voiceSidecar && !sidecarVoice\.busy\) \{/);
    assert.match(voice, /this\.finishManualCapture\(policy\.maxDurationReason\)/);
    assert.match(voice, /policy\.maxDurationSeconds \* 1_000/);
    assert.match(voice, /this\.status === 'listening' && this\.handsFreeRuntimeActive/);
    assert.match(voice, /void this\.refreshHandsFreeSession\(generation\)/);
    assert.match(voice, /const captureGeneration = \+\+this\.captureGeneration/);
    assert.match(voice, /if \(captureGeneration !== this\.captureGeneration\)/);
    assert.match(voice, /this\.handsFreeGeneration \+= 1/);
    assert.match(voice, /this\.destroySttSession\(session\);[\s\S]*this\.releaseStream\(true\)/);
  });

  it('plays the hands-free processing cue only for a confirmed command', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const endVadCapture = voice.slice(voice.indexOf('private async endVadCapture'), voice.indexOf('private rearmAfterNoise'));
    const reviewBranch = endVadCapture.slice(endVadCapture.indexOf("if (route.action === 'review')"));

    assert.doesNotMatch(endVadCapture.slice(0, endVadCapture.indexOf("if (route.action === 'review')")), /playCue\('processing'\)/);
    assert.match(reviewBranch, /playCue\('processing'\)/);
    assert.match(endVadCapture, /this\.processSttResult\('hands_free', result, false\)/);
    assert.match(endVadCapture, /sttFinalDisposition\('hands_free', result\)/);
  });

  it('keeps one hands-free session across noise and wake transitions', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(voice, /private armingHandsFree: Promise<void> \| null = null/);
    assert.match(voice, /if \(this\.armingHandsFree\) return this\.armingHandsFree/);
    assert.match(voice, /this\.wakeMode = route\.nextMode/);
    assert.match(voice, /void this\.armHandsFree\(\); \/\/ nothing usable/);
  });

  it('buffers PCM captured before the session is ready, then flushes it once ready', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');

    // setara-s94o STT truncation incident: capture used to start only after openSttSession()
    // resolved (HTTP prepare + WS ready), silently losing any speech during that handshake. Audio
    // is now captured concurrently and buffered (bounded by PRE_ROLL_MAX_BYTES) until ready.
    assert.match(voice, /new SttSession\(\{/);
    assert.match(voice, /await session\.open\(\)/);
    assert.match(voice, /const sessionOpening = this\.openSttSession\(mode\)/);
    assert.match(voice, /const captureStarted = await this\.startPcmCapture\(\)/);
    assert.match(voice, /PRE_ROLL_MAX_BYTES/);
    assert.match(voice, /private bufferPreRollFrame\(frame: ArrayBuffer\)/);
    assert.match(voice, /private flushPreRollFrames\(session: SttSession\)/);
    assert.match(voice, /this\.flushPreRollFrames\(session\)/);
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

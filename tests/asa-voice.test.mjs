import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA voice adapter contracts', () => {
  it('exports the VAD-gated microphone STT and TTS interfaces', () => {
    const source = read('src/lib/voice/engines.ts');

    assert.match(source, /export interface MicSttEngine/);
    assert.match(source, /export interface SttResult/);
    assert.match(source, /export interface TextToSpeechEngine/);
    assert.match(source, /export class FakeMicSttEngine/);
    assert.match(source, /export class FakeTextToSpeechEngine/);
  });

  it('voice store uses adapter interfaces, not inline runtime calls for STT and wake', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');

    assert.match(store, /this\.micStt/);
    assert.match(store, /routeVoiceTranscript/);
    assert.match(store, /this\.ttsEngine/);
    assert.match(store, /import\('\.\/moonshine-stt'\)/);
    assert.doesNotMatch(store, /RunAnywhereSTT|RunAnywhereWakeWordEngine/);
  });

  it('keeps one VAD session across ignored speech and wake-to-command transitions', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');
    const handler = store.slice(
      store.indexOf('private async handleTranscript'),
      store.indexOf('private async resolveAndReview')
    );

    assert.match(store, /this\.micStt\?\.state === 'listening' \|\| this\.micStt\?\.state === 'transcribing'/);
    assert.doesNotMatch(handler, /startWakeListening|startCommandListening/);
    assert.match(handler, /this\.stopMic\(\);[\s\S]*resolveAndReview/);
  });

  it('loads Moonshine through a verified persistent browser cache', () => {
    const engine = read('src/lib/voice/moonshine-stt.ts');
    const cache = read('src/lib/voice/model-cache.ts');

    assert.match(engine, /withCachedMoonshineModel/);
    assert.match(cache, /caches\.open\(CACHE_NAME\)/);
    assert.match(cache, /crypto\.subtle\.digest\('SHA-256'/);
    assert.match(cache, /cache\.put\(asset\.url/);
    assert.match(cache, /removeStaleModelCaches/);
  });

  it('voice preferences include pitch and language fields', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');
    const engines = read('src/lib/voice/engines.ts');

    assert.match(store, /pitch:/);
    assert.match(store, /language:/);
    assert.match(engines, /pitch: number/);
    assert.match(engines, /language: string/);
  });

  it('model manifest includes benchmark records for each model', () => {
    const manifest = JSON.parse(read('src/lib/voice/model-manifest.json'));

    for (const model of manifest.models) {
      assert.ok(model.benchmarks, `Model ${model.id} is missing benchmarks`);
      assert.ok(typeof model.benchmarks.p50LatencyMs === 'number', `Model ${model.id} missing p50LatencyMs`);
      assert.ok(typeof model.benchmarks.peakMemoryMb === 'number', `Model ${model.id} missing peakMemoryMb`);
    }
  });

  it('retains RunAnywhere only for text-to-speech', () => {
    const adapters = read('src/lib/voice/runanywhere-adapters.ts');

    assert.match(adapters, /implements TextToSpeechEngine/);
    assert.doesNotMatch(adapters, /implements (?:WakeWordEngine|SpeechToTextEngine)/);
  });

  it('barge-in clears in-flight operation and restores wake state on cancel', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');

    // The operation counter ensures stale transcription callbacks are dropped
    assert.match(store, /op !== this\.operation/);
    assert.match(store, /this\.micStt = null/);
    assert.match(store, /this\.ttsEngine = null/);
    assert.match(store, /this\.stopMic\(\);[\s\S]*await this\.resolveAndReview/);
  });
});

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
  it('exports WakeWordEngine, SpeechToTextEngine, and TextToSpeechEngine interfaces', () => {
    const source = read('src/lib/voice/engines.ts');

    assert.match(source, /export interface WakeWordEngine/);
    assert.match(source, /export interface SpeechToTextEngine/);
    assert.match(source, /export interface TextToSpeechEngine/);
    assert.match(source, /export class FakeWakeWordEngine/);
    assert.match(source, /export class FakeSpeechToTextEngine/);
    assert.match(source, /export class FakeTextToSpeechEngine/);
  });

  it('voice store uses adapter interfaces, not inline runtime calls for STT and wake', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');

    assert.match(store, /this\.wakeEngine/);
    assert.match(store, /this\.sttEngine/);
    assert.match(store, /this\.ttsEngine/);
    // Must import from adapters, not directly call runanywhere in transcribeSegment
    assert.match(store, /import.*runanywhere-adapters/);
    // No direct STT.transcribe call in transcribeSegment body (uses adapter instead)
    assert.doesNotMatch(store, /STT\.transcribe.*language.*sampleRate/);
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

  it('runanywhere adapters implement the engine interfaces', () => {
    const adapters = read('src/lib/voice/runanywhere-adapters.ts');

    assert.match(adapters, /implements WakeWordEngine/);
    assert.match(adapters, /implements SpeechToTextEngine/);
    assert.match(adapters, /implements TextToSpeechEngine/);
  });

  it('barge-in clears in-flight operation and restores wake state on cancel', () => {
    const store = read('src/lib/voice/asa-voice.svelte.ts');

    // The operation counter ensures stale transcription callbacks are dropped
    assert.match(store, /operation !== this\.operation/);
    // Destroy must null all adapters
    assert.match(store, /this\.wakeEngine = null/);
    assert.match(store, /this\.sttEngine = null/);
    assert.match(store, /this\.ttsEngine = null/);
  });
});

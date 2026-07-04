import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/lib/api/asa.ts', import.meta.url), 'utf8');
const voice = readFileSync(new URL('../src/lib/voice/sidecar-voice.svelte.ts', import.meta.url), 'utf8');

test('prepares a bounded server voice session and finalizes retained PCM through core', () => {
  assert.match(api, /\/api\/asa\/voice\/session\/prepare/);
  assert.match(api, /finalizeVoicePcm/);
  assert.match(api, /'Content-Type': 'audio\/l16'/);
  assert.match(voice, /type: 'config'/);
  assert.match(voice, /hotwords: this\.voiceSession\.stt\.hotwords/);
  assert.match(voice, /this\.utterancePcmFrames\.push/);
  assert.match(voice, /this\.preparedFinal \?\?/);
});

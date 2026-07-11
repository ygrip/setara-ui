import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/lib/api/asa.ts', import.meta.url), 'utf8');
const voice = readFileSync(new URL('../src/lib/voice/sidecar-voice.svelte.ts', import.meta.url), 'utf8');

test('prepares a bounded server voice session and trusts the WebSocket final', () => {
  assert.match(api, /\/api\/asa\/voice\/session\/prepare/);
  assert.match(voice, /type: 'config'/);
  assert.match(voice, /hotwords: this\.voiceSession\.stt\.hotwords/);
  assert.match(voice, /return finalText\.trim\(\) \|\| null/);
  assert.doesNotMatch(voice, /this\.utterancePcmFrames\.push/);
  assert.doesNotMatch(voice, /await\s+finalizeVoicePcm\(/);
});

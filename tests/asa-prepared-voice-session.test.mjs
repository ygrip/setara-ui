import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/lib/api/asa.ts', import.meta.url), 'utf8');
const voice = readFileSync(new URL('../src/lib/voice/sidecar-voice.svelte.ts', import.meta.url), 'utf8');

test('prepares a bounded server voice session and trusts the WebSocket final', () => {
  assert.match(api, /\/api\/asa\/voice\/session\/prepare/);
  assert.match(voice, /sessionId: prepared\.voiceSessionId/);
  assert.match(voice, /hotwords: prepared\.stt\.hotwords/);
  assert.match(voice, /await session\.open\(\)/);
  assert.match(voice, /if \(!ctx \|\| !this\.stream \|\| this\.sttCaptureActive \|\| this\.sttCaptureStarting\)/);
  assert.doesNotMatch(voice, /utterancePcmFrames|pendingSttFrames|finalizeVoicePcm/);
});

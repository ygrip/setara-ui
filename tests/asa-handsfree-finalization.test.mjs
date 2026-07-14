import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA hands-free STT finalization', () => {
  it('routes v2 finals through explicit authoritative versus reviewable policy', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const endVadCapture = sidecar.slice(
      sidecar.indexOf('private async endVadCapture'),
      sidecar.indexOf('private rearmAfterNoise'),
    );

    assert.match(endVadCapture, /result = await session\.stop\(reason\)/);
    assert.match(endVadCapture, /sttFinalDisposition\('hands_free', result\) === 'auto_submit'/);
    assert.match(endVadCapture, /this\.onTranscript\(routedTranscript\.text, routedTranscript\.voiceInput\)/);
    assert.match(endVadCapture, /this\.onReviewTranscript\?\.\(routedTranscript\)/);
    assert.doesNotMatch(endVadCapture, /this\.interimTranscript[^\n]*onTranscript/);
  });

  it('hands-free uses one v2 session without batch or raw-audio finalization', () => {
    // Command mode reverted to batch MediaRecorder upload (setara-w50k, after the Moonshine
    // migration failed its benchmark) - but hands-free itself must stay exclusively on the v2 WS
    // session, so scope the "no batch finalization" guarantee to hands-free's own code
    // (endVadCapture), not the whole file.
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const api = read('src/lib/api/asa.ts');
    const endVadCapture = sidecar.slice(
      sidecar.indexOf('private async endVadCapture'),
      sidecar.indexOf('private rearmAfterNoise'),
    );

    assert.match(sidecar, /new SttSession\(\{/);
    assert.match(sidecar, /socketFactory: \(\) => openSttStream\(prepared\.voiceSessionId\)/);
    assert.doesNotMatch(endVadCapture, /MediaRecorder|new Blob|transcribeAudio|finalizeVoicePcm/);
    assert.doesNotMatch(api, /function toWav16k|finalizeVoicePcm/);
  });
});

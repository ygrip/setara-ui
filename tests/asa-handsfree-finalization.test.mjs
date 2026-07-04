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
  it('resolves a pending final transcript from final, close, error, or timeout paths', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');

    assert.match(sidecar, /private finishSttFinal\(text: string \| null\): void/);
    assert.match(sidecar, /if \(!this\.sttFinal\) return/);
    assert.match(sidecar, /this\.sttFinal = null/);
    assert.match(sidecar, /this\.finishSttFinal\(msg\.text \?\? ''\)/);
    assert.match(sidecar, /ws\.onerror = \(\) => this\.finishSttFinal\(this\.interimTranscript\)/);
    assert.match(sidecar, /ws\.onclose = \(\) => \{[\s\S]*this\.finishSttFinal\(this\.interimTranscript\)/);
    assert.match(sidecar, /setTimeout\(\(\) => this\.finishSttFinal\(this\.interimTranscript\), STREAM_FINAL_TIMEOUT_MS\)/);
  });

  it('uses the streaming final without starting a second raw STT request', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const endStreamCapture = sidecar.slice(
      sidecar.indexOf('private async endStreamCapture()'),
      sidecar.indexOf('private finishSttFinal'),
    );

    assert.match(endStreamCapture, /ws\.send\('flush'\)/);
    assert.doesNotMatch(endStreamCapture, /await\s+finalizeVoicePcm\(|this\.utterancePcmFrames|mergePcmFrames\(/);
  });
});

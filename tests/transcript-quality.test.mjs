import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyVoiceNoise } from '../src/lib/voice/transcript-quality.ts';

describe('ASA voice transcript quality', () => {
  it('rejects fragmented STT output before it can trigger an agent action', () => {
    assert.equal(isLikelyVoiceNoise('C -SED, M'), true);
    assert.equal(isLikelyVoiceNoise('A - B, C'), true);
  });

  it('keeps short but coherent commands', () => {
    assert.equal(isLikelyVoiceNoise('show plans'), false);
    assert.equal(isLikelyVoiceNoise('open RAKSARA-4'), false);
  });
});

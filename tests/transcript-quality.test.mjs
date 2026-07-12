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

  it('keeps real short confirmations instead of rejecting them as noise', () => {
    // Regression: these are common replies to this app's own confirm_required action flow, not
    // Whisper hallucinations - blacklisting them made every short voice confirmation fail with
    // "Could not understand audio" regardless of actual STT quality.
    for (const reply of ['yes', 'no', 'ok', 'okay', 'thanks', 'bye', 'Yes.', 'NO']) {
      assert.equal(isLikelyVoiceNoise(reply), false, `expected "${reply}" to not be flagged as noise`);
    }
  });

  it('still rejects near-silence hallucinations and empty text', () => {
    assert.equal(isLikelyVoiceNoise(''), true);
    assert.equal(isLikelyVoiceNoise('   '), true);
    assert.equal(isLikelyVoiceNoise('thanks for watching'), true);
    assert.equal(isLikelyVoiceNoise('um'), true);
  });
});

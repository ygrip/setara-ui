import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMicrophoneConstraints } from '../src/lib/voice/audio/audio-constraints.ts';

describe('buildMicrophoneConstraints (setara-f05x.10 no-double-suppression)', () => {
  it('disables browser noiseSuppression for speex and rnnoise so the enhancer is the only suppressor', () => {
    assert.equal(buildMicrophoneConstraints('speex').noiseSuppression, false);
    assert.equal(buildMicrophoneConstraints('rnnoise').noiseSuppression, false);
  });

  it('keeps browser noiseSuppression on for browser, none, and auto', () => {
    assert.equal(buildMicrophoneConstraints('browser').noiseSuppression, true);
    assert.equal(buildMicrophoneConstraints('none').noiseSuppression, true);
    assert.equal(buildMicrophoneConstraints('auto').noiseSuppression, true);
  });

  it('always keeps echo cancellation, mono, and AGC regardless of mode', () => {
    for (const mode of ['auto', 'speex', 'rnnoise', 'browser', 'none']) {
      const constraints = buildMicrophoneConstraints(mode);
      assert.equal(constraints.echoCancellation, true);
      assert.equal(constraints.channelCount, 1);
      assert.equal(constraints.autoGainControl, true);
    }
  });
});

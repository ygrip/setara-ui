import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pcm16Resampler } from '../src/lib/voice/audio/pcm16-resampler.ts';

describe('Pcm16Resampler', () => {
  it('box-averages an exact integer ratio (48k -> 16k, ratio 3)', () => {
    const resampler = new Pcm16Resampler(48_000, 16_000);
    const input = new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]);
    const out = resampler.process(input);
    assert.equal(out.length, 2);
    assert.equal(out[0], Math.trunc(0.3 * 0x7fff));
    assert.equal(out[1], Math.trunc(-0.6 * 0x8000));
  });

  it('clamps out-of-range samples to the Int16 boundary', () => {
    const resampler = new Pcm16Resampler(16_000, 16_000);
    const out = resampler.process(new Float32Array([2, -2]));
    assert.equal(out[0], 0x7fff);
    assert.equal(out[1], -0x8000);
  });

  it('produces the same samples whether fed in one shot or arbitrary small chunks', () => {
    const sourceRate = 48_000;
    const targetRate = 16_000;
    const totalSamples = 4_000;
    const signal = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      signal[i] = Math.sin((2 * Math.PI * 440 * i) / sourceRate) * 0.5;
    }

    const oneShot = new Pcm16Resampler(sourceRate, targetRate).process(signal);

    const chunked = new Pcm16Resampler(sourceRate, targetRate);
    const chunkSizes = [1, 7, 128, 37, 3, 91, 128, 128, 5, 250];
    const collected = [];
    let offset = 0;
    let chunkIndex = 0;
    while (offset < signal.length) {
      const size = Math.min(chunkSizes[chunkIndex % chunkSizes.length], signal.length - offset);
      chunkIndex++;
      const piece = signal.subarray(offset, offset + size);
      collected.push(...chunked.process(piece));
      offset += size;
    }

    // Arbitrary quantum sizes must not drop or duplicate samples relative to processing the whole
    // signal at once — at most the very last (still-incomplete) window may differ, since one-shot
    // has no more input to complete it while the chunked resampler still holds it as carry.
    assert.ok(Math.abs(collected.length - oneShot.length) <= 1);
    const compareLength = Math.min(collected.length, oneShot.length);
    for (let i = 0; i < compareLength; i++) {
      assert.equal(collected[i], oneShot[i], `sample ${i} diverged between one-shot and chunked resampling`);
    }
  });

  it('reset clears carried fractional state', () => {
    const resampler = new Pcm16Resampler(48_000, 16_000);
    resampler.process(new Float32Array([0.1, 0.1])); // leaves a fractional carry
    resampler.reset();
    const out = resampler.process(new Float32Array([1, 1, 1]));
    assert.equal(out.length, 1);
    assert.equal(out[0], 0x7fff);
  });

  it('rejects non-positive rates', () => {
    assert.throws(() => new Pcm16Resampler(0, 16_000));
    assert.throws(() => new Pcm16Resampler(48_000, -1));
  });
});

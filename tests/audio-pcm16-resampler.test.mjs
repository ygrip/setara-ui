import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pcm16Resampler } from '../src/lib/voice/audio/pcm16-resampler.ts';

function rms(samples) {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

function sineFloat32(frequency, sampleRate, count, amplitude = 0.5) {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;
  }
  return out;
}

describe('Pcm16Resampler', () => {
  it('is an exact passthrough (no filtering) when source and target rates match', () => {
    const resampler = new Pcm16Resampler(16_000, 16_000);
    const out = resampler.process(new Float32Array([0.3, -0.6, 0]));
    assert.equal(out.length, 3);
    assert.equal(out[0], Math.trunc(0.3 * 0x7fff));
    assert.equal(out[1], Math.trunc(-0.6 * 0x8000));
    assert.equal(out[2], 0);
  });

  it('clamps out-of-range samples to the Int16 boundary', () => {
    const resampler = new Pcm16Resampler(16_000, 16_000);
    const out = resampler.process(new Float32Array([2, -2]));
    assert.equal(out[0], 0x7fff);
    assert.equal(out[1], -0x8000);
  });

  it('converges to the true DC level once the filter has enough context (48k -> 16k)', () => {
    // A single output sample is a band-limited weighted average of many neighboring source
    // samples, not one-to-one like a box average - so check steady state, once the window is
    // fully inside a long constant run, rather than the very first output.
    const resampler = new Pcm16Resampler(48_000, 16_000);
    const constant = new Float32Array(3_000).fill(0.3);
    const out = resampler.process(constant);
    assert.ok(out.length > 10, 'expected enough steady-state output to sample the tail');
    const tail = out.slice(-5);
    for (const sample of tail) {
      assert.ok(Math.abs(sample - 0.3 * 0x7fff) <= 2, `steady-state sample ${sample} should track the constant DC level`);
    }
  });

  it('preserves duration: output length tracks input length / ratio', () => {
    const sourceRate = 48_000;
    const targetRate = 16_000;
    const ratio = sourceRate / targetRate;
    const input = sineFloat32(440, sourceRate, 8_000);
    const out = new Pcm16Resampler(sourceRate, targetRate).process(input);
    const expected = input.length / ratio;
    // One-shot processing pays the filter's warm-up (no output until enough context exists) exactly
    // once - a few output samples' worth of one-time startup latency, not per-chunk loss.
    assert.ok(Math.abs(out.length - expected) <= 10, `output length ${out.length} should track ${expected} within filter startup latency`);
  });

  it('handles the non-integer 44.1kHz -> 16kHz ratio cleanly', () => {
    // A device-native 44.1kHz source (ratio 2.75625) exercises fractional-phase carry math the
    // exact-3 48kHz case can't - stands in for a real speech-fixture check without one on disk.
    const sourceRate = 44_100;
    const targetRate = 16_000;
    const ratio = sourceRate / targetRate;
    const input = sineFloat32(300, sourceRate, 8_820, 0.6); // a few-hundred-Hz "voice-like" tone
    const out = new Pcm16Resampler(sourceRate, targetRate).process(input);
    const expected = input.length / ratio;
    assert.ok(Math.abs(out.length - expected) <= 10, `output length ${out.length} should track ${expected} within filter startup latency`);
    assert.ok(out.every((sample) => Number.isFinite(sample)), 'every output sample must be finite');
    assert.ok(rms(out) / 0x7fff > 0.2, 'in-band tone should survive resampling at a non-integer ratio');
  });

  it('rejects (attenuates) content above the target Nyquist instead of aliasing it', () => {
    // A box-average filter has poor stopband rejection - content above the target Nyquist folds
    // back into the audible band as distortion instead of being removed. A real band-limited
    // resampler should suppress it well before decimation.
    const sourceRate = 48_000;
    const targetRate = 16_000; // target Nyquist = 8kHz
    const aboveNyquist = sineFloat32(11_000, sourceRate, 6_000, 0.8); // clearly above 8kHz
    const belowNyquist = sineFloat32(1_000, sourceRate, 6_000, 0.8); // safely within passband

    const outAbove = new Pcm16Resampler(sourceRate, targetRate).process(aboveNyquist);
    const outBelow = new Pcm16Resampler(sourceRate, targetRate).process(belowNyquist);

    const rmsAbove = rms(outAbove) / 0x7fff;
    const rmsBelow = rms(outBelow) / 0x7fff;
    assert.ok(rmsBelow > 0.3, `in-band tone should survive resampling (rms=${rmsBelow})`);
    assert.ok(rmsAbove < rmsBelow * 0.5, `above-Nyquist tone should be attenuated well below the in-band tone (above=${rmsAbove}, below=${rmsBelow})`);
  });

  it('produces the same samples whether fed in one shot or arbitrary small chunks', () => {
    const sourceRate = 48_000;
    const targetRate = 16_000;
    const totalSamples = 4_000;
    const signal = sineFloat32(440, sourceRate, totalSamples);

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
    // signal at once — at most the last still-incomplete window may differ, since one-shot has no
    // more input to complete it while the chunked resampler still holds it as carry.
    assert.ok(Math.abs(collected.length - oneShot.length) <= 1);
    const compareLength = Math.min(collected.length, oneShot.length);
    for (let i = 0; i < compareLength; i++) {
      assert.equal(collected[i], oneShot[i], `sample ${i} diverged between one-shot and chunked resampling`);
    }
  });

  it('reset clears carried history so a new signal is not blended with the old one', () => {
    const resampler = new Pcm16Resampler(48_000, 16_000);
    resampler.process(new Float32Array(500).fill(0.9)); // leaves substantial carried history
    resampler.reset();
    const out = resampler.process(new Float32Array(2_000).fill(-0.4));
    const tail = out.slice(-5);
    for (const sample of tail) {
      assert.ok(Math.abs(sample - -0.4 * 0x8000) <= 2, `post-reset steady-state sample ${sample} should track the new signal only`);
    }
  });

  it('rejects non-positive rates', () => {
    assert.throws(() => new Pcm16Resampler(0, 16_000));
    assert.throws(() => new Pcm16Resampler(48_000, -1));
  });
});

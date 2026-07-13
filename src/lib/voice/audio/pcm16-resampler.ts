const ZERO_CROSSINGS = 3; // sinc window half-width, in cycles of the cutoff frequency

function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

/** Hann window, centered at 0, zero outside [-halfWidth, halfWidth]. */
function hann(x: number, halfWidth: number): number {
  if (Math.abs(x) >= halfWidth) return 0;
  return 0.5 + 0.5 * Math.cos((Math.PI * x) / halfWidth);
}

/**
 * Stateful Float32 → PCM16 resampler (e.g. 48 kHz mic → 16 kHz STT) using windowed-sinc
 * band-limited interpolation (ASA STT accuracy/latency recovery plan, P1.1) — a real anti-aliasing
 * lowpass, not a box-average. A box-average has poor stopband rejection: content above the target
 * Nyquist folds back into the audible band as audible aliasing distortion instead of being removed.
 * Each output sample is a Hann-windowed sinc-weighted sum of nearby source samples, normalized by
 * the actual weight sum used (exact unity DC gain regardless of window truncation at stream edges).
 * A carry buffer of raw source samples (sized to the filter's window) and a fractional phase span
 * each call boundary, so arbitrary chunk sizes produce identical output to one-shot processing.
 */
export class Pcm16Resampler {
  private readonly ratio: number; // source samples per output sample
  private readonly identity: boolean; // sourceRate === targetRate: no filtering needed at all
  private readonly cutoffFreq: number; // sinc cutoff, cycles/sample in source-rate units
  private readonly halfWidth: number; // window half-width, in source samples
  private carry = new Float32Array(0);
  private phase = 0; // fractional offset into `carry` (source samples) where the next output centers

  constructor(sourceRate: number, targetRate: number) {
    if (sourceRate <= 0 || targetRate <= 0) {
      throw new Error('Resampler rates must be positive');
    }
    this.ratio = sourceRate / targetRate;
    this.identity = sourceRate === targetRate;
    // Cutoff just under the target Nyquist (5% margin) so decimation can't alias; never above the
    // source Nyquist either (the ratio < 1 / upsampling case).
    const fc = 0.5 * Math.min(1, 1 / this.ratio) * 0.95;
    this.cutoffFreq = 2 * fc;
    this.halfWidth = Math.max(1, Math.ceil(ZERO_CROSSINGS / this.cutoffFreq));
  }

  /** Consumes one input chunk of arbitrary length and returns as many output samples as it yields. */
  process(input: Float32Array): Int16Array {
    if (input.length === 0) return new Int16Array(0);
    if (this.identity) return this.processIdentity(input);

    const combined = new Float32Array(this.carry.length + input.length);
    combined.set(this.carry, 0);
    combined.set(input, this.carry.length);

    const out: number[] = [];
    const w = this.halfWidth;
    let t = this.phase;
    while (Math.floor(t) + w < combined.length) {
      const center = Math.floor(t);
      if (center - w >= 0) {
        const frac = t - center;
        let sample = 0;
        let weightSum = 0;
        for (let k = -w; k <= w; k++) {
          const distance = k - frac; // fractional distance from the true (continuous) output instant
          const weight = sinc(this.cutoffFreq * distance) * hann(distance, w);
          sample += combined[center + k] * weight;
          weightSum += weight;
        }
        const normalized = weightSum !== 0 ? sample / weightSum : 0;
        const clamped = Math.max(-1, Math.min(1, normalized));
        out.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      }
      t += this.ratio;
    }

    const consumeFrom = Math.min(combined.length, Math.max(0, Math.floor(t) - w));
    this.phase = t - consumeFrom;
    this.carry = combined.slice(consumeFrom);
    return Int16Array.from(out);
  }

  private processIdentity(input: Float32Array): Int16Array {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const clamped = Math.max(-1, Math.min(1, input[i]));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
  }

  reset(): void {
    this.carry = new Float32Array(0);
    this.phase = 0;
  }
}

/**
 * Stateful Float32 → PCM16 downsampler (e.g. 48 kHz mic → 16 kHz STT). Box-averages source samples
 * per output period to curb aliasing. A small carry buffer (< 1 output period of source samples)
 * spans each call boundary so a window that straddles two AudioWorklet render quantums is still
 * averaged over its full span instead of silently dropping the earlier quantum's tail.
 */
export class Pcm16Resampler {
  private readonly ratio: number;
  private carry = new Float32Array(0);
  private phase = 0; // fractional offset into (carry + next input) where the next window starts

  constructor(sourceRate: number, targetRate: number) {
    if (sourceRate <= 0 || targetRate <= 0) {
      throw new Error('Resampler rates must be positive');
    }
    this.ratio = sourceRate / targetRate;
  }

  /** Consumes one input chunk of arbitrary length and returns as many output samples as it yields. */
  process(input: Float32Array): Int16Array {
    if (input.length === 0) return new Int16Array(0);
    const combined = new Float32Array(this.carry.length + input.length);
    combined.set(this.carry, 0);
    combined.set(input, this.carry.length);

    const out: number[] = [];
    let start = this.phase;
    while (start + this.ratio <= combined.length) {
      const end = start + this.ratio;
      const from = Math.floor(start);
      const to = Math.min(combined.length, Math.ceil(end));
      let sum = 0;
      let count = 0;
      for (let i = from; i < to; i++) {
        sum += combined[i];
        count++;
      }
      const sample = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      out.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      start = end;
    }

    const consumedWhole = Math.floor(start);
    this.phase = start - consumedWhole;
    this.carry = combined.slice(consumedWhole);
    return Int16Array.from(out);
  }

  reset(): void {
    this.carry = new Float32Array(0);
    this.phase = 0;
  }
}

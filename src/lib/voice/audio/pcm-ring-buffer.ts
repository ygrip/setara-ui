/**
 * Bounded Int16 PCM ring buffer. Sits between the AudioWorklet's per-quantum resampler output and
 * its batched `postMessage` flush, so a slow-draining main thread never grows an unbounded queue —
 * once `capacitySamples` is exceeded the oldest samples are dropped and counted as overrun, never
 * silently retried or duplicated.
 */
export class PcmRingBuffer {
  private readonly capacity: number;
  private readonly buffer: Int16Array;
  private readIndex = 0;
  private length = 0;
  private overrunCount = 0;

  constructor(capacitySamples: number) {
    if (capacitySamples <= 0) throw new Error('Ring buffer capacity must be positive');
    this.capacity = capacitySamples;
    this.buffer = new Int16Array(capacitySamples);
  }

  push(samples: Int16Array): void {
    if (samples.length === 0) return;
    if (samples.length >= this.capacity) {
      // Larger than the whole ring: keep only the most recent capacity worth.
      this.overrunCount += samples.length - this.capacity + this.length;
      this.buffer.set(samples.subarray(samples.length - this.capacity));
      this.readIndex = 0;
      this.length = this.capacity;
      return;
    }
    const overflow = this.length + samples.length - this.capacity;
    if (overflow > 0) {
      this.readIndex = (this.readIndex + overflow) % this.capacity;
      this.length -= overflow;
      this.overrunCount += overflow;
    }
    const writeIndex = (this.readIndex + this.length) % this.capacity;
    const tail = Math.min(samples.length, this.capacity - writeIndex);
    this.buffer.set(samples.subarray(0, tail), writeIndex);
    if (tail < samples.length) {
      this.buffer.set(samples.subarray(tail), 0);
    }
    this.length += samples.length;
  }

  /** Removes and returns up to `frameSamples` samples only if a full frame is available. */
  takeFrame(frameSamples: number): Int16Array | null {
    if (this.length < frameSamples) return null;
    const out = new Int16Array(frameSamples);
    for (let i = 0; i < frameSamples; i++) {
      out[i] = this.buffer[(this.readIndex + i) % this.capacity];
    }
    this.readIndex = (this.readIndex + frameSamples) % this.capacity;
    this.length -= frameSamples;
    return out;
  }

  get available(): number {
    return this.length;
  }

  get overruns(): number {
    return this.overrunCount;
  }

  clear(): void {
    this.readIndex = 0;
    this.length = 0;
  }
}

/// <reference lib="webworker" />
import { Pcm16Resampler } from '../pcm16-resampler.ts';
import { PcmRingBuffer } from '../pcm-ring-buffer.ts';

declare function registerProcessor(name: string, processorCtor: unknown): void;
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

const RING_CAPACITY_SECONDS = 2; // bounded so a stalled main thread drops audio instead of growing forever
const FLUSH_INTERVAL_MS = 40; // batch worklet→main messages instead of posting every ~2.7ms quantum

interface SttPcmProcessorOptions {
  targetSampleRate?: number;
  frameDurationMs?: 20 | 40;
}

class SttPcmProcessor extends AudioWorkletProcessor {
  private readonly resampler: Pcm16Resampler;
  private readonly ring: PcmRingBuffer;
  private readonly frameSamples: number;
  private readonly targetSampleRate: number;
  private readonly flushEveryQuantums: number;
  private quantumsSinceFlush = 0;
  private peakSinceFlush = 0;
  private underrunCount = 0;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);
    const processorOptions = (options?.processorOptions ?? {}) as SttPcmProcessorOptions;
    this.targetSampleRate = processorOptions.targetSampleRate ?? 16_000;
    const frameDurationMs = processorOptions.frameDurationMs ?? 20;
    this.frameSamples = Math.round((this.targetSampleRate * frameDurationMs) / 1_000);
    this.resampler = new Pcm16Resampler(sampleRate, this.targetSampleRate);
    this.ring = new PcmRingBuffer(this.targetSampleRate * RING_CAPACITY_SECONDS);
    // 128 samples is the fixed AudioWorklet render quantum.
    const quantumMs = (128 / sampleRate) * 1_000;
    this.flushEveryQuantums = Math.max(1, Math.round(FLUSH_INTERVAL_MS / quantumMs));
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) {
      this.underrunCount += 1;
    } else {
      const resampled = this.resampler.process(channel);
      this.ring.push(resampled);
      let peak = 0;
      for (let i = 0; i < channel.length; i++) {
        const abs = Math.abs(channel[i]);
        if (abs > peak) peak = abs;
      }
      if (peak > this.peakSinceFlush) this.peakSinceFlush = peak;
    }
    this.quantumsSinceFlush += 1;
    if (this.quantumsSinceFlush >= this.flushEveryQuantums) {
      this.flush();
    }
    return true;
  }

  private flush(): void {
    const frames: ArrayBuffer[] = [];
    let frame: Int16Array | null;
    while ((frame = this.ring.takeFrame(this.frameSamples)) !== null) {
      frames.push(frame.buffer as ArrayBuffer);
    }
    this.port.postMessage(
      {
        type: 'frames',
        frames,
        level: this.peakSinceFlush,
        overrunCount: this.ring.overruns,
        underrunCount: this.underrunCount,
      },
      frames,
    );
    this.quantumsSinceFlush = 0;
    this.peakSinceFlush = 0;
  }
}

registerProcessor('stt-pcm-processor', SttPcmProcessor);

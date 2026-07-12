import { STT_FRAME_DURATION_MS, pcmBytesToMilliseconds } from './frame-encoder.ts';

export interface SttTransportStats {
  framesProduced: number;
  framesSent: number;
  framesDropped: number;
  audioProducedMs: number;
  audioSentMs: number;
  audioDroppedMs: number;
  maxBufferedAmount: number;
  reconnects: number;
  congestionStops: number;
}

export class SttStreamMetrics {
  private stats: SttTransportStats = emptyStats();

  frameProduced(): void {
    this.stats.framesProduced += 1;
    this.stats.audioProducedMs += STT_FRAME_DURATION_MS;
  }

  frameSent(): void {
    this.stats.framesSent += 1;
    this.stats.audioSentMs += STT_FRAME_DURATION_MS;
  }

  frameDropped(): void {
    this.stats.framesDropped += 1;
    this.stats.audioDroppedMs += STT_FRAME_DURATION_MS;
  }

  audioRejected(bytes: number): void {
    const durationMs = pcmBytesToMilliseconds(bytes);
    this.stats.audioProducedMs += durationMs;
    this.stats.audioDroppedMs += durationMs;
  }

  remainderDropped(bytes: number): void {
    this.audioRejected(bytes);
  }

  observeBufferedAmount(bytes: number): void {
    if (Number.isFinite(bytes) && bytes > this.stats.maxBufferedAmount) {
      this.stats.maxBufferedAmount = bytes;
    }
  }

  reconnected(): void {
    this.stats.reconnects += 1;
  }

  congestionStopped(): void {
    this.stats.congestionStops += 1;
  }

  snapshot(): Readonly<SttTransportStats> {
    return Object.freeze({ ...this.stats });
  }

  reset(): void {
    this.stats = emptyStats();
  }
}

function emptyStats(): SttTransportStats {
  return {
    framesProduced: 0,
    framesSent: 0,
    framesDropped: 0,
    audioProducedMs: 0,
    audioSentMs: 0,
    audioDroppedMs: 0,
    maxBufferedAmount: 0,
    reconnects: 0,
    congestionStops: 0,
  };
}

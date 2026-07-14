export const STT_SAMPLE_RATE = 16_000;
export const STT_CHANNELS = 1;
export const STT_BYTES_PER_SAMPLE = 2;
export const STT_FRAME_DURATION_MS = 20;
export const STT_FRAME_BYTES =
  (STT_SAMPLE_RATE * STT_CHANNELS * STT_BYTES_PER_SAMPLE * STT_FRAME_DURATION_MS) / 1_000;

export type Pcm16Input = ArrayBuffer | ArrayBufferView;

/**
 * Converts arbitrary PCM16 byte chunks into exact protocol frames. It retains less than one frame,
 * emits frames directly to the caller, and never owns a frame queue.
 */
export class SttFrameEncoder {
  private readonly pending = new Uint8Array(STT_FRAME_BYTES);
  private pendingLength = 0;

  get pendingBytes(): number {
    return this.pendingLength;
  }

  write(input: Pcm16Input, emit: (frame: ArrayBuffer) => void): number {
    const source = asBytes(input);
    let sourceOffset = 0;
    let frames = 0;

    while (sourceOffset < source.byteLength) {
      const writable = STT_FRAME_BYTES - this.pendingLength;
      const copied = Math.min(writable, source.byteLength - sourceOffset);
      this.pending.set(source.subarray(sourceOffset, sourceOffset + copied), this.pendingLength);
      this.pendingLength += copied;
      sourceOffset += copied;

      if (this.pendingLength === STT_FRAME_BYTES) {
        const frame = this.pending.slice().buffer;
        this.pendingLength = 0;
        emit(frame);
        frames += 1;
      }
    }

    return frames;
  }

  discardPending(): number {
    const discarded = this.pendingLength;
    this.pending.fill(0, 0, this.pendingLength);
    this.pendingLength = 0;
    return discarded;
  }

  reset(): void {
    this.discardPending();
  }

  destroy(): void {
    this.pending.fill(0);
    this.pendingLength = 0;
  }
}

export function pcmBytesToMilliseconds(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  const bytesPerMillisecond =
    (STT_SAMPLE_RATE * STT_CHANNELS * STT_BYTES_PER_SAMPLE) / 1_000;
  return Math.ceil(bytes / bytesPerMillisecond);
}

function asBytes(input: Pcm16Input): Uint8Array {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

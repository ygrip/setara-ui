type TimeoutHandle = ReturnType<typeof setTimeout>;
type SetTimeoutFn = (callback: () => void, delayMs: number) => TimeoutHandle;
type ClearTimeoutFn = (handle: TimeoutHandle) => void;

export interface StreamBatcherOptions {
  delayMs: number;
  onFlush: (content: string) => void;
  setTimeoutFn?: SetTimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
}

export function reconcileCompletedContent(streamed: string, completed: string): string {
  return completed || streamed;
}

export class StreamBatcher {
  private pending = '';
  private timer: TimeoutHandle | null = null;
  private readonly delayMs: number;
  private readonly onFlush: (content: string) => void;
  private readonly setTimeoutFn: SetTimeoutFn;
  private readonly clearTimeoutFn: ClearTimeoutFn;

  constructor(options: StreamBatcherOptions) {
    this.delayMs = options.delayMs;
    this.onFlush = options.onFlush;
    this.setTimeoutFn = options.setTimeoutFn
      ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    this.clearTimeoutFn = options.clearTimeoutFn
      ?? ((handle) => globalThis.clearTimeout(handle));
  }

  push(content: string): void {
    if (!content) return;
    this.pending += content;
    if (this.timer !== null) return;
    this.timer = this.setTimeoutFn(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  flush(): void {
    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    const content = this.pending;
    this.pending = '';
    this.onFlush(content);
  }

  dispose(): void {
    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
    this.pending = '';
  }
}

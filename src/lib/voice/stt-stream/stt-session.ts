import {
  isAuthoritativeSttFinality,
  parseSttClientControl,
  parseSttServerEvent,
  SttProtocolError,
  type SttErrorEvent,
  type SttFinalEvent,
  type SttFinality,
  type SttFlushReason,
  type SttPartialEvent,
  type SttReadyEvent,
  type SttStartControl,
} from './protocol.ts';
import { SttFrameEncoder, type Pcm16Input } from './frame-encoder.ts';
import { SttStreamMetrics, type SttTransportStats } from './stream-metrics.ts';

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;

export const DEFAULT_STT_HIGH_WATERMARK_BYTES = 262_144;
export const DEFAULT_STT_LOW_WATERMARK_BYTES = 65_536;
export const DEFAULT_STT_SUSTAINED_CONGESTION_MS = 1_500;
export const DEFAULT_STT_PRESSURE_POLL_MS = 25;
export const DEFAULT_STT_CONNECT_TIMEOUT_MS = 5_000;
export const DEFAULT_STT_HANDSHAKE_TIMEOUT_MS = 10_000;
export const DEFAULT_STT_FINAL_TIMEOUT_MS = 300_000;

export type SttSessionState =
  | 'idle'
  | 'connecting'
  | 'awaiting_ready'
  | 'ready'
  | 'flushing'
  | 'finalized'
  | 'cancelled'
  | 'closed';

export type SttWebSocket = Pick<
  WebSocket,
  | 'readyState'
  | 'bufferedAmount'
  | 'binaryType'
  | 'send'
  | 'close'
  | 'addEventListener'
  | 'removeEventListener'
>;

export interface SttFinalResult {
  text: string;
  finality: SttFinality;
  provider: string;
  model: string;
  durationMs: number;
  latencyMs: number;
  fallbackUsed: boolean;
  audioDroppedMs: number;
  degraded: boolean;
  transport: Readonly<SttTransportStats>;
}

export interface SttPcmDelivery {
  status: 'sent' | 'buffered' | 'not_ready' | 'paused' | 'closed';
  framesProduced: number;
  framesSent: number;
  framesDropped: number;
}

export interface SttFlowControlEvent {
  paused: boolean;
  bufferedAmount: number;
  sustained: boolean;
}

export interface SttSessionOptions {
  start: SttStartControl;
  /** Creates the credential-bearing Core relay socket, normally through `openSttStream`. */
  socketFactory: () => SttWebSocket | null;
  highWatermarkBytes?: number;
  lowWatermarkBytes?: number;
  sustainedCongestionMs?: number;
  pressurePollMs?: number;
  connectTimeoutMs?: number;
  handshakeTimeoutMs?: number;
  finalTimeoutMs?: number;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  onReady?: (event: SttReadyEvent) => void;
  onPartial?: (event: SttPartialEvent) => void;
  onFinal?: (result: SttFinalResult) => void;
  onError?: (event: SttErrorEvent | SttSessionError) => void;
  onFlowControl?: (event: SttFlowControlEvent) => void;
}

export class SttSessionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'SttSessionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class SttSession {
  private readonly start: SttStartControl;
  private readonly socketFactory: () => SttWebSocket | null;
  private readonly encoder = new SttFrameEncoder();
  private readonly metrics = new SttStreamMetrics();
  private readonly highWatermarkBytes: number;
  private readonly lowWatermarkBytes: number;
  private readonly sustainedCongestionMs: number;
  private readonly pressurePollMs: number;
  private readonly connectTimeoutMs: number;
  private readonly handshakeTimeoutMs: number;
  private readonly finalTimeoutMs: number;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => unknown;
  private readonly cancelSchedule: (handle: unknown) => void;
  private readonly onReady?: (event: SttReadyEvent) => void;
  private readonly onPartial?: (event: SttPartialEvent) => void;
  private readonly onFinal?: (result: SttFinalResult) => void;
  private readonly onError?: (event: SttErrorEvent | SttSessionError) => void;
  private readonly onFlowControl?: (event: SttFlowControlEvent) => void;

  private socket: SttWebSocket | null = null;
  private currentState: SttSessionState = 'idle';
  private readyEvent: SttReadyEvent | null = null;
  private latestPartial = '';
  private result: SttFinalResult | null = null;
  private openDeferred: Deferred<SttReadyEvent> | null = null;
  private finalDeferred: Deferred<SttFinalResult> | null = null;
  private connectTimer: unknown = null;
  private handshakeTimer: unknown = null;
  private finalTimer: unknown = null;
  private pressureTimer: unknown = null;
  private pressureStartedAt: number | null = null;
  private pressurePaused = false;
  private flushSent = false;
  private cancelSent = false;
  private degraded = false;

  constructor(options: SttSessionOptions) {
    const parsed = parseSttClientControl(options.start);
    if (parsed.type !== 'start') {
      throw new SttSessionError('STT_INVALID_START', 'STT session requires a start control', false);
    }
    this.start = parsed;
    this.socketFactory = options.socketFactory;
    this.highWatermarkBytes =
      options.highWatermarkBytes ?? DEFAULT_STT_HIGH_WATERMARK_BYTES;
    this.lowWatermarkBytes = options.lowWatermarkBytes ?? DEFAULT_STT_LOW_WATERMARK_BYTES;
    this.sustainedCongestionMs =
      options.sustainedCongestionMs ?? DEFAULT_STT_SUSTAINED_CONGESTION_MS;
    this.pressurePollMs = options.pressurePollMs ?? DEFAULT_STT_PRESSURE_POLL_MS;
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_STT_CONNECT_TIMEOUT_MS;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_STT_HANDSHAKE_TIMEOUT_MS;
    this.finalTimeoutMs = options.finalTimeoutMs ?? DEFAULT_STT_FINAL_TIMEOUT_MS;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelSchedule = options.cancelSchedule ?? ((handle) => clearTimeout(handle as number));
    this.onReady = options.onReady;
    this.onPartial = options.onPartial;
    this.onFinal = options.onFinal;
    this.onError = options.onError;
    this.onFlowControl = options.onFlowControl;
    this.validateLimits();
  }

  get state(): SttSessionState {
    return this.currentState;
  }

  get isReady(): boolean {
    return this.currentState === 'ready';
  }

  get isPressurePaused(): boolean {
    return this.pressurePaused;
  }

  get finalResult(): SttFinalResult | null {
    return this.result;
  }

  get transportStats(): Readonly<SttTransportStats> {
    return this.metrics.snapshot();
  }

  get diagnostics(): Readonly<SttDiagnosticSnapshot> {
    return Object.freeze({
      mode: this.start.mode,
      state: this.currentState,
      provider: this.result?.provider ?? this.readyEvent?.provider ?? 'unknown',
      finality: this.result?.finality ?? null,
      transport: this.metrics.snapshot(),
    });
  }

  open(): Promise<SttReadyEvent> {
    if (this.readyEvent && this.currentState === 'ready') {
      return Promise.resolve(this.readyEvent);
    }
    if (this.openDeferred) return this.openDeferred.promise;
    if (this.currentState !== 'idle') {
      return Promise.reject(
        new SttSessionError('STT_INVALID_STATE', `Cannot open STT session from ${this.currentState}`, false),
      );
    }

    const socket = this.socketFactory();
    if (!socket) {
      this.currentState = 'closed';
      return Promise.reject(
        new SttSessionError('STT_SOCKET_UNAVAILABLE', 'Authenticated STT socket is unavailable', true),
      );
    }

    this.socket = socket;
    this.socket.binaryType = 'arraybuffer';
    this.attachSocket(socket);
    this.currentState = 'connecting';
    this.openDeferred = deferred<SttReadyEvent>();
    this.connectTimer = this.schedule(() => {
      this.failBeforeReady(
        new SttSessionError('STT_CONNECT_TIMEOUT', 'STT socket connection timed out', true),
      );
    }, this.connectTimeoutMs);
    if (socket.readyState === SOCKET_OPEN) queueMicrotask(() => this.handleSocketOpen());
    return this.openDeferred.promise;
  }

  sendPcm(input: Pcm16Input): SttPcmDelivery {
    const bytes = inputByteLength(input);
    if (this.currentState !== 'ready') {
      this.metrics.audioRejected(bytes);
      this.degraded = true;
      const status = this.currentState === 'connecting' || this.currentState === 'awaiting_ready'
        ? 'not_ready'
        : 'closed';
      return { status, framesProduced: 0, framesSent: 0, framesDropped: 0 };
    }

    let framesProduced = 0;
    let framesSent = 0;
    let framesDropped = 0;
    this.encoder.write(input, (frame) => {
      framesProduced += 1;
      this.metrics.frameProduced();
      const outcome = this.deliverFrame(frame);
      if (outcome === 'sent') {
        framesSent += 1;
      } else {
        framesDropped += 1;
        if (outcome === 'pressure_dropped') {
          this.metrics.frameDropped();
          this.degraded = true;
        }
      }
    });

    let status: SttPcmDelivery['status'] = 'sent';
    if (framesProduced === 0) status = 'buffered';
    if (framesDropped > 0 || this.pressurePaused) status = 'paused';
    return { status, framesProduced, framesSent, framesDropped };
  }

  stop(reason: SttFlushReason = 'user_stop'): Promise<SttFinalResult> {
    return this.flush(reason);
  }

  flush(reason: SttFlushReason): Promise<SttFinalResult> {
    if (this.result) return Promise.resolve(this.result);
    if (this.flushSent && this.finalDeferred) return this.finalDeferred.promise;
    if (this.currentState !== 'ready') {
      return Promise.reject(
        new SttSessionError('STT_NOT_READY', `Cannot flush STT session from ${this.currentState}`, false),
      );
    }

    this.discardRemainder();
    this.flushSent = true;
    this.currentState = 'flushing';
    this.finalDeferred = this.finalDeferred ?? deferred<SttFinalResult>();
    try {
      this.requireOpenSocket().send(JSON.stringify({ type: 'flush', reason }));
      this.finalTimer = this.schedule(() => {
        this.finishDegraded('partial_timeout');
      }, this.finalTimeoutMs);
    } catch {
      this.finishDegraded('connection_lost_partial');
    }
    return this.finalDeferred?.promise ?? Promise.resolve(this.requireResult());
  }

  completion(): Promise<SttFinalResult> {
    if (this.result) return Promise.resolve(this.result);
    this.finalDeferred = this.finalDeferred ?? deferred<SttFinalResult>();
    return this.finalDeferred.promise;
  }

  reset(): boolean {
    if (this.currentState !== 'finalized' || !this.socket || this.socket.readyState !== SOCKET_OPEN) {
      return false;
    }
    try {
      this.socket.send(JSON.stringify({ type: 'reset' }));
    } catch {
      return false;
    }
    this.clearFinalTimer();
    this.clearPressureTimer();
    this.encoder.reset();
    this.metrics.reset();
    this.latestPartial = '';
    this.result = null;
    this.finalDeferred = null;
    this.flushSent = false;
    this.cancelSent = false;
    this.degraded = false;
    this.pressurePaused = false;
    this.pressureStartedAt = null;
    this.currentState = 'ready';
    return true;
  }

  cancel(): SttFinalResult {
    if (this.result) return this.result;
    const open = this.openDeferred;
    this.openDeferred = null;
    open?.reject(new SttSessionError('STT_CANCELLED', 'STT session was cancelled', false));
    if (!this.cancelSent && this.socket?.readyState === SOCKET_OPEN) {
      try {
        this.socket.send(JSON.stringify({ type: 'cancel' }));
        this.cancelSent = true;
      } catch {
        // Cleanup below still closes the transport and settles cancellation.
      }
    }
    this.discardRemainder();
    const result = this.syntheticResult('cancelled', '');
    this.finishResult(result);
    this.currentState = 'cancelled';
    this.detachSocket(true);
    this.encoder.destroy();
    return result;
  }

  destroy(): void {
    if (!this.result) {
      this.cancel();
    } else {
      this.detachSocket(true);
      this.encoder.destroy();
    }
    this.clearHandshakeTimer();
    this.clearConnectTimer();
    this.clearFinalTimer();
    this.clearPressureTimer();
    this.currentState = 'closed';
  }

  checkPressure(): void {
    if (!this.pressurePaused || !this.socket || this.currentState !== 'ready') return;
    const bufferedAmount = this.socket.bufferedAmount;
    this.metrics.observeBufferedAmount(bufferedAmount);
    if (bufferedAmount <= this.lowWatermarkBytes) {
      this.leavePressurePause(bufferedAmount);
      return;
    }
    const elapsed = this.now() - (this.pressureStartedAt ?? this.now());
    if (elapsed >= this.sustainedCongestionMs) {
      this.metrics.congestionStopped();
      this.degraded = true;
      this.clearPressureTimer();
      this.onFlowControl?.({ paused: true, bufferedAmount, sustained: true });
      void this.flush('client_shutdown').catch(() => undefined);
      return;
    }
    this.schedulePressureCheck();
  }

  private validateLimits(): void {
    if (
      !Number.isFinite(this.lowWatermarkBytes) ||
      !Number.isFinite(this.highWatermarkBytes) ||
      !Number.isFinite(this.sustainedCongestionMs) ||
      !Number.isFinite(this.pressurePollMs) ||
      !Number.isFinite(this.connectTimeoutMs) ||
      !Number.isFinite(this.handshakeTimeoutMs) ||
      !Number.isFinite(this.finalTimeoutMs) ||
      this.lowWatermarkBytes < 0 ||
      this.highWatermarkBytes <= this.lowWatermarkBytes ||
      this.sustainedCongestionMs <= 0 ||
      this.pressurePollMs <= 0 ||
      this.connectTimeoutMs <= 0 ||
      this.handshakeTimeoutMs <= 0 ||
      this.finalTimeoutMs <= 0
    ) {
      throw new SttSessionError('STT_INVALID_LIMITS', 'STT session limits must be positive and ordered', false);
    }
  }

  private deliverFrame(frame: ArrayBuffer): FrameDeliveryOutcome {
    const socket = this.socket;
    if (!socket || socket.readyState !== SOCKET_OPEN || this.currentState !== 'ready') {
      this.metrics.frameDropped();
      this.degraded = true;
      this.finishDegraded('connection_lost_partial');
      return 'transport_failed';
    }
    const before = socket.bufferedAmount;
    this.metrics.observeBufferedAmount(before);
    if (this.pressurePaused) {
      if (before <= this.lowWatermarkBytes) {
        this.leavePressurePause(before);
      } else {
        this.checkPressure();
        return 'pressure_dropped';
      }
    }
    if (before >= this.highWatermarkBytes) {
      this.enterPressurePause(before);
      return 'pressure_dropped';
    }
    try {
      socket.send(frame);
      this.metrics.frameSent();
      const after = socket.bufferedAmount;
      this.metrics.observeBufferedAmount(after);
      if (after >= this.highWatermarkBytes) this.enterPressurePause(after);
      return 'sent';
    } catch {
      this.metrics.frameDropped();
      this.degraded = true;
      this.finishDegraded('connection_lost_partial');
      return 'transport_failed';
    }
  }

  private enterPressurePause(bufferedAmount: number): void {
    if (!this.pressurePaused) {
      this.pressurePaused = true;
      this.pressureStartedAt = this.now();
      this.onFlowControl?.({ paused: true, bufferedAmount, sustained: false });
    }
    this.schedulePressureCheck();
  }

  private leavePressurePause(bufferedAmount: number): void {
    this.pressurePaused = false;
    this.pressureStartedAt = null;
    this.clearPressureTimer();
    this.onFlowControl?.({ paused: false, bufferedAmount, sustained: false });
  }

  private schedulePressureCheck(): void {
    if (this.pressureTimer !== null) return;
    this.pressureTimer = this.schedule(() => {
      this.pressureTimer = null;
      this.checkPressure();
    }, this.pressurePollMs);
  }

  private handleSocketOpen = (): void => {
    if (!this.socket || this.currentState !== 'connecting') return;
    this.currentState = 'awaiting_ready';
    this.clearConnectTimer();
    this.handshakeTimer = this.schedule(() => {
      this.failBeforeReady(
        new SttSessionError('STT_HANDSHAKE_TIMEOUT', 'STT ready handshake timed out', true),
      );
    }, this.handshakeTimeoutMs);
    try {
      this.socket.send(JSON.stringify(this.start));
    } catch {
      this.failBeforeReady(
        new SttSessionError('STT_START_SEND_FAILED', 'Could not send STT start control', true),
      );
    }
  };

  private handleSocketMessage = (event: MessageEvent<unknown>): void => {
    try {
      if (typeof event.data !== 'string') {
        throw new SttProtocolError('STT_INVALID_MESSAGE', 'STT server events must be JSON text');
      }
      const message = parseSttServerEvent(event.data);
      if (message.type === 'ready') {
        this.handleReady(message);
      } else if (message.type === 'partial') {
        this.handlePartial(message);
      } else if (message.type === 'final') {
        this.handleFinal(message);
      } else {
        if (this.currentState === 'connecting' || this.currentState === 'awaiting_ready') {
          this.failBeforeReady(
            new SttSessionError(message.code, message.message, message.retryable),
          );
        } else {
          this.handleServerError(message);
        }
      }
    } catch (error) {
      const protocolError = error instanceof SttProtocolError
        ? new SttSessionError(error.code, error.message, false)
        : new SttSessionError('STT_INVALID_MESSAGE', 'Invalid STT server event', false);
      if (this.currentState === 'connecting' || this.currentState === 'awaiting_ready') {
        this.failBeforeReady(protocolError);
      } else {
        this.onError?.(protocolError);
        this.finishDegraded('connection_lost_partial');
      }
    }
  };

  private handleSocketError = (): void => {
    const error = new SttSessionError('STT_SOCKET_ERROR', 'STT socket failed', true);
    if (this.currentState === 'connecting' || this.currentState === 'awaiting_ready') {
      this.failBeforeReady(error);
      return;
    }
    this.onError?.(error);
    this.finishDegraded('connection_lost_partial');
  };

  private handleSocketClose = (): void => {
    if (this.currentState === 'connecting' || this.currentState === 'awaiting_ready') {
      this.failBeforeReady(
        new SttSessionError('STT_SOCKET_CLOSED', 'STT socket closed before ready', true),
      );
      return;
    }
    if (!this.result && this.currentState !== 'closed' && this.currentState !== 'cancelled') {
      this.finishDegraded('connection_lost_partial');
    }
    this.detachSocket(false);
  };

  private handleReady(event: SttReadyEvent): void {
    if (this.currentState !== 'awaiting_ready') {
      throw new SttProtocolError('STT_INVALID_MESSAGE', 'Unexpected STT ready event');
    }
    if (event.maxDurationSeconds < this.start.maxDurationSeconds) {
      throw new SttProtocolError(
        'STT_INVALID_MESSAGE',
        'STT provider duration is smaller than the requested duration',
      );
    }
    this.clearHandshakeTimer();
    this.readyEvent = event;
    this.currentState = 'ready';
    const open = this.openDeferred;
    this.openDeferred = null;
    open?.resolve(event);
    this.onReady?.(event);
  }

  private handlePartial(event: SttPartialEvent): void {
    if (this.currentState !== 'ready' && this.currentState !== 'flushing') {
      throw new SttProtocolError('STT_INVALID_MESSAGE', 'Partial arrived outside an active STT session');
    }
    this.latestPartial = event.text;
    this.onPartial?.(event);
  }

  private handleFinal(event: SttFinalEvent): void {
    if (this.currentState !== 'ready' && this.currentState !== 'flushing') {
      throw new SttProtocolError('STT_INVALID_MESSAGE', 'Final arrived outside an active STT session');
    }
    this.discardRemainder();
    const transport = this.metrics.snapshot();
    const audioDroppedMs = event.audioDroppedMs + transport.audioDroppedMs;
    const cancelled = event.finality === 'cancelled';
    this.finishResult({
      text: cancelled ? '' : event.text,
      finality: event.finality,
      provider: event.provider,
      model: event.model,
      durationMs: event.durationMs,
      latencyMs: event.latencyMs,
      fallbackUsed: event.fallbackUsed,
      audioDroppedMs,
      degraded:
        this.degraded || audioDroppedMs > 0 || !isAuthoritativeSttFinality(event.finality),
      transport,
    });
  }

  private handleServerError(event: SttErrorEvent): void {
    this.onError?.(event);
    this.finishDegraded('connection_lost_partial');
  }

  private finishDegraded(finality: 'partial_timeout' | 'connection_lost_partial'): void {
    if (this.result) return;
    this.degraded = true;
    this.discardRemainder();
    this.finishResult(this.syntheticResult(finality, this.latestPartial));
    this.detachSocket(true);
  }

  private syntheticResult(finality: SttFinality, text: string): SttFinalResult {
    const transport = this.metrics.snapshot();
    return {
      text: finality === 'cancelled' ? '' : text,
      finality,
      provider: this.readyEvent?.provider ?? 'unknown',
      model: this.readyEvent?.model ?? 'unknown',
      durationMs: transport.audioProducedMs,
      latencyMs: 0,
      fallbackUsed: false,
      audioDroppedMs: transport.audioDroppedMs,
      degraded: true,
      transport,
    };
  }

  private finishResult(result: SttFinalResult): void {
    if (this.result) return;
    this.clearConnectTimer();
    this.clearHandshakeTimer();
    this.clearFinalTimer();
    this.clearPressureTimer();
    this.pressurePaused = false;
    this.pressureStartedAt = null;
    this.result = result;
    this.currentState = result.finality === 'cancelled' ? 'cancelled' : 'finalized';
    const completion = this.finalDeferred;
    this.finalDeferred = null;
    completion?.resolve(result);
    this.onFinal?.(result);
  }

  private failBeforeReady(error: SttSessionError): void {
    if (this.currentState === 'closed') return;
    this.clearConnectTimer();
    this.clearHandshakeTimer();
    this.onError?.(error);
    const open = this.openDeferred;
    const completion = this.finalDeferred;
    this.openDeferred = null;
    this.finalDeferred = null;
    this.currentState = 'closed';
    this.detachSocket(true);
    this.encoder.destroy();
    open?.reject(error);
    completion?.reject(error);
  }

  private attachSocket(socket: SttWebSocket): void {
    socket.addEventListener('open', this.handleSocketOpen);
    socket.addEventListener('message', this.handleSocketMessage);
    socket.addEventListener('error', this.handleSocketError);
    socket.addEventListener('close', this.handleSocketClose);
  }

  private detachSocket(close: boolean): void {
    const socket = this.socket;
    if (!socket) return;
    socket.removeEventListener('open', this.handleSocketOpen);
    socket.removeEventListener('message', this.handleSocketMessage);
    socket.removeEventListener('error', this.handleSocketError);
    socket.removeEventListener('close', this.handleSocketClose);
    if (close && socket.readyState < SOCKET_CLOSING) {
      try {
        socket.close(1000, 'STT session complete');
      } catch {
        // Socket is already closing.
      }
    }
    this.socket = null;
  }

  private requireOpenSocket(): SttWebSocket {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) {
      throw new SttSessionError('STT_SOCKET_CLOSED', 'STT socket is not open', true);
    }
    return this.socket;
  }

  private discardRemainder(): void {
    const bytes = this.encoder.discardPending();
    if (bytes > 0) {
      this.metrics.remainderDropped(bytes);
      this.degraded = true;
    }
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer === null) return;
    this.cancelSchedule(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  private clearConnectTimer(): void {
    if (this.connectTimer === null) return;
    this.cancelSchedule(this.connectTimer);
    this.connectTimer = null;
  }

  private clearFinalTimer(): void {
    if (this.finalTimer === null) return;
    this.cancelSchedule(this.finalTimer);
    this.finalTimer = null;
  }

  private clearPressureTimer(): void {
    if (this.pressureTimer === null) return;
    this.cancelSchedule(this.pressureTimer);
    this.pressureTimer = null;
  }

  private requireResult(): SttFinalResult {
    if (!this.result) {
      throw new SttSessionError('STT_RESULT_MISSING', 'STT final result is unavailable', false);
    }
    return this.result;
  }
}

export function isAuthoritativeSttFinalResult(result: SttFinalResult): boolean {
  return (
    isAuthoritativeSttFinality(result.finality) &&
    !result.degraded &&
    result.audioDroppedMs === 0
  );
}

export function canAutoSubmitSttFinal(result: SttFinalResult): boolean {
  return result.text.trim().length > 0 && isAuthoritativeSttFinalResult(result);
}

export function isReviewableSttFinal(result: SttFinalResult): boolean {
  return result.finality !== 'cancelled' && result.text.trim().length > 0;
}

export interface SttDiagnosticSnapshot {
  mode: SttStartControl['mode'];
  state: SttSessionState;
  provider: string;
  finality: SttFinality | null;
  transport: Readonly<SttTransportStats>;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

type FrameDeliveryOutcome = 'sent' | 'pressure_dropped' | 'transport_failed';

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function inputByteLength(input: Pcm16Input): number {
  return input instanceof ArrayBuffer ? input.byteLength : input.byteLength;
}

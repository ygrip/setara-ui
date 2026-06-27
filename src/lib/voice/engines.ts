/** Synthesizes text to audio. */
export interface TextToSpeechEngine {
  synthesize(text: string, opts: TtsOptions): Promise<TtsOutput>;
}

export interface TtsOptions {
  speed: number;
  pitch: number;
  volume: number;
  language: string;
}

export interface TtsOutput {
  audioData: Float32Array;
  sampleRate: number;
}

/** Result from a VAD-gated microphone STT pass. */
export interface SttResult {
  rawText: string;
  normalizedText: string;
  confidence?: number;
  source: 'moonshine';
}

/**
 * Event-driven microphone STT engine backed by browser VAD.
 * VAD detects speech boundaries; the engine transcribes each bounded segment.
 * init() loads models, start() opens the mic + VAD, stop() closes them.
 * Callbacks must be set before calling start().
 */
export interface MicSttEngine {
  onTranscript: ((result: SttResult) => void) | null;
  onError: ((error: Error) => void) | null;
  readonly state: 'idle' | 'initializing' | 'listening' | 'transcribing';
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  destroy(): void;
}

export class FakeTextToSpeechEngine implements TextToSpeechEngine {
  readonly spoken: string[] = [];
  private readonly sampleRate = 22050;

  async synthesize(text: string, _opts: TtsOptions): Promise<TtsOutput> {
    this.spoken.push(text);
    return { audioData: new Float32Array(100), sampleRate: this.sampleRate };
  }
}

/** Deterministic MicSttEngine for CI - emits a preset sequence of SttResults without touching the microphone. */
export class FakeMicSttEngine implements MicSttEngine {
  onTranscript: ((result: SttResult) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  private _state: 'idle' | 'initializing' | 'listening' | 'transcribing' = 'idle';
  private readonly results: SttResult[];
  private index = 0;

  constructor(results: SttResult[] = []) {
    this.results = results;
  }

  get state() { return this._state; }

  async init(): Promise<void> { this._state = 'idle'; }

  async start(): Promise<void> {
    this._state = 'listening';
  }

  /** Synchronously emit the next preset result. Used in tests to drive the state machine. */
  emit(): void {
    const result = this.results[this.index++ % Math.max(this.results.length, 1)];
    if (result) this.onTranscript?.(result);
  }

  stop(): void { this._state = 'idle'; }
  destroy(): void { this.stop(); this.onTranscript = null; this.onError = null; }
}

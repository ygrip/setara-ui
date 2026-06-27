import { normalizeTranscript } from './transcript-normalizer';
import type { MicSttEngine, SttResult } from './engines';

const MODEL_URL = 'model/tiny';
const MIN_SPEECH_MS = 500;
const MAX_SPEECH_MS = 15_000;
const PRE_SPEECH_PAD_MS = 300;
const REDEMPTION_MS = 1200;
const POSITIVE_SPEECH_THRESHOLD = 0.6;
const NEGATIVE_SPEECH_THRESHOLD = 0.35;

/**
 * VAD-segmented Moonshine STT engine.
 *
 * Lifecycle: init() loads the Moonshine ONNX model. start() creates a MicVAD session
 * and opens the microphone. Each bounded speech segment (detected by Silero VAD inside
 * vad-web) is passed to MoonshineModel.generate(). stop()/destroy() release all resources.
 *
 * Operation tokens (this.token) serialize state transitions: any callback that captures
 * an old token value is silently discarded, preventing stale async continuations.
 */
export class MoonshineSttEngine implements MicSttEngine {
  onTranscript: ((result: SttResult) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  private _state: 'idle' | 'initializing' | 'listening' | 'transcribing' = 'idle';
  private model: import('@moonshine-ai/moonshine-js').MoonshineModel | null = null;
  private micVad: import('@ricky0123/vad-web').MicVAD | null = null;
  private token = 0;
  private capTimer: ReturnType<typeof setTimeout> | null = null;

  get state(): 'idle' | 'initializing' | 'listening' | 'transcribing' {
    return this._state;
  }

  async init(): Promise<void> {
    if (this._state !== 'idle') return;
    this._state = 'initializing';
    try {
      const { MoonshineModel } = await import('@moonshine-ai/moonshine-js');
      this.model = new MoonshineModel(MODEL_URL);
      await this.model.loadModel();
      this._state = 'idle';
    } catch (e) {
      this._state = 'idle';
      throw e;
    }
  }

  async start(): Promise<void> {
    if (this._state !== 'idle' || !this.model) return;
    const t = ++this.token;
    this._state = 'listening';
    try {
      const { MicVAD } = await import('@ricky0123/vad-web');
      this.micVad = await MicVAD.new({
        positiveSpeechThreshold: POSITIVE_SPEECH_THRESHOLD,
        negativeSpeechThreshold: NEGATIVE_SPEECH_THRESHOLD,
        redemptionMs: REDEMPTION_MS,
        preSpeechPadMs: PRE_SPEECH_PAD_MS,
        minSpeechMs: MIN_SPEECH_MS,
        submitUserSpeechOnPause: true,
        // Serve ORT WASM and VAD model/worklet from local paths (avoids CDN blocked by COEP).
        onnxWASMBasePath: '/ort/',
        baseAssetPath: '/vad/',
        ortConfig: (ort) => {
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.proxy = false;
        },
        onSpeechStart: () => {
          if (t !== this.token) return;
          this.capTimer = setTimeout(() => {
            if (t === this.token) this.micVad?.pause();
          }, MAX_SPEECH_MS);
        },
        onSpeechEnd: async (audio: Float32Array) => {
          if (t !== this.token) return;
          this.clearCap();
          await this.transcribeSegment(audio, t);
        },
        onVADMisfire: () => {
          if (t !== this.token) return;
          this.clearCap();
        },
        onFrameProcessed: (probs: { isSpeech: number }) => {
          if (t !== this.token) return;
          // expose VAD speech probability as a proxy for audio level (used by UI)
          // The value is live; components read it via the store's audioLevel reactive field
          this._audioLevel = probs.isSpeech ?? 0;
        },
      });
      await this.micVad.start();
    } catch (e) {
      if (t === this.token) {
        this._state = 'idle';
        this.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  stop(): void {
    ++this.token;
    this.clearCap();
    this.micVad?.pause();
    this.micVad = null;
    this._audioLevel = 0;
    this._state = 'idle';
  }

  destroy(): void {
    this.stop();
    this.model = null;
    this.onTranscript = null;
    this.onError = null;
  }

  /** Live VAD speech probability [0, 1]. Polled by the voice store for its audioLevel reactive field. */
  get audioLevel(): number { return this._audioLevel; }
  private _audioLevel = 0;

  private clearCap(): void {
    if (this.capTimer) { clearTimeout(this.capTimer); this.capTimer = null; }
  }

  private async transcribeSegment(audio: Float32Array, t: number): Promise<void> {
    if (!this.model || t !== this.token) return;
    this._state = 'transcribing';
    try {
      const rawText = await this.model.generate(audio);
      if (t !== this.token) return;
      const { normalizedText } = normalizeTranscript(rawText, 'en');
      this.onTranscript?.({ rawText, normalizedText, source: 'moonshine' });
    } catch (e) {
      if (t === this.token) {
        this.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (t === this.token) this._state = 'listening';
    }
  }
}

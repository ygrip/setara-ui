import { emptyAudioCaptureStats, type AudioCaptureStats } from './audio-metrics.ts';
import { buildMicrophoneConstraints } from './audio-constraints.ts';
import type { AudioEnhancer, AudioEnhancerDiagnostics } from './enhancer/audio-enhancer.ts';
import { createAudioEnhancer, type AudioEnhancerSelection } from './enhancer/enhancer-factory.ts';

export type SttFrameDurationMs = 20 | 40;

const NO_ENHANCEMENT: AudioEnhancerSelection = {
  requested: 'none',
  preferredEnhancedMode: 'speex',
  fallback: 'browser',
};

export interface AudioCaptureSessionOptions {
  context: AudioContext;
  stream: MediaStream;
  frameDurationMs?: SttFrameDurationMs;
  targetSampleRate?: number;
  /** Defaults to no enhancement (identity passthrough) if omitted. */
  enhancerSelection?: AudioEnhancerSelection;
}

interface WorkletFrameMessage {
  type: 'frames';
  frames: ArrayBuffer[];
  level: number;
  overrunCount: number;
  underrunCount: number;
}

// `?worker&url` tells Vite to run this file through its normal module/worker build pipeline
// (transpile + bundle its imports) and hand back the URL to the *compiled* output — a bare
// `new URL(path, import.meta.url)` on a .ts file only copies the raw, un-transpiled source.
import WORKLET_URL from './worklets/stt-pcm-processor.ts?worker&url';

const WORKLET_NAME = 'stt-pcm-processor';

// AudioWorklet modules can only be added once per BaseAudioContext; addModule on an already-loaded
// context throws. Preloading it as soon as a context exists (see `preloadSttWorklet`, called from
// `ensureAudioContext`) means `prepare()` almost always finds this already resolved.
const loadedContexts = new WeakSet<AudioContext>();

export async function preloadSttWorklet(context: AudioContext): Promise<void> {
  if (loadedContexts.has(context)) return;
  await context.audioWorklet.addModule(WORKLET_URL);
  loadedContexts.add(context);
}

/**
 * Owns one AudioWorkletNode-based capture graph: mic source → enhancer → stt-pcm-processor →
 * silent sink → destination (a silent path is required so the worklet is pulled by the graph).
 * Emits batched, already-resampled/framed PCM16 frames and level updates from the worklet's port.
 *
 * Also owns the noise-suppression fallback state machine (setara-f05x.10 section 8.9): if the
 * requested enhancer fails to initialize, this session reacquires the microphone track with
 * browser-native suppression re-enabled rather than silently running an inactive enhanced node
 * with native suppression still disabled.
 */
export class AudioCaptureSession {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private enhancer: AudioEnhancer | null = null;
  private _stream: MediaStream | null = null;
  private _stats: AudioCaptureStats = emptyAudioCaptureStats();

  onPcmFrame?: (frame: ArrayBuffer) => void;
  onLevel?: (level: number) => void;

  get stats(): AudioCaptureStats {
    return this._stats;
  }

  /** The stream currently feeding this session — may differ from the one passed to `prepare()` if
   *  a noise-suppression fallback reacquired the microphone. */
  get stream(): MediaStream | null {
    return this._stream;
  }

  get enhancerDiagnostics(): AudioEnhancerDiagnostics {
    return (
      this.enhancer?.diagnostics() ?? {
        requestedMode: 'none',
        activeMode: 'none',
        fallbackUsed: false,
        fallbackReason: null,
        cpuLoad: null,
        overrunCount: null,
        quietSpeechRatio: null,
      }
    );
  }

  async prepare(options: AudioCaptureSessionOptions): Promise<void> {
    const { context } = options;
    let stream = options.stream;
    await preloadSttWorklet(context);

    const selection = options.enhancerSelection ?? NO_ENHANCEMENT;
    const enhancer = await createAudioEnhancer(context, selection);
    const diagnostics = enhancer.diagnostics();
    const enhancementWasRequested = selection.requested !== 'none' && selection.requested !== 'browser';
    if (enhancementWasRequested && diagnostics.fallbackUsed) {
      // The held track may have been requested with native noiseSuppression disabled (to avoid
      // double suppression under the enhancer we just failed to start). Reacquire with browser
      // suppression re-enabled instead of running silently unprocessed audio.
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: buildMicrophoneConstraints('browser'),
        });
        stream.getTracks().forEach((track) => track.stop());
        stream = fallbackStream;
      } catch {
        // Reacquisition itself failed (e.g. permission revoked mid-session) — keep the original
        // track rather than leaving capture with no microphone at all.
      }
    }

    const source = context.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(context, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      processorOptions: {
        targetSampleRate: options.targetSampleRate ?? 16_000,
        frameDurationMs: options.frameDurationMs ?? 20,
      },
    });
    const sink = context.createGain();
    sink.gain.value = 0; // silent path so the worklet is pulled by the graph, no audible echo
    worklet.port.onmessage = (event: MessageEvent<WorkletFrameMessage>) => {
      const message = event.data;
      if (message.type !== 'frames') return;
      this._stats = {
        framesProduced: this._stats.framesProduced + message.frames.length,
        overrunCount: message.overrunCount,
        underrunCount: message.underrunCount,
        lastLevel: message.level,
      };
      for (const frame of message.frames) this.onPcmFrame?.(frame);
      this.onLevel?.(message.level);
    };
    const enhanced = enhancer.connect(source);
    enhanced.connect(worklet);
    worklet.connect(sink);
    sink.connect(context.destination);
    this.context = context;
    this.source = source;
    this.worklet = worklet;
    this.sink = sink;
    this.enhancer = enhancer;
    this._stream = stream;
  }

  reset(): void {
    this._stats = emptyAudioCaptureStats();
  }

  destroy(): void {
    try {
      if (this.worklet) this.worklet.port.onmessage = null;
    } catch {
      /* ignore */
    }
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { this.worklet?.disconnect(); } catch { /* ignore */ }
    try { this.sink?.disconnect(); } catch { /* ignore */ }
    void this.enhancer?.destroy().catch(() => { /* ignore */ });
    this.source = null;
    this.worklet = null;
    this.sink = null;
    this.enhancer = null;
    this.context = null;
    this._stream = null;
  }
}

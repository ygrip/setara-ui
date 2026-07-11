// Thin wrapper over @ricky0123/vad-web (Silero ONNX VAD). Lazy-loaded so onnxruntime-web's wasm
// (~13 MB) is only fetched when hands-free actually arms. Returns null on ANY failure (assets
// missing, model load error, unsupported browser) so the caller falls back to the energy VAD and
// hands-free never regresses. Runs ORT single-threaded to avoid the COOP/COEP requirement.
import type { RealTimeVADOptions } from '@ricky0123/vad-web';
import { asaWarn } from '$lib/asa-debug';

export interface MlVadHandle {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface MlVadConfig {
  stream: MediaStream;
  audioContext: AudioContext;
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
  onMisfire?: () => void;
}

export async function createMlVad(cfg: MlVadConfig): Promise<MlVadHandle | null> {
  try {
    const { MicVAD } = await import('@ricky0123/vad-web');
    const options = {
      model: 'v5',
      baseAssetPath: '/vad/',
      onnxWASMBasePath: '/vad/',
      audioContext: cfg.audioContext,
      // Reuse the caller's already-constrained mic stream; never stop/replace it (the streaming-STT
      // tap reads the same stream), so pause/resume are no-ops.
      getStream: async () => cfg.stream,
      pauseStream: async () => {},
      resumeStream: async () => cfg.stream,
      startOnLoad: false,
      ortConfig: (ort: { env: { wasm: { numThreads: number }; logLevel: string } }) => {
        ort.env.wasm.numThreads = 1; // single-thread → no SharedArrayBuffer → no COOP/COEP needed
        ort.env.logLevel = 'error';
      },
      onSpeechStart: cfg.onSpeechStart,
      onSpeechEnd: cfg.onSpeechEnd,
      onVADMisfire: cfg.onMisfire ?? (() => {}),
    };
    const vad = await MicVAD.new(options as unknown as Partial<RealTimeVADOptions>);
    await vad.start();
    return { pause: () => vad.pause(), resume: () => vad.start(), destroy: () => vad.destroy() };
  } catch (e) {
    asaWarn('voice', 'ML VAD unavailable - falling back to energy VAD', e);
    return null;
  }
}

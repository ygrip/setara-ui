import { SpeexWorkletNode, loadSpeex } from '@sapphi-red/web-noise-suppressor';
import speexWorkletUrl from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url';
import speexWasmUrl from '@sapphi-red/web-noise-suppressor/speex.wasm?url';
import type { AudioEnhancer, AudioEnhancerDiagnostics, AudioSuppressionMode } from './audio-enhancer.ts';
import { ensureWorkletModuleLoaded, memoizeAsync } from './worklet-loader.ts';

const loadSpeexWasmCached = memoizeAsync(() => loadSpeex({ url: speexWasmUrl }));

/** Warms the WASM+worklet caches without constructing a node — call as soon as `speex` is the
 *  active selection, so the first real recording doesn't pay this fetch/compile cost. */
export async function preloadSpeex(context: AudioContext): Promise<void> {
  await Promise.all([loadSpeexWasmCached(), ensureWorkletModuleLoaded(context, speexWorkletUrl)]);
}

/**
 * The only file in this codebase allowed to import `@sapphi-red/web-noise-suppressor` for Speex.
 * `initialize()` throwing is the sole failure signal — callers (the factory/session) are
 * responsible for the browser-reacquisition fallback in `enhancer-factory.ts`; this class never
 * silently degrades itself into a different mode.
 */
export class SapphiRedSpeexEnhancer implements AudioEnhancer {
  readonly requestedMode: AudioSuppressionMode = 'speex';
  readonly activeMode = 'speex' as const;
  readonly fallbackUsed = false;
  readonly fallbackReason = null;

  private context: AudioContext | null = null;
  private node: InstanceType<typeof SpeexWorkletNode> | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  async initialize(context: AudioContext): Promise<void> {
    const wasmBinary = await loadSpeexWasmCached();
    await ensureWorkletModuleLoaded(context, speexWorkletUrl);
    this.node = new SpeexWorkletNode(context, { wasmBinary, maxChannels: 1 });
    this.context = context;
  }

  connect(source: AudioNode): AudioNode {
    if (!this.node || !this.context) {
      throw new Error('SapphiRedSpeexEnhancer.connect called before initialize()');
    }
    const dry = this.context.createGain();
    const wet = this.context.createGain();
    const output = this.context.createGain();
    dry.gain.value = 0;
    wet.gain.value = 1;
    source.connect(dry);
    source.connect(this.node);
    this.node.connect(wet);
    dry.connect(output);
    wet.connect(output);
    this.dryGain = dry;
    this.wetGain = wet;
    this.outputGain = output;
    return output;
  }

  setBypass(bypass: boolean): void {
    if (!this.dryGain || !this.wetGain) return;
    this.dryGain.gain.value = bypass ? 1 : 0;
    this.wetGain.gain.value = bypass ? 0 : 1;
  }

  async destroy(): Promise<void> {
    try { this.node?.disconnect(); } catch { /* ignore */ }
    try { this.node?.destroy(); } catch { /* ignore */ }
    try { this.dryGain?.disconnect(); } catch { /* ignore */ }
    try { this.wetGain?.disconnect(); } catch { /* ignore */ }
    try { this.outputGain?.disconnect(); } catch { /* ignore */ }
    this.node = null;
    this.dryGain = null;
    this.wetGain = null;
    this.outputGain = null;
    this.context = null;
  }

  diagnostics(): AudioEnhancerDiagnostics {
    return {
      requestedMode: this.requestedMode,
      activeMode: this.activeMode,
      fallbackUsed: false,
      fallbackReason: null,
      cpuLoad: null,
      overrunCount: null,
      quietSpeechRatio: null,
    };
  }
}

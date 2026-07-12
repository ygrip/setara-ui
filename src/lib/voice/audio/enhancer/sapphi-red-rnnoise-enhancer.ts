import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import type { AudioEnhancer, AudioEnhancerDiagnostics, AudioSuppressionMode } from './audio-enhancer.ts';
import { ensureWorkletModuleLoaded, memoizeAsync } from './worklet-loader.ts';

const loadRnnoiseWasmCached = memoizeAsync(() =>
  loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }),
);

/** Warms the WASM+worklet caches without constructing a node — call as soon as `rnnoise` is the
 *  active selection, so the first real recording doesn't pay this fetch/compile cost. */
export async function preloadRnnoise(context: AudioContext): Promise<void> {
  await Promise.all([loadRnnoiseWasmCached(), ensureWorkletModuleLoaded(context, rnnoiseWorkletUrl)]);
}

/**
 * The only file in this codebase allowed to import `@sapphi-red/web-noise-suppressor` for RNNoise.
 * Mirrors `SapphiRedSpeexEnhancer`'s wet/dry bypass graph and fallback contract (setara-f05x.11).
 *
 * The diagnostics getter always reports `cpuLoad`/`overrunCount`/`quietSpeechRatio` as `null`: the vendor
 * worklet computes RNNoise's native per-frame VAD probability internally (`_rnnoise_process_frame`'s
 * return value) but discards it before returning — there is no `port.postMessage` telemetry channel
 * at all in this package. Populating real values would require forking the vendor's bundled worklet
 * processor, which is a maintenance liability disproportionate to this task; the fields exist on the
 * interface so a future capability (a maintained fork, or a switch to a package that exposes VAD) can
 * fill them in without another interface change.
 */
export class SapphiRedRnnoiseEnhancer implements AudioEnhancer {
  readonly requestedMode: AudioSuppressionMode = 'rnnoise';
  readonly activeMode = 'rnnoise' as const;
  readonly fallbackUsed = false;
  readonly fallbackReason = null;

  private context: AudioContext | null = null;
  private node: InstanceType<typeof RnnoiseWorkletNode> | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  async initialize(context: AudioContext): Promise<void> {
    const wasmBinary = await loadRnnoiseWasmCached();
    await ensureWorkletModuleLoaded(context, rnnoiseWorkletUrl);
    this.node = new RnnoiseWorkletNode(context, { wasmBinary, maxChannels: 1 });
    this.context = context;
  }

  connect(source: AudioNode): AudioNode {
    if (!this.node || !this.context) {
      throw new Error('SapphiRedRnnoiseEnhancer.connect called before initialize()');
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

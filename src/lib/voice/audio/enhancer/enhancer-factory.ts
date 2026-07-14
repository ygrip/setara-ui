import type { AudioEnhancer, AudioSuppressionMode } from './audio-enhancer.ts';
import { detectEnhancerCapabilities, type EnhancerCapabilities } from './enhancer-capabilities.ts';
import { PassthroughEnhancer } from './browser-enhancer.ts';
import { SapphiRedSpeexEnhancer, preloadSpeex } from './sapphi-red-enhancer.ts';
import { SapphiRedRnnoiseEnhancer, preloadRnnoise } from './sapphi-red-rnnoise-enhancer.ts';

export interface AudioEnhancerSelection {
  requested: AudioSuppressionMode;
  /** What `auto` resolves to. `'browser'` means no enhanced mode is preferred yet. */
  preferredEnhancedMode: 'speex' | 'rnnoise' | 'browser';
  fallback: 'browser';
}

export type ResolvedEnhancerMode = 'speex' | 'rnnoise' | 'browser' | 'none';

/**
 * Pure capability/preference resolution with no side effects — callers that need to know the
 * candidate mode *before* acquiring the microphone (to build the right `MediaTrackConstraints`,
 * see `audio-constraints.ts`) can call this synchronously instead of awaiting `createAudioEnhancer`.
 */
export function resolveAudioEnhancerMode(
  selection: AudioEnhancerSelection,
  capabilities: EnhancerCapabilities = detectEnhancerCapabilities(),
): ResolvedEnhancerMode {
  if (selection.requested === 'none') return 'none';
  if (selection.requested === 'browser') return 'browser';
  if (selection.requested === 'speex') return capabilities.speexSupported ? 'speex' : 'browser';
  if (selection.requested === 'rnnoise') return capabilities.rnnoiseSupported ? 'rnnoise' : 'browser';
  // auto: try the preferred enhanced mode, otherwise fall back to browser-native. `auto` is wired to
  // `preferredEnhancedMode: 'browser'` in production (sidecar-voice.svelte.ts) — Speex and RNNoise are
  // both comparative opt-in only, reachable through an explicit `speex`/`rnnoise` request. This is the
  // promotion gate: neither enhanced mode becomes the `auto` default until it has real-world WER/CPU/
  // quiet-speech comparison evidence against browser-native (setara-ikmt), at which point only this
  // default in sidecar-voice.svelte.ts changes. Speex in particular is a narrowband (8kHz-era) DSP
  // algorithm; run on full wideband (48kHz) mic input without that validation it measurably hurt STT
  // accuracy, which is exactly the "opt-in rollout, corpus tests" mitigation the design risked skipping.
  if (selection.preferredEnhancedMode === 'speex' && capabilities.speexSupported) return 'speex';
  if (selection.preferredEnhancedMode === 'rnnoise' && capabilities.rnnoiseSupported) return 'rnnoise';
  return 'browser';
}

function buildEnhancer(mode: 'speex' | 'rnnoise'): AudioEnhancer {
  if (mode === 'speex') return new SapphiRedSpeexEnhancer();
  return new SapphiRedRnnoiseEnhancer();
}

/** Warms an enhanced mode's WASM+worklet caches as soon as it's the active selection (not on every
 *  page load - only opted-in users pay this fetch cost), so the first recording of the session
 *  doesn't stall on it. Best-effort: callers should treat a rejection as non-fatal. */
export async function preloadAudioEnhancer(context: AudioContext, mode: 'speex' | 'rnnoise'): Promise<void> {
  if (mode === 'speex') return preloadSpeex(context);
  return preloadRnnoise(context);
}

/**
 * Resolves an `AudioEnhancerSelection` to a ready `AudioEnhancer`, following the fallback state
 * machine from plan section 8.9: capability check -> load -> initialize; any failure at any step
 * returns a `browser` passthrough with a non-empty `fallbackReason` instead of throwing. The caller
 * (`AudioCaptureSession`) is responsible for the browser-reacquisition side of the fallback —
 * stopping the original track and requesting a new one with native `noiseSuppression: true`.
 */
export async function createAudioEnhancer(
  context: AudioContext,
  selection: AudioEnhancerSelection,
  capabilities: EnhancerCapabilities = detectEnhancerCapabilities(),
): Promise<AudioEnhancer> {
  const resolved = resolveAudioEnhancerMode(selection, capabilities);
  if (resolved === 'browser' || resolved === 'none') {
    return new PassthroughEnhancer(resolved, { requestedMode: selection.requested });
  }

  let enhancer: AudioEnhancer;
  try {
    enhancer = buildEnhancer(resolved);
    await enhancer.initialize(context);
    return enhancer;
  } catch (error) {
    return new PassthroughEnhancer('browser', {
      requestedMode: selection.requested,
      fallbackReason: error instanceof Error ? error.message : `${resolved} enhancer initialization failed`,
    });
  }
}

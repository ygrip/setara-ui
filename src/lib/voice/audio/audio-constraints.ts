import type { AudioSuppressionMode } from './enhancer/audio-enhancer.ts';

/**
 * Plan section 8.7: browser `noiseSuppression` must be off while an enhanced (Speex/RNNoise)
 * worklet is doing the same job, or the signal gets suppressed twice — once by the browser, once
 * by the enhancer — which the plan explicitly calls out as a negative-control failure mode.
 */
export function buildMicrophoneConstraints(mode: AudioSuppressionMode): MediaTrackConstraints {
  const enhanced = mode === 'speex' || mode === 'rnnoise';
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: !enhanced,
    autoGainControl: true,
  };
}

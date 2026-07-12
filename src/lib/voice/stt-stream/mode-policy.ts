import {
  canAutoSubmitSttFinal,
  isReviewableSttFinal,
  type SttFinalResult,
} from './stt-session.ts';
import type { SttFlushReason, SttMode } from './protocol.ts';

export interface SttModePolicy {
  readonly maxDurationSeconds: number;
  readonly completion: 'explicit_stop' | 'vad_silence';
  readonly autoSubmit: 'authoritative_only' | 'never';
  readonly maxDurationReason: SttFlushReason;
  readonly finalizationTimeoutMs: number;
}

/**
 * Product-level capture limits. Keep them independent from transport limits so every microphone
 * entry point selects a deliberate mode before opening the v2 session.
 */
export const STT_MODE_POLICIES: Readonly<Record<SttMode, SttModePolicy>> = {
  command: {
    maxDurationSeconds: 15,
    completion: 'explicit_stop',
    autoSubmit: 'authoritative_only',
    maxDurationReason: 'max_duration',
    finalizationTimeoutMs: 12_000,
  },
  hands_free: {
    maxDurationSeconds: 30,
    completion: 'vad_silence',
    autoSubmit: 'authoritative_only',
    maxDurationReason: 'max_duration',
    finalizationTimeoutMs: 12_000,
  },
  dictation: {
    maxDurationSeconds: 300,
    completion: 'explicit_stop',
    autoSubmit: 'never',
    maxDurationReason: 'max_duration',
    finalizationTimeoutMs: 300_000,
  },
};

export type SttFinalDisposition = 'auto_submit' | 'review' | 'discard';

export function sttFinalDisposition(
  mode: SttMode,
  result: SttFinalResult,
): SttFinalDisposition {
  if (!isReviewableSttFinal(result)) return 'discard';
  if (
    STT_MODE_POLICIES[mode].autoSubmit === 'authoritative_only' &&
    canAutoSubmitSttFinal(result)
  ) {
    return 'auto_submit';
  }
  return 'review';
}

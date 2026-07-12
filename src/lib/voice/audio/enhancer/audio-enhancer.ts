export type AudioSuppressionMode = 'auto' | 'speex' | 'rnnoise' | 'browser' | 'none';

export interface AudioEnhancerDiagnostics {
  requestedMode: AudioSuppressionMode;
  activeMode: Exclude<AudioSuppressionMode, 'auto'>;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  /**
   * Best-effort runtime health signals (setara-f05x.11). `null` means "not measurable from this
   * enhancer" rather than "zero" — the wrapped vendor worklets expose no telemetry channel, so only
   * an enhancer with a real data source should ever report a non-null value here.
   */
  cpuLoad: number | null;
  overrunCount: number | null;
  quietSpeechRatio: number | null;
}

/**
 * Setara-owned noise suppression abstraction (setara-f05x.10/.11). Nothing outside this
 * `enhancer/` directory may import `@sapphi-red/web-noise-suppressor` directly — every consumer
 * goes through this interface so a package upgrade or replacement never touches call sites.
 */
export interface AudioEnhancer {
  readonly requestedMode: AudioSuppressionMode;
  readonly activeMode: Exclude<AudioSuppressionMode, 'auto'>;
  readonly fallbackUsed: boolean;
  readonly fallbackReason: string | null;

  initialize(context: AudioContext): Promise<void>;
  connect(source: AudioNode): AudioNode;
  setBypass(bypass: boolean): void;
  destroy(): Promise<void>;

  diagnostics(): AudioEnhancerDiagnostics;
}

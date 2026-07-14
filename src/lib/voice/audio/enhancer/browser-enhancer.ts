import type { AudioEnhancer, AudioEnhancerDiagnostics, AudioSuppressionMode } from './audio-enhancer.ts';

/**
 * `browser` and `none` never add a Web Audio node — browser-native suppression (if any) already
 * happened in the capture track via `MediaTrackConstraints.noiseSuppression` (see
 * `audio-constraints.ts`), and `none` is an explicit unprocessed baseline for diagnostics. Both are
 * plain identity passthroughs in the graph so there is exactly one place noise reduction can occur.
 */
export class PassthroughEnhancer implements AudioEnhancer {
  readonly requestedMode: AudioSuppressionMode;
  readonly activeMode: 'browser' | 'none';
  readonly fallbackUsed: boolean;
  readonly fallbackReason: string | null;

  constructor(
    activeMode: 'browser' | 'none',
    options: { requestedMode?: AudioSuppressionMode; fallbackReason?: string } = {},
  ) {
    this.activeMode = activeMode;
    this.requestedMode = options.requestedMode ?? activeMode;
    this.fallbackReason = options.fallbackReason ?? null;
    this.fallbackUsed = this.fallbackReason !== null;
  }

  async initialize(): Promise<void> {
    // No worklet/WASM to load.
  }

  connect(source: AudioNode): AudioNode {
    return source;
  }

  setBypass(): void {
    // Nothing to bypass — there is no processing node.
  }

  async destroy(): Promise<void> {
    // Nothing owned.
  }

  diagnostics(): AudioEnhancerDiagnostics {
    return {
      requestedMode: this.requestedMode,
      activeMode: this.activeMode,
      fallbackUsed: this.fallbackUsed,
      fallbackReason: this.fallbackReason,
      cpuLoad: null,
      overrunCount: null,
      quietSpeechRatio: null,
    };
  }
}

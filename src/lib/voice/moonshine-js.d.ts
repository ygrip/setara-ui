declare module '@moonshine-ai/moonshine-js' {
  export class MoonshineModel {
    constructor(modelURL: string, precision?: string);
    loadModel(): Promise<void>;
    isLoaded(): boolean;
    isLoading(): boolean;
    generate(audio: Float32Array): Promise<string>;
    getLatency(): number;
    benchmark(sampleSize?: number): Promise<number>;
  }

  export class MicrophoneTranscriber {
    constructor(
      modelURL: string,
      callbacks?: Partial<TranscriberCallbacks>,
      useVAD?: boolean,
      precision?: string
    );
    start(): Promise<void>;
    stop(): void;
  }

  export interface TranscriberCallbacks {
    onPermissionsRequested: () => void;
    onError: (error: unknown) => void;
    onModelLoadStarted: () => void;
    onModelLoaded: () => void;
    onTranscribeStarted: () => void;
    onTranscribeStopped: () => void;
    onTranscriptionUpdated: (text: string) => void;
    onTranscriptionCommitted: (text: string, buffer?: AudioBuffer) => void;
    onFrame: (probs: unknown, frame: Float32Array, ema: number) => void;
    onSpeechStart: () => void;
    onSpeechEnd: () => void;
  }

  export class MoonshineError {
    static PermissionDenied: MoonshineError;
  }
}

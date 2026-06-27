import type { TextToSpeechEngine, TtsOptions, TtsOutput } from './engines';

export class RunAnywhereTTS implements TextToSpeechEngine {
  async synthesize(text: string, opts: TtsOptions): Promise<TtsOutput> {
    const [{ TTS }, { AudioPlayback }] = await Promise.all([
      import('@runanywhere/web-onnx'),
      import('@runanywhere/web'),
    ]);
    const output = await TTS.synthesize(text, { speed: opts.speed });
    const playback = new AudioPlayback({ sampleRate: output.sampleRate, volume: opts.volume });
    await playback.play(output.audioData, output.sampleRate);
    playback.dispose();
    return { audioData: output.audioData, sampleRate: output.sampleRate };
  }
}

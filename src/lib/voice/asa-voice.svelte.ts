import type { TextToSpeechEngine } from './engines';
import type { MicSttEngine, SttResult } from './engines';
import type { ResolvedTranscript, EntityClarification, EntityCandidate, ResolverContext } from './entity-resolver';
import type { AsaEntityCatalog } from '$lib/api/asa';

function voiceErrorMessage(error: unknown): string | null {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
    return 'Microphone access denied — allow microphone in browser settings and try again.';
  }
  if (msg.includes('backend') || msg.includes('wasm') || msg.includes('onnx') || msg.includes('dynamically imported') || msg.includes('initwasm')) {
    return 'Voice models failed to initialize — try refreshing the page.';
  }
  if (msg.includes('no available')) {
    return 'Voice runtime unavailable — ensure WebAssembly is enabled and refresh.';
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Could not download voice models — check your network connection.';
  }
  if (msg.includes('memory') || msg.includes('arraybuffer') || msg.includes('out of')) {
    return 'Not enough memory for voice models — close other browser tabs and try again.';
  }
  return null;
}

export type AsaVoiceState =
  | 'disabled'
  | 'setup'
  | 'downloading'
  | 'wake-listening'
  | 'command-listening'
  | 'transcribing'
  | 'clarifying'
  | 'reviewing'
  | 'sending'
  | 'speaking'
  | 'paused'
  | 'error';

export interface AsaVoicePreferences {
  autoSpeak: boolean;
  speed: number;
  pitch: number;
  volume: number;
  language: string;
}

type CommandHandler = (
  transcript: string,
  voiceInput?: import('$lib/api/asa').AsaVoiceInput
) => Promise<string | void>;

const PREFERENCES_KEY = 'setara.asa.voice.preferences';
const WAKE_PHRASES = ['hi asa', 'hello asa'];

class AsaVoiceStore {
  state = $state<AsaVoiceState>('disabled');
  enabled = $state(false);
  downloadProgress = $state(0);
  /** Raw Moonshine transcript (before normalization/resolution). */
  transcript = $state('');
  /** Resolved/corrected text for command review. */
  resolvedText = $state('');
  /** Pending entity clarifications the user must resolve before sending. */
  clarifications = $state<EntityClarification[]>([]);
  audioLevel = $state(0);
  error = $state<string | null>(null);
  preferences = $state<AsaVoicePreferences>({ autoSpeak: true, speed: 1, pitch: 1, volume: 0.9, language: 'en-US' });

  private micStt: (MicSttEngine & { readonly audioLevel: number }) | null = null;
  private ttsEngine: TextToSpeechEngine | null = null;
  private commandHandler: CommandHandler | null = null;
  private catalog: AsaEntityCatalog | null = null;
  private resolvedTranscript: ResolvedTranscript | null = null;
  private modelsReady = false;
  private operation = 0;
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  hydrate() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) this.preferences = { ...this.preferences, ...JSON.parse(stored) };
    } catch {
      localStorage.removeItem(PREFERENCES_KEY);
    }
  }

  setCommandHandler(handler: CommandHandler) {
    this.commandHandler = handler;
  }

  async setup() {
    if (this.state === 'setup' || this.state === 'downloading') return;
    this.error = null;
    this.state = 'setup';
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Voice requires a browser with microphone support');
      }
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      await this.initializeModels();
      this.enabled = true;
      await this.speak('ASA voice is ready', false);
      await this.startWakeListening();
    } catch (error) {
      this.fail(error, 'Unable to set up ASA voice');
    }
  }

  async toggleListening() {
    if (!this.enabled) {
      await this.setup();
      return;
    }
    if (this.state === 'paused') {
      await this.startWakeListening();
    } else {
      this.pause();
    }
  }

  pause() {
    this.operation += 1;
    this.stopMic();
    this.state = 'paused';
  }

  async speak(text: string, resumeWake = true) {
    if (!this.modelsReady || !text.trim() || !this.preferences.autoSpeak || !this.ttsEngine) {
      if (resumeWake && this.enabled) await this.startWakeListening();
      return;
    }
    this.stopMic();
    this.state = 'speaking';
    try {
      await this.ttsEngine.synthesize(text, this.preferences);
      if (resumeWake && this.enabled) await this.startWakeListening();
    } catch (error) {
      this.fail(error, 'ASA could not speak the response');
    }
  }

  async confirmTranscript() {
    const text = this.resolvedText.trim() || this.transcript.trim();
    if (!text || (this.state !== 'reviewing' && this.state !== 'clarifying')) return;
    if (this.clarifications.length > 0) return; // still pending clarifications
    this.state = 'sending';
    const voiceInput = this.buildVoiceInput(text);
    const response = await this.commandHandler?.(text, voiceInput);
    if (response && this.preferences.autoSpeak) {
      await this.speak(response);
    } else if (this.enabled) {
      await this.startWakeListening();
    }
  }

  async retryCommand() {
    if (!this.enabled) return;
    this.transcript = '';
    this.resolvedText = '';
    this.clarifications = [];
    this.resolvedTranscript = null;
    await this.startCommandListening();
  }

  async cancelReview() {
    this.transcript = '';
    this.resolvedText = '';
    this.clarifications = [];
    this.resolvedTranscript = null;
    if (this.enabled) await this.startWakeListening();
  }

  /** Apply a user-selected candidate for a clarification. Updates state and advances if resolved. */
  async applyClarification(clarification: EntityClarification, candidate: EntityCandidate) {
    if (!this.resolvedTranscript) return;
    const { EntityResolver } = await import('./entity-resolver');
    const resolver = new EntityResolver(this.catalog!);
    this.resolvedTranscript = resolver.applyClarification(this.resolvedTranscript, clarification, candidate);
    this.clarifications = [...this.resolvedTranscript.clarifications];
    this.resolvedText = this.resolvedTranscript.correctedText;
    if (this.clarifications.length === 0) {
      this.state = 'reviewing';
    }
  }

  updatePreferences(patch: Partial<AsaVoicePreferences>) {
    this.preferences = { ...this.preferences, ...patch };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
    }
  }

  destroy() {
    this.operation += 1;
    this.stopMic();
    this.ttsEngine = null;
    this.micStt = null;
    this.catalog = null;
    this.resolvedTranscript = null;
    this.enabled = false;
    this.state = 'disabled';
  }

  private async initializeModels() {
    if (this.modelsReady) return;
    this.state = 'downloading';
    this.downloadProgress = 0;

    // Load Moonshine STT via MoonshineSttEngine (includes VAD via @ricky0123/vad-web)
    const { MoonshineSttEngine } = await import('./moonshine-stt');
    const stt = new MoonshineSttEngine();

    // Track download progress via a polling interval (MoonshineModel does not emit progress events)
    const progressPoll = setInterval(() => { this.downloadProgress = Math.min(this.downloadProgress + 0.05, 0.9); }, 400);
    try {
      await stt.init();
    } finally {
      clearInterval(progressPoll);
    }
    this.downloadProgress = 0.95;

    // Load TTS (RunAnywhere, stays until setara-y5ca migration completes)
    const [{ RunAnywhereTTS }, core] = await Promise.all([
      import('./runanywhere-adapters'),
      import('@runanywhere/web'),
    ]);
    await core.RunAnywhere.initialize({ environment: core.SDKEnvironment.Production });

    // Load entity catalog for voice resolution
    const { fetchEntityCatalog } = await import('$lib/api/asa');
    this.catalog = await fetchEntityCatalog();

    this.micStt = stt as MicSttEngine & { readonly audioLevel: number };
    this.ttsEngine = new RunAnywhereTTS();
    this.downloadProgress = 1;
    this.modelsReady = true;
  }

  private async startWakeListening() {
    if (!this.enabled || !this.modelsReady || !this.micStt) return;
    this.transcript = '';
    this.resolvedText = '';
    this.clarifications = [];
    this.resolvedTranscript = null;
    await this.startMic('wake-listening');
  }

  private async startCommandListening() {
    if (!this.enabled || !this.modelsReady || !this.micStt) return;
    await this.startMic('command-listening');
  }

  private async startMic(mode: 'wake-listening' | 'command-listening') {
    this.stopMic();
    const op = ++this.operation;
    this.state = mode;

    this.micStt!.onTranscript = (result: SttResult) => {
      if (op !== this.operation) return;
      void this.handleTranscript(result, mode);
    };
    this.micStt!.onError = (err: Error) => {
      if (op !== this.operation) return;
      this.fail(err, 'ASA could not transcribe the microphone input');
    };

    // Poll audioLevel from VAD engine at ~10fps
    this.levelTimer = setInterval(() => {
      if (this.micStt) this.audioLevel = this.micStt.audioLevel;
    }, 100);

    await this.micStt!.start();
  }

  private async handleTranscript(result: SttResult, mode: 'wake-listening' | 'command-listening') {
    this.transcript = result.rawText;
    this.state = 'transcribing';

    if (mode === 'wake-listening') {
      const command = this.commandAfterWakePhrase(result.normalizedText);
      if (command === null) {
        // No wake phrase - resume listening
        await this.startWakeListening();
        return;
      }
      if (command.trim()) {
        // Wake + command in one utterance
        await this.resolveAndReview(result.normalizedText.slice(result.normalizedText.lastIndexOf(command)));
      } else {
        // Wake phrase detected but no command yet - switch to command listening
        await this.startCommandListening();
      }
    } else {
      if (!result.normalizedText.trim()) {
        await this.startCommandListening();
        return;
      }
      await this.resolveAndReview(result.normalizedText);
    }
  }

  private async resolveAndReview(normalizedText: string) {
    const rawText = this.transcript;
    let resolvedText = normalizedText;
    let clarifications: EntityClarification[] = [];

    if (this.catalog) {
      const { EntityResolver } = await import('./entity-resolver');
      const ctx: ResolverContext = this.buildResolverContext();
      const resolver = new EntityResolver(this.catalog);
      const resolved = resolver.resolve({ rawText, normalizedText, appliedRules: [] }, ctx);
      this.resolvedTranscript = resolved;
      resolvedText = resolved.correctedText;
      clarifications = resolved.clarifications;
    }

    this.resolvedText = resolvedText;
    this.clarifications = clarifications;

    if (clarifications.length > 0) {
      this.state = 'clarifying';
    } else {
      this.state = 'reviewing';
    }
  }

  private buildVoiceInput(resolvedText: string): import('$lib/api/asa').AsaVoiceInput | undefined {
    if (!this.resolvedTranscript) return undefined;
    return {
      source: 'moonshine',
      rawText: this.resolvedTranscript.rawText,
      normalizedText: this.resolvedTranscript.normalizedText,
      resolvedText,
      entities: this.resolvedTranscript.matches.map((m) => ({
        type: m.type,
        id: m.id,
        display: m.display,
        originalSpan: m.originalSpan,
        score: m.score,
        resolution: m.resolution,
      })),
    };
  }

  private buildResolverContext(): ResolverContext {
    // Derive context from browser URL
    if (typeof window === 'undefined') return {};
    const path = window.location.pathname;
    const projectMatch = path.match(/\/projects\/([^/]+)/);
    return { projectKey: projectMatch?.[1] };
  }

  private commandAfterWakePhrase(normalizedText: string): string | null {
    const text = normalizedText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const phrase of WAKE_PHRASES) {
      const index = text.indexOf(phrase);
      if (index >= 0) return text.slice(index + phrase.length).trim();
    }
    return null;
  }

  private stopMic() {
    if (this.levelTimer) { clearInterval(this.levelTimer); this.levelTimer = null; }
    this.micStt?.stop();
    this.audioLevel = 0;
  }

  private fail(error: unknown, fallback: string) {
    this.stopMic();
    this.error = voiceErrorMessage(error) ?? fallback;
    this.state = 'error';
  }
}

export const asaVoice = new AsaVoiceStore();

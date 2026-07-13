import {
  synthesizeSpeech,
  synthesizeSpeechStream,
  openSttStream,
  fetchVoiceCatalog,
  fetchEntityCatalog,
  fetchVoiceCue,
  prepareVoiceSession,
  type AsaPreparedVoiceSession,
  type AsaVoiceOption,
} from '$lib/api/asa';
import type { AsaEntityCatalog, AsaVoiceInput } from '$lib/api/asa';
import { asaLog, asaWarn } from '$lib/asa-debug';
import { stripMarkdown } from '$lib/markdown';
import { classifyPcmStreamError } from './stream-errors';
import { normalizeTranscript } from './transcript-normalizer';
import { isLikelyVoiceNoise } from './transcript-quality';
import { createMlVad, type MlVadHandle } from './ml-vad';
import { routeVoiceTranscript, type WakeMode } from './wake-router';
import type { EntityMatch, ResolverContext } from './entity-resolver';
import {
  SttSession,
  SttSessionError,
  isReviewableSttFinal,
  type SttFinalResult,
} from './stt-stream/stt-session';
import { STT_MODE_POLICIES, sttFinalDisposition } from './stt-stream/mode-policy';
import type { SttFlushReason, SttMode, SttStartControl } from './stt-stream/protocol';
import { buildMicrophoneConstraints } from './audio/audio-constraints';
import { AudioCaptureSession, preloadSttWorklet } from './audio/audio-capture-session';
import { resolveAudioEnhancerMode, preloadAudioEnhancer, type AudioEnhancerSelection } from './audio/enhancer/enhancer-factory';
import type { AudioSuppressionMode } from './audio/enhancer/audio-enhancer';

/**
 * ASA voice through setara-core: every live microphone mode uses STT WebSocket protocol v2, while
 * /synthesize handles playback. Active only when asa.voiceSidecar is true; otherwise ASA is
 * text-only. No browser STT/TTS fallback by design.
 */
const PREF_KEY = 'setara.asa.voice.sidecar';
const ML_VAD_PREF_KEY = 'setara.asa.voice.mlVad';
// setara-f05x.9: AudioWorklet is the default STT capture path. This is a reversible kill-switch —
// set to '1' to force the legacy ScriptProcessorNode path if the worklet regresses in production.
const LEGACY_SCRIPT_PROCESSOR_PREF_KEY = 'setara.asa.voice.legacyScriptProcessor';
// setara-f05x.10/.11: 'auto' resolves to Speex (then RNNoise once benchmarked) with a browser
// fallback baked in — see plan section 8.3. Override with 'browser' or 'none' to force it off.
const NOISE_SUPPRESSION_MODE_PREF_KEY = 'setara.asa.voice.noiseSuppressionMode';
const SPEAK_SHORT_LIMIT = 400; // chars; don't read long markdown aloud

// Hands-free VAD tuning (energy-based, no ML model). RMS is 0..~0.3 for typical mic levels.
const VAD_START_RMS = 0.035; // speech onset threshold (lower = more sensitive)
const VAD_STOP_RMS = 0.02; // below this counts as silence
const VAD_SILENCE_MS = 900; // sustained silence that ends an utterance
const VAD_POLL_MS = 60;
const VAD_MIN_UTTERANCE_MS = 500; // ignore blips shorter than this
const VAD_ONSET_FRAMES = 3; // consecutive loud frames required to START (debounces clicks/noise)
const VAD_SETTLE_MS = 450; // ignore onset right after arming (skip TTS tail / room echo)
const VAD_MIN_PEAK_RMS = 0.06; // an utterance must peak above this, else it's just noise → discard

const TTS_FRAME_MS = 480;   // merge streamed PCM into larger buffers - fewer AudioBufferSourceNode allocations/GC per reply
const TTS_PREROLL_MS = 480; // jitter buffer: hold playback back this long so decode jitter can't underrun
const TTS_UNDERRUN_RECOVERY_MS = 160; // when CPU falls behind, rebuild lead; larger = fewer cascade underruns
const STREAM_RATE = 16_000; // sidecar's native STT rate; we downsample the mic to this before sending

/** Downsample a Float32 mono buffer by `ratio` (box-average to curb aliasing) → little-endian PCM16. */
function downsamplePcm16(input: Float32Array, ratio: number): ArrayBuffer {
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const s = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** Maps v2 transport failures to plain, actionable voice error copy (setara-s94o.11). */
function sttErrorMessage(error: unknown): string {
  if (!(error instanceof SttSessionError)) {
    return 'Voice service is unavailable right now. Try again or type your request.';
  }
  if (error.code === 'STT_HANDSHAKE_TIMEOUT') {
    return 'Voice service took too long to become ready. Try again.';
  }
  if (error.code === 'STT_CONNECT_TIMEOUT') {
    return 'Could not connect to the voice service in time. Try again.';
  }
  if (
    error.code === 'STT_SOCKET_UNAVAILABLE' ||
    error.code === 'STT_SOCKET_CLOSED' ||
    error.code === 'STT_SOCKET_ERROR'
  ) {
    return 'Could not reach the voice service. Try again.';
  }
  return error.message || 'Voice service is unavailable. You can still type your request.';
}

type SidecarStatus = 'idle' | 'listening' | 'recording' | 'transcribing' | 'error';
type VoiceTurnState = 'idle' | 'armed' | 'hearing' | 'finalizing' | 'understanding' | 'speaking' | 'paused' | 'error';
/** Cue ids map 1:1 to backend AsaVoiceCueService.CUES. */
type Cue = 'listening' | 'processing' | 'ok' | 'sorry';

interface SidecarPrefs {
  ttsEnabled: boolean;
  voiceId: string | null;
  speakOnlyShort: boolean;
  handsFree: boolean;
  earcons: boolean;
}

export interface SidecarTranscript {
  text: string;
  voiceInput: AsaVoiceInput;
}

export interface TtsPlaybackStats {
  chunks: number;
  underruns: number;
  scheduledMs: number;
  sampleRate: number;
}

class SidecarVoice {
  status = $state<SidecarStatus>('idle');
  error = $state<string | null>(null);
  voices = $state<AsaVoiceOption[]>([]);
  ttsEnabled = $state(true);
  speakOnlyShort = $state(true);
  voiceId = $state<string | null>(null);
  handsFree = $state(false);
  earcons = $state(true);
  /** Set by the UI: called with the final transcript so hands-free can auto-send. */
  onTranscript: ((text: string, voiceInput?: AsaVoiceInput) => void) | null = null;
  /** Degraded hands-free finals are editable but never executed without explicit confirmation. */
  onReviewTranscript: ((transcript: SidecarTranscript) => void) | null = null;
  /** Live (not-yet-final) transcript from streaming STT, for an interim on-screen display. */
  interimTranscript = $state('');
  turnState = $state<VoiceTurnState>('idle');
  wakeMode = $state<WakeMode>('wake');
  ttsPlayback = $state<TtsPlaybackStats>({ chunks: 0, underruns: 0, scheduledMs: 0, sampleRate: 0 });
  /** Non-blocking info message (e.g. "used local fallback") shown alongside a successful transcript. */
  notice = $state<string | null>(null);
  /** Diagnostics from the most recent v2 STT session (setara-s94o.12). */
  lastSttStats = $state<{
    mode: SttMode;
    provider: string;
    model: string;
    latencyMs: number;
    fallbackUsed: boolean;
    finality: SttFinalResult['finality'];
    audioDroppedMs: number;
    degraded: boolean;
    framesProduced: number;
    framesSent: number;
    framesDropped: number;
    audioProducedMs: number;
    audioSentMs: number;
    maxBufferedAmount: number;
    reconnects: number;
  } | null>(null);

  // One v2 STT lifecycle for every microphone mode. Audio nodes are connected only after ready.
  private sttSession: SttSession | null = null;
  private sttMode: SttMode | null = null;
  private sttCapture: AudioCaptureSession | null = null;
  // Legacy ScriptProcessorNode path, kept only behind LEGACY_SCRIPT_PROCESSOR_PREF_KEY (setara-f05x.9).
  private sttProcessor: ScriptProcessorNode | null = null;
  private sttSource: MediaStreamAudioSourceNode | null = null;
  private sttSink: GainNode | null = null;
  private sttCaptureActive = false;
  private sttCaptureStarting = false; // synchronous re-entry guard while startPcmCaptureWorklet awaits
  private sttFinalizing = false;
  private captureGeneration = 0;

  private stream: MediaStream | null = null;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private catalog: AsaEntityCatalog | null = null;
  private voiceSession: AsaPreparedVoiceSession | null = null;

  // Hands-free VAD
  private vadSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private vadData: Uint8Array<ArrayBuffer> | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private utteranceStart = 0;
  private lastVoiceAt = 0;
  private vadCapturing = false;
  private vadCaptureStarting = false; // guards vadTick against re-entering beginVadCapture while it awaits
  private lastVadLogAt = 0;
  private armedAt = 0;
  private onsetFrames = 0;
  private maxRms = 0;
  // ML VAD (Silero/onnx via @ricky0123/vad-web). When it loads, it drives capture start/stop
  // instead of the energy analyser; on any load failure we fall back to the energy VAD above.
  private micVad: MlVadHandle | null = null;
  private mlGated = false;
  private mlVadUnavailable = false; // sticky: once ML VAD fails to load, stay on energy VAD
  private armingHandsFree: Promise<void> | null = null;
  private handsFreeGeneration = 0;
  private handsFreeRuntimeActive = false;
  private handsFreePanelActive = false;

  // Playback uses Web Audio (not <audio>) so we can resume the context inside the user gesture;
  // otherwise autoplay policy silently blocks the sentence audio that arrives after each synth call.
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  // Streamed TTS schedules many back-to-back buffer sources; track them all so barge-in stops every one.
  private streamSources = new Set<AudioBufferSourceNode>();
  private cueBuffers = new Map<string, AudioBuffer>(); // decoded spoken cue clips, keyed voice/cue

  // TTS: the backend sends a dedicated concise 'speech' text (separate from the displayed markdown).
  // We synthesize + play it as one ordered utterance (concurrency 1 = the sidecar's single slot).
  private speakChain: Promise<void> = Promise.resolve();
  private speechGen = 0; // bumped on stop/barge-in so an in-flight utterance self-cancels

  get recording(): boolean { return this.status === 'recording'; }
  get busy(): boolean { return this.status === 'recording' || this.status === 'transcribing'; }
  get captureMode(): SttMode | null { return this.sttMode; }

  hydrate(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<SidecarPrefs>;
        if (typeof p.ttsEnabled === 'boolean') this.ttsEnabled = p.ttsEnabled;
        if (typeof p.speakOnlyShort === 'boolean') this.speakOnlyShort = p.speakOnlyShort;
        if (typeof p.voiceId === 'string') this.voiceId = p.voiceId;
        if (typeof p.handsFree === 'boolean') this.handsFree = p.handsFree;
        if (typeof p.earcons === 'boolean') this.earcons = p.earcons;
      }
    } catch {
      localStorage.removeItem(PREF_KEY);
    }
  }

  async loadVoices(): Promise<void> {
    this.voices = await fetchVoiceCatalog();
    if (!this.voiceId && this.voices.length > 0) this.voiceId = this.voices[0].id;
    void this.warmCues();
  }

  /** Load the entity catalog so spoken project/plan/build/squad names can be corrected. */
  async loadCatalog(): Promise<void> {
    this.catalog = await fetchEntityCatalog();
    this.voiceSession = await prepareVoiceSession();
  }

  async startRecording(mode: Extract<SttMode, 'command' | 'dictation'> = 'dictation'): Promise<void> {
    if (this.busy) return;
    const captureGeneration = ++this.captureGeneration;
    const handsFreeWasArmed =
      this.handsFreeRuntimeActive ||
      this.status === 'listening' ||
      Boolean(this.vadTimer || this.micVad);
    if (handsFreeWasArmed) {
      this.handsFreeGeneration += 1;
      this.armingHandsFree = null;
    }
    this.stopAudio(); // barge-in: silence ASA the moment the user starts talking
    // This click is a user gesture - unlock audio now so the (voice-triggered) spoken reply,
    // which fires later outside any gesture, isn't blocked by the autoplay policy.
    this.ensureAudioContext();
    this.error = null;
    this.notice = null;
    this.status = 'transcribing';
    this.turnState = 'finalizing';
    if (handsFreeWasArmed) {
      this.stopVadMonitor();
      this.destroySttSession();
      this.releaseStream(true);
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: this.microphoneConstraints() });
    } catch {
      if (captureGeneration === this.captureGeneration) {
        this.fail('Microphone access denied - allow it in browser settings.');
      }
      return;
    }
    if (captureGeneration !== this.captureGeneration) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    try {
      // Wait for the session to be ready before starting capture at all - not concurrently with it.
      // Starting capture early (setara-s94o round 5) meant PCM had nowhere authoritative to go until
      // ready, so it was buffered and burst-flushed once the handshake resolved: ~50 frames arriving
      // at once, exceeding the core relay's in-flight window and frame-rate policy (RC-03, ASA STT
      // accuracy recovery plan). The AudioContext + STT worklet module are already warmed well before
      // this point (preloadCapture(), called on ASA panel open), so this sequential order costs only
      // the real session-open handshake latency, not a cold worklet compile.
      await this.openSttSession(mode);
      if (captureGeneration !== this.captureGeneration) return;
      const captureStarted = await this.startPcmCapture();
      if (captureGeneration !== this.captureGeneration) return;
      if (!captureStarted) {
        throw new SttSessionError('STT_CAPTURE_UNAVAILABLE', 'Microphone capture could not start', true);
      }
    } catch (error) {
      if (captureGeneration !== this.captureGeneration) return;
      this.fail(sttErrorMessage(error));
      return;
    }
    this.status = 'recording';
    this.turnState = 'hearing';
    this.beep(); // static mic-on beep (was the spoken "Yes?" cue)
    asaLog('voice', 'recording started', { mode });
    const policy = STT_MODE_POLICIES[mode];
    this.autoStop = setTimeout(() => {
      void this.finishManualCapture(policy.maxDurationReason).then((transcript) => {
        if (transcript) this.onReviewTranscript?.(transcript);
      });
    }, policy.maxDurationSeconds * 1_000);
  }

  /** Stop the manual v2 session. Dictation remains review-only until the user submits it. */
  async stopRecording(): Promise<SidecarTranscript | null> {
    return this.finishManualCapture('user_stop');
  }

  private async finishManualCapture(reason: SttFlushReason): Promise<SidecarTranscript | null> {
    if (
      this.status !== 'recording' ||
      !this.sttSession ||
      (this.sttMode !== 'command' && this.sttMode !== 'dictation')
    ) {
      return null;
    }
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    const mode = this.sttMode;
    const session = this.sttSession;
    this.status = 'transcribing';
    this.turnState = 'finalizing';
    this.sttFinalizing = true;
    this.stopPcmCapture();
    try {
      const result = await session.stop(reason);
      const transcript = await this.processSttResult(mode, result, true);
      if (!transcript) return null;
      if (sttFinalDisposition(mode, result) === 'auto_submit') {
        this.onTranscript?.(transcript.text, transcript.voiceInput);
        return null;
      }
      return transcript;
    } catch (error) {
      this.fail(sttErrorMessage(error));
      return null;
    } finally {
      this.sttFinalizing = false;
      this.destroySttSession(session);
      this.releaseStream(true);
    }
  }

  /** Apply finality policy, diagnostics, normalization, and entity resolution to a v2 final. */
  private async processSttResult(
    mode: SttMode,
    result: SttFinalResult,
    playProcessingCue: boolean,
  ): Promise<SidecarTranscript | null> {
    this.turnState = 'understanding';
    this.notice = null;
    this.lastSttStats = {
      mode,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      finality: result.finality,
      audioDroppedMs: result.audioDroppedMs,
      degraded: result.degraded,
      framesProduced: result.transport.framesProduced,
      framesSent: result.transport.framesSent,
      framesDropped: result.transport.framesDropped,
      audioProducedMs: result.transport.audioProducedMs,
      audioSentMs: result.transport.audioSentMs,
      maxBufferedAmount: result.transport.maxBufferedAmount,
      reconnects: result.transport.reconnects,
    };
    asaLog('voice', 'STT final', this.lastSttStats);
    if (!isReviewableSttFinal(result)) {
      if (result.finality !== 'cancelled') {
        this.fail('Could not understand audio. Try again with less background noise.');
      }
      return null;
    }
    if (isLikelyVoiceNoise(result.text)) {
      this.fail('Could not understand audio. Try again with less background noise.');
      return null;
    }
    if (result.fallbackUsed) {
      this.notice = `Primary STT unavailable. Used ${result.provider || 'the fallback'} provider.`;
    } else if (result.degraded) {
      this.notice = 'Voice capture was interrupted. Review the recovered transcript before sending.';
    }
    if (playProcessingCue) this.playCue('processing');
    this.status = 'idle';
    this.turnState = this.handsFree ? 'armed' : 'idle';
    return this.finalizeTranscript(result.text);
  }

  /**
   * Normalize + entity-resolve a raw transcript from the v2 final. No LLM
   * "refine" pass - it added a round-trip of latency and often rewrote a correct transcript into
   * the wrong intent; accuracy comes from the STT model + hotword biasing + entity resolution.
   */
  private async finalizeTranscript(raw: string): Promise<SidecarTranscript> {
    // 1) Normalize spoken numbers/versions/dates ("one point zero point one" → "1.0.1").
    const normalized = normalizeTranscript(raw, 'en');
    let text = normalized.normalizedText.trim() || raw;
    let matches: EntityMatch[] = [];
    // 2) Resolve entity names against the catalog ("rak sara" → "Raksara"). Best-effort.
    if (this.catalog) {
      try {
        const { EntityResolver } = await import('./entity-resolver');
        const resolved = new EntityResolver(this.catalog).resolve(normalized, this.resolverContext());
        if (resolved.correctedText.trim()) text = resolved.correctedText.trim();
        matches = resolved.matches;
        asaLog('voice', 'entities', {
          matches: resolved.matches.length,
          clarify: resolved.clarifications.length,
        });
      } catch (e) {
        asaWarn('voice', 'entity resolution failed', e);
      }
    }
    asaLog('voice', 'transcript processed', { rawChars: raw.length, finalChars: text.length });
    return {
      text,
      voiceInput: {
        source: 'sidecar',
        rawText: raw,
        normalizedText: normalized.normalizedText.trim() || raw,
        resolvedText: text,
        entities: matches.slice(0, 20).map((match) => ({
          type: match.type,
          id: match.id,
          display: match.display,
          originalSpan: match.originalSpan,
          score: match.score,
          resolution: match.resolution,
        })),
      },
    };
  }

  private resolverContext(): ResolverContext {
    if (typeof window === 'undefined') return {};
    const m = window.location.pathname.match(/\/projects\/([^/]+)/);
    return { projectKey: m?.[1] };
  }

  cancelRecording(): void {
    this.captureGeneration += 1;
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    this.stopPcmCapture();
    this.destroySttSession();
    this.releaseStream();
    this.status = 'idle';
  }

  /** Prepare for a reply: cancel any prior playback and unlock audio. Call inside the user gesture. */
  beginSpeech(): void {
    this.stopAudio(); // cancels any prior playback + bumps the generation + resets the queue
    if (!this.ttsEnabled) { asaLog('voice', 'TTS disabled - reply will be text-only'); return; }
    this.turnState = 'speaking';
    this.ensureAudioContext();
  }

  /** Warm the AudioContext + STT capture worklet ahead of the user's first recording, so clicking
   *  "record" doesn't pay a cold module-compile cost during the actual utterance - a live capture
   *  showed ~750ms of audio lost at the very start of a recording waiting for `addModule()` to
   *  resolve (setara-s94o STT truncation incident). Safe to call before any user gesture: creating
   *  an AudioContext doesn't need one, only resuming it to 'running' does (done lazily inside
   *  ensureAudioContext once a recording actually starts). */
  preloadCapture(): void {
    this.ensureAudioContext();
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.audioCtx) {
      this.audioCtx = new Ctor();
      // Load the STT capture worklet as soon as a context exists so startPcmCapture's graph build
      // almost never has to wait on module compilation, even on the VAD-onset hot path.
      void preloadSttWorklet(this.audioCtx).catch((error) =>
        asaWarn('voice', 'STT AudioWorklet module failed to preload', error));
      // Only opted-in speex/rnnoise users pay this fetch/compile cost, and they pay it once here
      // instead of on their first recording's prepare() call.
      const resolvedMode = resolveAudioEnhancerMode(this.noiseSuppressionSelection());
      if (resolvedMode === 'speex' || resolvedMode === 'rnnoise') {
        void preloadAudioEnhancer(this.audioCtx, resolvedMode).catch((error) =>
          asaWarn('voice', 'Noise suppression assets failed to preload', error));
      }
    }
    if (this.audioCtx.state === 'suspended') {
      // setara-s94o: one-shot timing probe to prove/disprove the resume-latency theory for
      // start-of-recording truncation - remove once the gap is confirmed closed.
      const tCall = Math.round(performance.now());
      void this.audioCtx.resume().then(() =>
        asaLog('voice', 'AudioContext resumed', { tCall, tResolved: Math.round(performance.now()) }));
    }
    return this.audioCtx;
  }

  private useLegacyScriptProcessor(): boolean {
    return typeof localStorage !== 'undefined' &&
      localStorage.getItem(LEGACY_SCRIPT_PROCESSOR_PREF_KEY) === '1';
  }

  private noiseSuppressionSelection(): AudioEnhancerSelection {
    let requested: AudioSuppressionMode = 'auto';
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(NOISE_SUPPRESSION_MODE_PREF_KEY);
      if (stored === 'auto' || stored === 'speex' || stored === 'rnnoise' || stored === 'browser' || stored === 'none') {
        requested = stored;
      }
    }
    // `auto` defaults to browser-native, not an enhanced mode (setara-f05x voice regression fix):
    // Speex is a narrowband (8kHz-era) preprocessor that measurably hurt STT accuracy when run
    // unconditionally on full wideband mic input, and it shipped as the silent `auto` default to
    // every capable browser without the WER/CER corpus validation the design called for as a
    // prerequisite (see setara-ikmt). Explicit `speex`/`rnnoise` selection still works unchanged.
    return { requested, preferredEnhancedMode: 'browser', fallback: 'browser' };
  }

  private microphoneConstraints(): MediaTrackConstraints {
    return buildMicrophoneConstraints(resolveAudioEnhancerMode(this.noiseSuppressionSelection()));
  }

  /**
   * Speak one dedicated 'speech' text from the backend (separate from the displayed markdown).
   * Synthesized + played as a single ordered utterance; markdown is stripped as a safety net.
   */
  speakText(text: string): void {
    if (!this.ttsEnabled) return;
    const spoken = stripMarkdown(text).trim();
    if (!spoken || !/[a-z0-9]/i.test(spoken)) return;
    if (this.speakOnlyShort && spoken.length > SPEAK_SHORT_LIMIT) {
      asaLog('voice', 'skip TTS (too long)', spoken.length);
      return;
    }
    const gen = this.speechGen;
    this.speakChain = this.speakChain.then(() => this.synthAndPlay(spoken, gen)).catch(() => {});
  }

  private async synthAndPlay(text: string, gen: number): Promise<void> {
    if (gen !== this.speechGen) return; // barge-in happened - drop this utterance
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    // Prefer the streaming endpoint (playback starts on first chunk); fall back to batch synth.
    const res = await synthesizeSpeechStream(text, this.voiceId ?? undefined);
    if (gen !== this.speechGen) { try { await res?.body?.cancel(); } catch { /* ignore */ } return; }
    if (res && res.body) {
      if (await this.playPcmStream(res, ctx, gen)) return;
      asaWarn('voice', 'TTS stream failed before audio; falling back to batch synth');
    }
    else asaWarn('voice', 'TTS stream unavailable; falling back to batch synth');
    await this.synthAndPlayBatch(text, gen, ctx);
  }

  /**
   * Read raw PCM16 (mono, X-Sample-Rate) as it arrives and play it gaplessly. Tiny network chunks
   * are merged into ~TTS_FRAME_MS buffers (fewer node boundaries), playback is held back by a small
   * TTS_PREROLL_MS jitter buffer to absorb decode/network jitter, and buffers are scheduled on a
   * monotonic cursor so consecutive samples abut exactly (no clicks). Only a true underrun (decode
   * slower than real-time, cursor falls behind) inserts a gap instead of overlapping.
   */
  private async playPcmStream(res: Response, ctx: AudioContext, gen: number): Promise<boolean> {
    const sampleRate = Number(res.headers.get('X-Sample-Rate')) || 24000;
    const frameSamples = Math.max(1, Math.floor((TTS_FRAME_MS / 1000) * sampleRate));
    const reader = res.body!.getReader();
    let leftover: Uint8Array<ArrayBuffer> | null = null; // carry an odd trailing byte across reads
    let pending = new Float32Array(0); // accumulated samples not yet scheduled
    let cursor = 0;                    // ctx time the next buffer starts
    let started = false;
    const ended: Promise<void>[] = [];
    let chunks = 0;
    let underruns = 0;
    let scheduledSamples = 0;
    let receivedSamples = 0;

    const schedule = (frame: Float32Array) => {
      const buffer = ctx.createBuffer(1, frame.length, sampleRate);
      buffer.getChannelData(0).set(frame);
      if (!started) { cursor = ctx.currentTime + TTS_PREROLL_MS / 1000; started = true; }
      else if (cursor < ctx.currentTime) {
        underruns += 1;
        cursor = ctx.currentTime + TTS_UNDERRUN_RECOVERY_MS / 1000;
      }
      const at = Math.max(cursor, ctx.currentTime);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      this.streamSources.add(src);
      ended.push(new Promise<void>((resolve) => {
        src.onended = () => { this.streamSources.delete(src); resolve(); };
      }));
      src.start(at);
      cursor = at + buffer.duration;
      chunks += 1;
      scheduledSamples += frame.length;
    };

    const appendSamples = (samples: Float32Array) => {
      const merged = new Float32Array(pending.length + samples.length);
      merged.set(pending); merged.set(samples, pending.length);
      pending = merged;
      let off = 0;
      while (pending.length - off >= frameSamples) {
        schedule(pending.subarray(off, off + frameSamples));
        off += frameSamples;
      }
      if (off > 0) pending = pending.slice(off);
    };

    const finishPlayback = async () => {
      if (pending.length > 0 && gen === this.speechGen) schedule(pending);
      await Promise.all(ended);
      this.ttsPlayback = {
        chunks,
        underruns,
        scheduledMs: Math.round((scheduledSamples / sampleRate) * 1000),
        sampleRate,
      };
      asaLog('voice', 'TTS stream playback stats', this.ttsPlayback);
      return true;
    };

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (gen !== this.speechGen) { try { await reader.cancel(); } catch { /* ignore */ } return true; }
        if (!value || value.length === 0) continue;

        // Concatenate any leftover odd byte, then split into whole 16-bit samples.
        let bytes: Uint8Array<ArrayBuffer> = value as Uint8Array<ArrayBuffer>;
        if (leftover) {
          const m = new Uint8Array(leftover.length + bytes.length);
          m.set(leftover); m.set(bytes, leftover.length);
          bytes = m; leftover = null;
        }
        const usable = bytes.length - (bytes.length % 2);
        if (usable < bytes.length) leftover = bytes.slice(usable);
        if (usable === 0) continue;

        const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
        const samples = new Float32Array(usable / 2);
        for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
        receivedSamples += samples.length;
        appendSamples(samples);
      }
      return finishPlayback();
    } catch (e) {
      const disposition = classifyPcmStreamError(e, receivedSamples);
      if (disposition === 'eof') {
        asaLog('voice', 'Firefox closed TTS transport after audio; treating as end of stream');
        return finishPlayback();
      }
      asaWarn('voice', 'TTS stream playback failed', e);
      if (disposition === 'failed') return finishPlayback();
      return false;
    }
  }

  private async synthAndPlayBatch(text: string, gen: number, ctx: AudioContext): Promise<void> {
    const blob = await synthesizeSpeech(text, this.voiceId ?? undefined);
    if (!blob) { asaWarn('voice', 'TTS synth returned nothing - sidecar unavailable?'); return; }
    if (gen !== this.speechGen) return;
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch (e) {
      asaWarn('voice', 'failed to decode TTS audio', e);
      return;
    }
    if (gen !== this.speechGen) return;
    await new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => { this.currentSource = null; resolve(); };
      this.currentSource = source;
      source.start();
    });
  }

  /** Stop playback and cancel any queued/in-flight speech (barge-in). */
  stopAudio(): void {
    this.speechGen += 1;
    this.speakChain = Promise.resolve();
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* ignore */ }
      this.currentSource = null;
    }
    for (const src of this.streamSources) {
      try { src.stop(); } catch { /* ignore */ }
    }
    this.streamSources.clear();
  }

  /**
   * Play a short spoken cue ("Okay.", "Processing.", …) in the user's chosen voice. Clips are
   * fetched once from the backend (which generates them via the sidecar) and cached decoded.
   * Falls back to a synthetic tone if the clip can't be fetched/decoded.
   */
  playCue(cue: Cue): void {
    if (!this.earcons) return;
    void this.playCueAsync(cue);
  }

  /** Short static beep for mic-on - replaces the spoken "Yes?" cue some users found annoying. */
  beep(freq = 880): void {
    if (!this.earcons) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private async playCueAsync(cue: Cue): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const voice = this.voiceId ?? 'asa_default';
    const key = `${voice}/${cue}`;
    try {
      let buffer = this.cueBuffers.get(key);
      if (!buffer) {
        const bytes = await fetchVoiceCue(voice, cue);
        if (!bytes) { this.playTone(cue); return; }
        buffer = await ctx.decodeAudioData(bytes);
        this.cueBuffers.set(key, buffer);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch {
      this.playTone(cue);
    }
  }

  /** Pre-fetch + decode cue clips for the current voice so the first cue plays without lag. */
  async warmCues(): Promise<void> {
    if (!this.earcons) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const voice = this.voiceId ?? 'asa_default';
    for (const cue of ['listening', 'processing', 'ok', 'sorry'] as Cue[]) {
      const key = `${voice}/${cue}`;
      if (this.cueBuffers.has(key)) continue;
      try {
        const bytes = await fetchVoiceCue(voice, cue);
        if (bytes) this.cueBuffers.set(key, await ctx.decodeAudioData(bytes));
      } catch { /* fall back to tone at play time */ }
    }
  }

  /** Synthetic fallback when a spoken cue clip isn't available. */
  private playTone(cue: Cue): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    const seqs: Record<Cue, number[]> = {
      listening: [880],
      processing: [520],
      ok: [660, 988],
      sorry: [400, 300],
    };
    const t0 = ctx.currentTime;
    seqs[cue].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + i * 0.1;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  /** Short static two-note "done" chime (replaces the spoken "Done." cue). */
  private doneBeep(): void {
    if (!this.earcons) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  /**
   * Turn finished. Play the static "done" chime ONLY for a successful turn that produced content but
   * was NOT spoken (e.g. an action/navigation, or TTS off) - a spoken answer is its own completion,
   * and an error already played the sorry cue, so neither should also get a "done". Re-arm hands-free
   * unless the turn was aborted.
   */
  endTurn(opts: { playDone: boolean; rearm: boolean }): void {
    if (opts.playDone) this.doneBeep();
    if (opts.rearm) {
      // Re-arm AFTER any queued speech finishes so the mic doesn't hear ASA's own voice.
      this.speakChain = this.speakChain.then(() => {
        if (!this.handsFree || !this.handsFreeRuntimeActive) return;
        this.turnState = 'armed';
        void this.armHandsFree();
      });
    }
  }

  // ── Hands-free (energy VAD: auto-record on speech, stop on silence, loop) ──────────────────
  async armHandsFree(): Promise<void> {
    if (this.armingHandsFree) return this.armingHandsFree;
    const arming = this.doArmHandsFree();
    this.armingHandsFree = arming;
    try {
      await arming;
    } finally {
      if (this.armingHandsFree === arming) this.armingHandsFree = null;
    }
  }

  syncHandsFree(active: boolean): void {
    this.handsFreePanelActive = active;
    const desired = active && this.handsFree;
    if (desired === this.handsFreeRuntimeActive) return;
    this.handsFreeRuntimeActive = desired;
    if (desired) {
      queueMicrotask(() => { void this.armHandsFree(); });
      return;
    }
    this.disarmHandsFree();
  }

  private async doArmHandsFree(): Promise<void> {
    if (!this.handsFreeRuntimeActive || !this.handsFree || typeof navigator === 'undefined') return;
    if (
      this.vadTimer ||
      this.status === 'listening' ||
      this.status === 'recording' ||
      this.status === 'transcribing'
    ) return;
    const generation = this.handsFreeGeneration;
    this.error = null;
    try {
      if (!this.stream) this.stream = await navigator.mediaDevices.getUserMedia({ audio: this.microphoneConstraints() });
    } catch {
      if (this.isHandsFreeArmCurrent(generation)) {
        this.fail('Microphone access denied - allow it in browser settings.');
      }
      return;
    }
    const stream = this.stream;
    if (!stream) return;
    if (!this.isHandsFreeArmCurrent(generation)) {
      this.releaseStaleHandsFreeStream(stream);
      return;
    }
    const ctx = this.ensureAudioContext();
    if (!ctx) {
      this.fail('Microphone monitoring is unavailable in this browser.');
      return;
    }
    if (!this.isHandsFreeArmCurrent(generation)) {
      this.releaseStaleHandsFreeStream(stream);
      return;
    }
    try {
      await this.openSttSession('hands_free');
    } catch (error) {
      if (this.isHandsFreeArmCurrent(generation)) this.fail(sttErrorMessage(error));
      return;
    }
    const session = this.sttSession;
    if (!session || !this.isHandsFreeArmCurrent(generation)) {
      if (session) this.destroySttSession(session);
      this.releaseStaleHandsFreeStream(stream);
      return;
    }
    this.vadCapturing = false;
    this.onsetFrames = 0;
    this.armedAt = Date.now();
    this.status = 'listening';
    this.turnState = 'armed';

    if (this.shouldUseMlVad()) {
      if (this.micVad) {
        // VAD kept alive from previous cycle (releaseStream paused it). Just resume.
        const vad = this.micVad;
        this.mlGated = true;
        try {
          await vad.resume();
          if (!this.isHandsFreeArmCurrent(generation)) {
            if (this.micVad === vad) {
              this.micVad = null;
              this.mlGated = false;
              void vad.destroy().catch(() => {});
            }
            this.destroySttSession(session);
            this.releaseStaleHandsFreeStream(stream);
            return;
          }
          asaLog('voice', 'hands-free armed (ML VAD, resumed)');
          return;
        } catch {
          // Stream died underneath (for example mic revoked). Fall through to recreate.
          if (this.micVad === vad) this.micVad = null;
          this.mlGated = false;
          void vad.destroy().catch(() => {});
        }
      }
      if (!this.mlVadUnavailable) {
        const vad = await createMlVad({
          stream,
          audioContext: ctx,
          // Ignore onsets in the settle window just like energy VAD.
          onSpeechStart: () => { if (Date.now() - this.armedAt >= VAD_SETTLE_MS) this.beginVadCapture(Date.now()); },
          onSpeechEnd: () => { void this.endVadCapture(); },
        });
        if (!this.isHandsFreeArmCurrent(generation)) {
          if (vad) void vad.destroy().catch(() => {});
          this.destroySttSession(session);
          this.releaseStaleHandsFreeStream(stream);
          return;
        }
        this.micVad = vad;
        if (!vad) this.mlVadUnavailable = true;
      }
      if (this.micVad) {
        this.mlGated = true;
        asaLog('voice', 'hands-free armed (ML VAD)');
        return;
      }
    } else if (this.micVad) {
      const v = this.micVad; this.micVad = null; this.mlGated = false;
      void v.destroy().catch(() => {});
    }

    // Default lightweight mode: energy VAD via an analyser polled every VAD_POLL_MS.
    this.mlGated = false;
    try {
      const source = ctx.createMediaStreamSource(stream);
      this.vadSource = source;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      this.vadData = new Uint8Array(this.analyser.fftSize);
      this.vadTimer = setInterval(() => this.vadTick(), VAD_POLL_MS);
    } catch {
      this.fail('Microphone monitoring could not start. Try again.');
      return;
    }
    asaLog('voice', 'hands-free armed (energy VAD)');
  }

  private isHandsFreeArmCurrent(generation: number): boolean {
    return (
      this.handsFree &&
      this.handsFreeRuntimeActive &&
      generation === this.handsFreeGeneration
    );
  }

  private releaseStaleHandsFreeStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => track.stop());
    if (this.stream === stream) this.stream = null;
  }

  disarmHandsFree(): void {
    this.handsFreeRuntimeActive = false;
    this.handsFreeGeneration += 1;
    this.armingHandsFree = null;
    this.stopVadMonitor();
    this.vadCapturing = false;
    this.turnState = 'paused';
    this.wakeMode = 'wake';
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    this.stopPcmCapture();
    this.destroySttSession();
    this.releaseStream(true); // force: destroy VAD + stop tracks (full cleanup)
    if (this.status === 'listening' || this.status === 'recording') this.status = 'idle';
  }

  private stopVadMonitor(): void {
    if (this.vadTimer) { clearInterval(this.vadTimer); this.vadTimer = null; }
    try { this.vadSource?.disconnect(); } catch { /* ignore */ }
    try { this.analyser?.disconnect(); } catch { /* ignore */ }
    this.vadSource = null;
    this.analyser = null;
    this.vadData = null;
  }

  private vadTick(): void {
    if (!this.analyser || !this.vadData) return;
    this.analyser.getByteTimeDomainData(this.vadData);
    let sum = 0;
    for (let i = 0; i < this.vadData.length; i++) {
      const x = (this.vadData[i] - 128) / 128;
      sum += x * x;
    }
    const rms = Math.sqrt(sum / this.vadData.length);
    const now = Date.now();
    // Throttled RMS log so thresholds can be tuned per mic via the asa.debug console flag.
    if (now - this.lastVadLogAt > 1000) { this.lastVadLogAt = now; asaLog('voice', 'vad rms', rms.toFixed(3)); }
    if (!this.vadCapturing) {
      // Settle window: ignore onsets right after arming (room echo / TTS tail) to avoid self-trigger.
      if (now - this.armedAt < VAD_SETTLE_MS) { this.onsetFrames = 0; return; }
      // Require several consecutive loud frames so a click/cough doesn't start a capture.
      this.onsetFrames = rms > VAD_START_RMS ? this.onsetFrames + 1 : 0;
      if (this.onsetFrames >= VAD_ONSET_FRAMES && !this.vadCaptureStarting) void this.beginVadCapture(now);
    } else {
      if (rms > this.maxRms) this.maxRms = rms;
      if (rms > VAD_STOP_RMS) this.lastVoiceAt = now;
      if (now - this.lastVoiceAt > VAD_SILENCE_MS) void this.endVadCapture();
    }
  }

  private async beginVadCapture(now: number): Promise<void> {
    if (!this.stream || this.sttMode !== 'hands_free' || !this.sttSession?.isReady) return;
    if (this.vadCaptureStarting || this.vadCapturing) return;
    this.vadCaptureStarting = true;
    try {
      this.stopAudio(); // barge-in: stop active and queued TTS before microphone delivery
      if (!(await this.startPcmCapture())) {
        this.fail('Microphone capture could not start. Try again.');
        return;
      }
      // A concurrent teardown (disarm, mode switch) may have landed while we awaited the graph build.
      if (this.sttMode !== 'hands_free' || !this.sttSession?.isReady) {
        this.stopPcmCapture();
        return;
      }
      this.vadCapturing = true;
      this.utteranceStart = now;
      this.lastVoiceAt = now;
      this.maxRms = 0;
      this.status = 'recording';
      this.turnState = 'hearing';
      this.beep();
      const policy = STT_MODE_POLICIES.hands_free;
      this.autoStop = setTimeout(() => {
        void this.endVadCapture(policy.maxDurationReason);
      }, policy.maxDurationSeconds * 1_000);
    } finally {
      this.vadCaptureStarting = false;
    }
  }

  private async endVadCapture(reason: SttFlushReason = 'vad_silence'): Promise<void> {
    if (!this.vadCapturing) return;
    const session = this.sttSession;
    if (!session || this.sttMode !== 'hands_free') return;
    this.vadCapturing = false;
    this.turnState = 'finalizing';
    this.sttFinalizing = true;
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    const tooShort = Date.now() - this.utteranceStart < VAD_MIN_UTTERANCE_MS;
    // ML VAD already gated on speech presence; the energy analyser isn't running so maxRms is 0.
    // Only apply the loudness floor on the energy-VAD path.
    const tooQuiet = !this.mlGated && this.maxRms < VAD_MIN_PEAK_RMS;
    this.stopVadMonitor();
    this.stopPcmCapture();

    let result: SttFinalResult;
    try {
      result = await session.stop(reason);
    } catch (error) {
      this.sttFinalizing = false;
      this.fail(sttErrorMessage(error));
      return;
    } finally {
      this.sttFinalizing = false;
      this.destroySttSession(session);
    }
    if (tooShort || tooQuiet) { this.rearmAfterNoise(tooShort, tooQuiet); return; }
    const transcript = await this.processSttResult('hands_free', result, false);

    if (transcript && !isLikelyVoiceNoise(transcript.text) && this.onTranscript) {
      const route = routeVoiceTranscript(this.wakeMode, transcript.text);
      this.wakeMode = route.nextMode;
      if (route.action === 'review') {
        const routedTranscript: SidecarTranscript = {
          text: route.command,
          voiceInput: {
            ...transcript.voiceInput,
            resolvedText: route.command,
          },
        };
        this.releaseStream(true); // free the mic during reply/review so it cannot hear ASA
        if (sttFinalDisposition('hands_free', result) === 'auto_submit') {
          this.playCue('processing');
          this.onTranscript(routedTranscript.text, routedTranscript.voiceInput);
        } else {
          this.turnState = 'paused';
          this.onReviewTranscript?.(routedTranscript);
        }
      } else {
        void this.armHandsFree();
      }
    } else {
      if (transcript) {
        asaLog('voice', 'hands-free: dropped likely STT hallucination', {
          chars: transcript.text.length,
        });
      }
      void this.armHandsFree(); // nothing usable - keep listening
    }
  }

  private rearmAfterNoise(tooShort: boolean, tooQuiet: boolean): void {
    asaLog('voice', 'hands-free: ignored noise', { tooShort, tooQuiet, peak: this.maxRms.toFixed(3) });
    if (!this.handsFree || !this.handsFreeRuntimeActive) return;
    this.status = 'idle';
    this.turnState = 'armed';
    void this.armHandsFree();
  }

  private shouldUseMlVad(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ML_VAD_PREF_KEY) === '1';
  }

  // ── Shared v2 STT transport ──────────────────────────────────────────────────────────────────
  private async openSttSession(mode: SttMode): Promise<void> {
    if (this.sttSession?.isReady && this.sttMode === mode) return;
    this.destroySttSession();
    const prepared = this.voiceSession ?? await prepareVoiceSession();
    if (!prepared) {
      throw new SttSessionError('STT_SESSION_UNAVAILABLE', 'Voice session could not be prepared', true);
    }
    this.voiceSession = prepared;
    const start: SttStartControl = {
      type: 'start',
      protocolVersion: '2',
      sessionId: prepared.voiceSessionId,
      requestId: crypto.randomUUID(),
      mode,
      provider: 'auto',
      audio: {
        sampleRate: 16_000,
        channels: 1,
        sampleFormat: 's16le',
        frameDurationMs: 20,
      },
      language: prepared.stt.language,
      prompt: prepared.stt.prompt,
      hotwords: prepared.stt.hotwords,
      maxDurationSeconds: STT_MODE_POLICIES[mode].maxDurationSeconds,
    };
    let session!: SttSession;
    session = new SttSession({
      start,
      socketFactory: () => openSttStream(prepared.voiceSessionId),
      finalTimeoutMs: STT_MODE_POLICIES[mode].finalizationTimeoutMs,
      onPartial: (event) => {
        if (this.sttSession === session) this.interimTranscript = event.text;
      },
      onFinal: (result) => this.handleSttSessionFinal(session, mode, result),
      onError: (error) => asaWarn('voice', 'STT session error', error),
      onFlowControl: (event) => {
        if (event.sustained) {
          this.notice = 'Voice capture stopped because the connection could not keep up.';
        }
      },
    });
    this.sttSession = session;
    this.sttMode = mode;
    this.interimTranscript = '';
    try {
      await session.open();
    } catch (error) {
      this.destroySttSession(session);
      throw error;
    }
    asaLog('voice', 'streaming STT ready', { mode, maxDurationSeconds: start.maxDurationSeconds });
  }

  private async startPcmCapture(): Promise<boolean> {
    const ctx = this.audioCtx;
    if (!ctx || !this.stream || this.sttCaptureActive || this.sttCaptureStarting) {
      return false;
    }
    if (this.useLegacyScriptProcessor()) {
      return this.startPcmCaptureLegacy(ctx, this.stream);
    }
    this.sttCaptureStarting = true;
    try {
      return await this.startPcmCaptureWorklet(ctx, this.stream);
    } catch (error) {
      asaWarn('voice', 'AudioWorklet capture failed; falling back to ScriptProcessor', error);
      return this.startPcmCaptureLegacy(ctx, this.stream);
    } finally {
      this.sttCaptureStarting = false;
    }
  }

  /** Capture graph is only ever built after the session is confirmed ready (see startRecording /
   *  beginVadCapture), so a not-ready session here means this frame raced a teardown of its own
   *  capture generation - drop it silently, same as the generation check above, rather than buffer
   *  it (setara-s94o RC-03: buffering-then-bursting this was itself the cause of relay pressure). */
  private routePcmFrame(captureGeneration: number, frame: ArrayBuffer): void {
    if (this.captureGeneration !== captureGeneration) return;
    const session = this.sttSession;
    if (!session?.isReady) return;
    session.sendPcm(frame);
  }

  /** setara-f05x.9/.10: default STT capture path — AudioWorklet plus the selected noise-suppression
   *  enhancer, no ScriptProcessorNode. */
  private async startPcmCaptureWorklet(ctx: AudioContext, stream: MediaStream): Promise<boolean> {
    const captureGeneration = this.captureGeneration;
    const capture = new AudioCaptureSession();
    capture.onPcmFrame = (frame) => this.routePcmFrame(captureGeneration, frame);
    await capture.prepare({
      context: ctx,
      stream,
      frameDurationMs: 20,
      enhancerSelection: this.noiseSuppressionSelection(),
    });
    if (this.captureGeneration !== captureGeneration) {
      // Superseded (cancel/reset/teardown) while the graph build was in flight.
      capture.destroy();
      return false;
    }
    if (capture.stream && capture.stream !== stream) {
      // Noise-suppression fallback reacquired the microphone track — VAD and cleanup must track it.
      this.stream = capture.stream;
    }
    this.sttCapture = capture;
    this.sttCaptureActive = true;
    return true;
  }

  private startPcmCaptureLegacy(ctx: AudioContext, stream: MediaStream): boolean {
    const captureGeneration = this.captureGeneration;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0; // route to destination so onaudioprocess fires, but stay silent (no echo)
    const ratio = ctx.sampleRate / STREAM_RATE;
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const out = downsamplePcm16(input, ratio);
      this.routePcmFrame(captureGeneration, out);
    };
    source.connect(processor);
    processor.connect(sink);
    sink.connect(ctx.destination);
    this.sttSource = source;
    this.sttProcessor = processor;
    this.sttSink = sink;
    this.sttCaptureActive = true;
    return true;
  }

  private stopPcmCapture(): void {
    this.sttCaptureActive = false;
    this.interimTranscript = '';
    this.sttCapture?.destroy();
    this.sttCapture = null;
    try { if (this.sttProcessor) this.sttProcessor.onaudioprocess = null; } catch { /* ignore */ }
    try { this.sttSource?.disconnect(); } catch { /* ignore */ }
    try { this.sttProcessor?.disconnect(); } catch { /* ignore */ }
    try { this.sttSink?.disconnect(); } catch { /* ignore */ }
    this.sttSource = null;
    this.sttProcessor = null;
    this.sttSink = null;
  }

  private destroySttSession(expected?: SttSession): void {
    const session = expected ?? this.sttSession;
    if (!session) return;
    session.destroy();
    if (this.sttSession === session) {
      this.sttSession = null;
      this.sttMode = null;
      this.interimTranscript = '';
    }
  }

  private handleSttSessionFinal(
    session: SttSession,
    mode: SttMode,
    _result: SttFinalResult,
  ): void {
    if (this.sttSession !== session) return;
    this.stopPcmCapture();
    if (this.sttFinalizing) return;
    queueMicrotask(() => {
      if (this.sttSession !== session || this.sttFinalizing) return;
      if (mode === 'hands_free') {
        if (this.vadCapturing) {
          void this.endVadCapture('client_shutdown');
          return;
        }
        // Core closes an idle relay after its deadline. Refresh while armed without retaining PCM.
        if (this.status === 'listening' && this.handsFreeRuntimeActive) {
          const generation = this.handsFreeGeneration;
          this.destroySttSession(session);
          void this.refreshHandsFreeSession(generation);
        }
        return;
      }
      if (this.status === 'recording') {
        void this.finishManualCapture('client_shutdown').then((transcript) => {
          if (transcript) this.onReviewTranscript?.(transcript);
        });
      }
    });
  }

  private async refreshHandsFreeSession(generation: number): Promise<void> {
    try {
      await this.openSttSession('hands_free');
    } catch (error) {
      // A disarm or manual capture deliberately destroys an in-flight refresh. Its rejection must
      // not fail the newer owner and tear down that owner's microphone/session.
      if (this.isHandsFreeArmCurrent(generation) && this.status === 'listening') {
        this.fail(sttErrorMessage(error));
      }
    }
  }

  setVoice(id: string): void { this.voiceId = id; this.cueBuffers.clear(); this.persist(); void this.warmCues(); }
  setTtsEnabled(v: boolean): void { this.ttsEnabled = v; if (!v) this.stopAudio(); this.persist(); }
  setSpeakOnlyShort(v: boolean): void { this.speakOnlyShort = v; this.persist(); }
  setEarcons(v: boolean): void { this.earcons = v; this.persist(); }

  setHandsFree(v: boolean): void {
    this.handsFree = v;
    this.persist();
    if (v) {
      this.wakeMode = 'wake';
      this.ensureAudioContext();
      if (this.handsFreePanelActive) this.syncHandsFree(true);
    } else {
      this.disarmHandsFree();
    }
  }

  resumeHandsFreeAfterReview(): void {
    if (!this.handsFree || !this.handsFreeRuntimeActive) return;
    this.turnState = 'armed';
    void this.armHandsFree();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    const prefs: SidecarPrefs = {
      ttsEnabled: this.ttsEnabled,
      voiceId: this.voiceId,
      speakOnlyShort: this.speakOnlyShort,
      handsFree: this.handsFree,
      earcons: this.earcons,
    };
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  private releaseStream(force = false): void {
    if (this.micVad && !force) {
      // ML VAD mode: keep stream + VAD alive across utterances so the 2MB ONNX model isn't
      // reloaded every speech cycle. Just pause callbacks during the reply phase.
      void this.micVad.pause().catch(() => {});
      return;
    }
    if (this.micVad) { const v = this.micVad; this.micVad = null; this.mlGated = false; void v.destroy().catch(() => {}); }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private fail(message: string): void {
    this.stopPcmCapture();
    this.destroySttSession();
    this.releaseStream(true);
    this.error = message;
    this.status = 'error';
    this.turnState = 'error';
    this.playCue('sorry');
    asaWarn('voice', 'sidecar voice fail:', message);
  }
}

export const sidecarVoice = new SidecarVoice();

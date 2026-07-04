import { transcribeAudio, synthesizeSpeech, synthesizeSpeechStream, openSttStream, fetchVoiceCatalog, fetchEntityCatalog, fetchVoiceCue, prepareVoiceSession, type AsaPreparedVoiceSession, type AsaVoiceOption } from '$lib/api/asa';
import type { AsaEntityCatalog, AsaVoiceInput } from '$lib/api/asa';
import { asaLog, asaWarn } from '$lib/asa-debug';
import { stripMarkdown } from '$lib/markdown';
import { classifyPcmStreamError } from './stream-errors';
import { normalizeTranscript } from './transcript-normalizer';
import { createMlVad, type MlVadHandle } from './ml-vad';
import { routeVoiceTranscript, type WakeMode } from './wake-router';
import type { EntityMatch, ResolverContext } from './entity-resolver';

/**
 * Push-to-talk voice via the ASA sidecar (through setara-core): record → /transcribe, and
 * /synthesize → playback. Active only when asa.voiceSidecar is true; otherwise ASA is text-only.
 * No browser STT/TTS fallback by design.
 */
const PREF_KEY = 'setara.asa.voice.sidecar';
const ML_VAD_PREF_KEY = 'setara.asa.voice.mlVad';
const MAX_RECORD_MS = 12_000;
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
// Common faster-whisper hallucinations on near-silence — drop these to avoid phantom "yes"/"you".
const STT_HALLUCINATIONS = new Set([
  'you', 'yes', 'no', 'thank you', 'thanks', 'thanks for watching', 'bye', 'okay', 'ok', 'uh', 'um',
  'mm', 'hmm', 'so', '.', 'the', 'i', 'a',
]);

// Let the browser clean the mic input: cancel speaker echo (ASA's own TTS), suppress steady noise,
// and normalize level. Big, free quality win — applied to every capture.
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

const TTS_FRAME_MS = 160;   // merge streamed PCM into ~this-size buffers (fewer node boundaries)
const TTS_PREROLL_MS = 240; // jitter buffer: hold playback back this long so decode jitter can't underrun
const TTS_UNDERRUN_RECOVERY_MS = 80; // when CPU falls behind, rebuild a small lead instead of clicking
const STREAM_RATE = 16_000; // sidecar's native STT rate; we downsample the mic to this before sending
const STREAM_FINAL_TIMEOUT_MS = 4_000; // give up waiting for the WS "final" and use the last partial
const MAX_PENDING_STT_FRAMES = 24; // cap ~2s of ScriptProcessor frames while WS connects

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
  /** Live (not-yet-final) transcript from streaming STT, for an interim on-screen display. */
  interimTranscript = $state('');
  turnState = $state<VoiceTurnState>('idle');
  wakeMode = $state<WakeMode>('wake');
  ttsPlayback = $state<TtsPlaybackStats>({ chunks: 0, underruns: 0, scheduledMs: 0, sampleRate: 0 });

  // Rolling-window streaming STT (hands-free): a ScriptProcessor taps the mic, PCM16 @16kHz is
  // streamed over a WS to the sidecar (via core), partials arrive live, final on "flush".
  private sttWs: WebSocket | null = null;
  private sttProcessor: ScriptProcessorNode | null = null;
  private sttSource: MediaStreamAudioSourceNode | null = null;
  private sttSink: GainNode | null = null;
  private sttFinal: ((text: string) => void) | null = null;
  private streaming = false;
  private pendingSttFrames: ArrayBuffer[] = [];

  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private catalog: AsaEntityCatalog | null = null;
  private voiceSession: AsaPreparedVoiceSession | null = null;
  private preparedFinal: SidecarTranscript | null = null;

  // Hands-free VAD
  private vadSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private vadData: Uint8Array<ArrayBuffer> | null = null;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private utteranceStart = 0;
  private lastVoiceAt = 0;
  private vadCapturing = false;
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

  async startRecording(): Promise<void> {
    if (this.busy) return;
    this.stopAudio(); // barge-in: silence ASA the moment the user starts talking
    // This click is a user gesture — unlock audio now so the (voice-triggered) spoken reply,
    // which fires later outside any gesture, isn't blocked by the autoplay policy.
    if (this.ttsEnabled) this.ensureAudioContext();
    this.error = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
    } catch {
      this.fail('Microphone access denied — allow it in browser settings.');
      return;
    }
    this.chunks = [];
    const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();
    this.status = 'recording';
    this.turnState = 'hearing';
    this.beep(); // static mic-on beep (was the spoken "Yes?" cue)
    asaLog('voice', 'recording started');
    this.autoStop = setTimeout(() => { void this.stopRecording(); }, MAX_RECORD_MS);
  }

  /** Stop, upload, transcribe. Returns the transcript text for review, or null on failure. */
  async stopRecording(): Promise<SidecarTranscript | null> {
    if (this.status !== 'recording' || !this.recorder) return null;
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    const recorder = this.recorder;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
      recorder.stop();
    });
    this.releaseStream();
    this.recorder = null;
    this.turnState = 'finalizing';
    return this.processBlob(blob);
  }

  /** Transcribe → normalize → resolve entities → LLM refine. Shared by push-to-talk + hands-free. */
  private async processBlob(blob: Blob): Promise<SidecarTranscript | null> {
    this.status = 'transcribing';
    this.turnState = 'understanding';
    asaLog('voice', 'transcribing', { bytes: blob.size, type: blob.type });
    const result = await transcribeAudio(blob);
    if (!result || !result.text.trim()) {
      this.fail('Could not transcribe that clearly. Try again or type your request.');
      return null;
    }
    this.playCue('processing'); // spoken ack — got the transcript
    this.status = 'idle';
    this.turnState = this.handsFree ? 'armed' : 'idle';
    return this.finalizeTranscript(result.text);
  }

  /**
   * Normalize + entity-resolve a raw transcript (from batch /stt OR the streaming final). No LLM
   * "refine" pass — it added a round-trip of latency and often rewrote a correct transcript into
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
        asaLog('voice', 'entities', { corrected: text, matches: resolved.matches.length, clarify: resolved.clarifications.length });
      } catch (e) {
        asaWarn('voice', 'entity resolution failed', e);
      }
    }
    asaLog('voice', 'transcript', { raw, final: text });
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
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    try { this.recorder?.stop(); } catch { /* ignore */ }
    this.recorder = null;
    this.releaseStream();
    this.status = 'idle';
  }

  /** Prepare for a reply: cancel any prior playback and unlock audio. Call inside the user gesture. */
  beginSpeech(): void {
    this.stopAudio(); // cancels any prior playback + bumps the generation + resets the queue
    if (!this.ttsEnabled) { asaLog('voice', 'TTS disabled — reply will be text-only'); return; }
    this.turnState = 'speaking';
    this.ensureAudioContext();
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.audioCtx) this.audioCtx = new Ctor();
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    return this.audioCtx;
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
    if (gen !== this.speechGen) return; // barge-in happened — drop this utterance
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
    if (!blob) { asaWarn('voice', 'TTS synth returned nothing — sidecar unavailable?'); return; }
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

  /** Short static beep for mic-on — replaces the spoken "Yes?" cue some users found annoying. */
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
   * was NOT spoken (e.g. an action/navigation, or TTS off) — a spoken answer is its own completion,
   * and an error already played the sorry cue, so neither should also get a "done". Re-arm hands-free
   * unless the turn was aborted.
   */
  endTurn(opts: { playDone: boolean; rearm: boolean }): void {
    if (opts.playDone) this.doneBeep();
    if (opts.rearm) {
      // Re-arm AFTER any queued speech finishes so the mic doesn't hear ASA's own voice.
      this.speakChain = this.speakChain.then(() => { this.turnState = 'armed'; void this.armHandsFree(); });
    }
  }

  // ── Hands-free (energy VAD: auto-record on speech, stop on silence, loop) ──────────────────
  async armHandsFree(): Promise<void> {
    if (this.armingHandsFree) return this.armingHandsFree;
    this.armingHandsFree = this.doArmHandsFree().finally(() => { this.armingHandsFree = null; });
    return this.armingHandsFree;
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
    if (!this.handsFree || typeof navigator === 'undefined') return;
    if (this.vadTimer || this.status === 'recording' || this.status === 'transcribing') return;
    const generation = this.handsFreeGeneration;
    this.error = null;
    try {
      if (!this.stream) this.stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
    } catch {
      this.fail('Microphone access denied — allow it in browser settings.');
      return;
    }
    if (!this.handsFree || generation !== this.handsFreeGeneration) { this.releaseStream(true); return; }
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    if (!this.handsFree || generation !== this.handsFreeGeneration) { this.releaseStream(true); return; }
    this.vadCapturing = false;
    this.onsetFrames = 0;
    this.armedAt = Date.now();
    this.status = 'listening';
    this.turnState = 'armed';

    if (this.shouldUseMlVad()) {
      if (this.micVad) {
        // VAD kept alive from previous cycle (releaseStream paused it). Just resume.
        this.mlGated = true;
        try {
          await this.micVad.resume();
          if (!this.handsFree || generation !== this.handsFreeGeneration) return;
          asaLog('voice', 'hands-free armed (ML VAD, resumed)');
          return;
        } catch {
          // Stream died underneath (for example mic revoked). Fall through to recreate.
          const v = this.micVad; this.micVad = null; this.mlGated = false;
          void v.destroy().catch(() => {});
        }
      }
      if (!this.mlVadUnavailable) {
        this.micVad = await createMlVad({
          stream: this.stream,
          audioContext: ctx,
          // Ignore onsets in the settle window just like energy VAD.
          onSpeechStart: () => { if (Date.now() - this.armedAt >= VAD_SETTLE_MS) this.beginVadCapture(Date.now()); },
          onSpeechEnd: () => { void this.endVadCapture(); },
        });
        if (!this.micVad) this.mlVadUnavailable = true;
      }
      if (!this.handsFree || generation !== this.handsFreeGeneration) return;
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
    const source = ctx.createMediaStreamSource(this.stream);
    this.vadSource = source;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);
    this.vadData = new Uint8Array(this.analyser.fftSize);
    this.vadTimer = setInterval(() => this.vadTick(), VAD_POLL_MS);
    asaLog('voice', 'hands-free armed (energy VAD)');
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
    if (this.streaming) this.teardownStream();
    try { this.recorder?.stop(); } catch { /* ignore */ }
    this.recorder = null;
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
      if (this.onsetFrames >= VAD_ONSET_FRAMES) this.beginVadCapture(now);
    } else {
      if (rms > this.maxRms) this.maxRms = rms;
      if (rms > VAD_STOP_RMS) this.lastVoiceAt = now;
      if (now - this.lastVoiceAt > VAD_SILENCE_MS) void this.endVadCapture();
    }
  }

  private beginVadCapture(now: number): void {
    if (!this.stream) return;
    // Prefer streaming STT (live partials, lower latency); fall back to batch record if WS won't open.
    if (!this.beginStreamCapture()) {
      this.chunks = [];
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.recorder.start();
    }
    this.vadCapturing = true;
    this.utteranceStart = now;
    this.lastVoiceAt = now;
    this.maxRms = 0;
    this.status = 'recording';
    this.turnState = 'hearing';
    this.beep();
    this.autoStop = setTimeout(() => { void this.endVadCapture(); }, MAX_RECORD_MS);
  }

  private async endVadCapture(): Promise<void> {
    if (!this.vadCapturing) return;
    if (!this.streaming && !this.recorder) return;
    this.vadCapturing = false;
    this.turnState = 'finalizing';
    if (this.autoStop) { clearTimeout(this.autoStop); this.autoStop = null; }
    const tooShort = Date.now() - this.utteranceStart < VAD_MIN_UTTERANCE_MS;
    // ML VAD already gated on speech presence; the energy analyser isn't running so maxRms is 0.
    // Only apply the loudness floor on the energy-VAD path.
    const tooQuiet = !this.mlGated && this.maxRms < VAD_MIN_PEAK_RMS;
    this.stopVadMonitor();

    let transcript: SidecarTranscript | null;
    if (this.streaming) {
      const finalText = await this.endStreamCapture(); // flush + await final partial
      if (tooShort || tooQuiet) { this.rearmAfterNoise(tooShort, tooQuiet); return; }
      this.playCue('processing');
      this.status = 'idle';
      this.turnState = 'understanding';
      transcript = this.preparedFinal ?? (finalText ? await this.finalizeTranscript(finalText) : null);
      this.preparedFinal = null;
    } else {
      const recorder = this.recorder!;
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
        recorder.stop();
      });
      this.recorder = null;
      if (tooShort || tooQuiet) { this.rearmAfterNoise(tooShort, tooQuiet); return; }
      transcript = await this.processBlob(blob);
    }

    if (transcript && !this.isLikelyHallucination(transcript.text) && this.onTranscript) {
      const route = routeVoiceTranscript(this.wakeMode, transcript.text);
      this.wakeMode = route.nextMode;
      if (route.action === 'review') {
        this.releaseStream(true); // free the mic during reply so it cannot hear ASA
        this.onTranscript(route.command, {
          ...transcript.voiceInput,
          resolvedText: route.command,
        });
      } else {
        void this.armHandsFree();
      }
    } else {
      if (transcript) asaLog('voice', 'hands-free: dropped likely STT hallucination', transcript.text);
      void this.armHandsFree(); // nothing usable — keep listening
    }
  }

  private rearmAfterNoise(tooShort: boolean, tooQuiet: boolean): void {
    asaLog('voice', 'hands-free: ignored noise', { tooShort, tooQuiet, peak: this.maxRms.toFixed(3) });
    this.status = 'idle';
    this.turnState = 'armed';
    void this.armHandsFree();
  }

  private shouldUseMlVad(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ML_VAD_PREF_KEY) === '1';
  }

  /** Whisper tends to emit a stock short word on near-silence; treat those as noise in hands-free. */
  private isLikelyHallucination(text: string): boolean {
    const t = text.trim().toLowerCase().replace(/[.!?,]+$/, '');
    return t.length <= 2 || STT_HALLUCINATIONS.has(t);
  }

  // ── Streaming STT capture (taps the mic, sends PCM16@16k over a WS; partials arrive live) ──────
  /** Begin streaming capture on the current mic stream. Returns false if the WS can't open (the
   *  caller then falls back to the batch MediaRecorder path). */
  private beginStreamCapture(): boolean {
    const ctx = this.audioCtx;
    if (!ctx || !this.stream) return false;
    if (this.streaming || this.sttWs) return false;
    const ws = openSttStream(this.voiceSession?.voiceSessionId);
    if (!ws) return false;
    this.sttWs = ws;
    this.streaming = true;
    this.interimTranscript = '';
    this.pendingSttFrames = []; // frames captured before the socket finishes opening
    ws.onopen = () => {
      if (this.voiceSession) {
        ws.send(JSON.stringify({
          type: 'config',
          language: this.voiceSession.stt.language,
          prompt: this.voiceSession.stt.prompt,
          hotwords: this.voiceSession.stt.hotwords,
        }));
      }
      for (const b of this.pendingSttFrames) ws.send(b);
      this.pendingSttFrames = [];
      asaLog('voice', 'streaming STT started');
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        if (msg.type === 'partial') this.interimTranscript = msg.text ?? '';
        else if (msg.type === 'final') this.finishSttFinal(msg.text ?? '');
      } catch { /* ignore malformed frame */ }
    };
    ws.onerror = () => this.finishSttFinal(this.interimTranscript);
    ws.onclose = () => {
      this.pendingSttFrames = [];
      this.finishSttFinal(this.interimTranscript);
    };

    const source = ctx.createMediaStreamSource(this.stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0; // route to destination so onaudioprocess fires, but stay silent (no echo)
    const ratio = ctx.sampleRate / STREAM_RATE;
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const out = downsamplePcm16(input, ratio);
      if (ws.readyState === WebSocket.OPEN) ws.send(out);
      else if (ws.readyState === WebSocket.CONNECTING && this.pendingSttFrames.length < MAX_PENDING_STT_FRAMES) {
        this.pendingSttFrames.push(out);
      }
    };
    source.connect(processor);
    processor.connect(sink);
    sink.connect(ctx.destination);
    this.sttSource = source;
    this.sttProcessor = processor;
    this.sttSink = sink;
    return true;
  }

  /** End streaming capture: flush, await the final transcript (with a timeout), tear down. */
  private async endStreamCapture(): Promise<string | null> {
    if (!this.streaming) return null;
    const ws = this.sttWs;
    const finalText = await new Promise<string>((resolve) => {
      this.sttFinal = resolve;
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send('flush');
        else this.finishSttFinal(this.interimTranscript);
      } catch {
        this.finishSttFinal(this.interimTranscript);
      }
      setTimeout(() => this.finishSttFinal(this.interimTranscript), STREAM_FINAL_TIMEOUT_MS);
    });
    // Single-STT: the WS streaming decode is authoritative. The old second STT pass
    // (finalizeVoicePcm -> /stt/raw) contended for the sidecar's single STT slot and
    // returned 429 -> core 503. endVadCapture normalizes + resolves the WS final via
    // finalizeTranscript. (setara-02o4)
    this.teardownStream();
    return finalText.trim() || null;
  }

  private finishSttFinal(text: string | null): void {
    if (!this.sttFinal) return;
    const finish = this.sttFinal;
    this.sttFinal = null;
    finish(text ?? '');
  }

  private teardownStream(): void {
    this.streaming = false;
    this.sttFinal = null;
    this.interimTranscript = '';
    this.pendingSttFrames = [];
    try { if (this.sttProcessor) this.sttProcessor.onaudioprocess = null; } catch { /* ignore */ }
    try { this.sttSource?.disconnect(); } catch { /* ignore */ }
    try { this.sttProcessor?.disconnect(); } catch { /* ignore */ }
    try { this.sttSink?.disconnect(); } catch { /* ignore */ }
    try { this.sttWs?.close(); } catch { /* ignore */ }
    this.sttSource = null;
    this.sttProcessor = null;
    this.sttSink = null;
    this.sttWs = null;
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
    this.releaseStream(true);
    this.recorder = null;
    this.error = message;
    this.status = 'error';
    this.turnState = 'error';
    this.playCue('sorry');
    asaWarn('voice', 'sidecar voice fail:', message);
  }
}

export const sidecarVoice = new SidecarVoice();

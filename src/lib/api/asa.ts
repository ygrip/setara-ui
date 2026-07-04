import { apiFetch, authHeaders } from './client';
import { getApiBaseUrl } from './config';
import { getValidSession } from '$lib/auth';

const previewMode = import.meta.env.VITE_MOCK === 'true';

export interface AsaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** True only for the in-flight assistant message; completed/history messages render as markdown. */
  streaming?: boolean;
  actions?: AsaAction[];
  /** Selectable choices when ASA asks the user to disambiguate. Clicking one sends its value. */
  options?: AsaMessageOption[];
}

export interface AsaMessageOption {
  label: string;
  value: string;
}

export interface AsaAction {
  type: string;  // versioned: e.g., 'navigate:v1', 'show_toast:v1'
  version?: string;  // optional separate version field for forward compat
  payload: Record<string, unknown>;
}

export interface AsaConfirmationSubmission {
  token: string;
  decision: 'APPROVE' | 'REJECT';
}

export interface AsaCapabilitiesRequest {
  supportedActions: string[];
}

export interface AsaCapabilitiesResponse {
  serverCapabilities: string[];
}

export interface AsaSession {
  sessionId: string;
  tokensUsed: number;
  tokensReserved: number;
  tokenBudget: number;
  tokensRemaining: number;
  resetAt: string;
}

export interface AsaMessagePage {
  items: AsaMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Versioned event envelope from the backend. */
export interface AsaEvent {
  protocolVersion: string;
  eventId: string;
  eventType: 'thinking' | 'token' | 'speech' | 'action' | 'clarification' | 'timing'
    | 'user_input_revision' | 'error' | 'done';
  payload: Record<string, unknown>;
}

export interface AsaConfig {
  voiceEnabled: boolean;
  /** True only when the voice sidecar is enabled AND its /health probe passes. Gates all voice UI. */
  voiceSidecar: boolean;
}

export async function fetchAsaConfig(): Promise<AsaConfig | null> {
  if (previewMode) return { voiceEnabled: true, voiceSidecar: false };
  try {
    const res = await apiFetch('/api/asa/config');
    if (res.status !== 200) return null;
    const data = await res.json();
    return { voiceEnabled: data.voiceEnabled === true, voiceSidecar: data.voiceSidecar === true };
  } catch {
    return null;
  }
}

export interface AsaVoiceOption {
  id: string;
  label: string;
  model: string;
  language: string;
}

/**
 * Decode any browser audio blob (WebM/OGG/MP4) → 16 kHz mono WAV via the Web Audio API.
 * AudioContext.decodeAudioData handles every format the browser's MediaRecorder can produce,
 * giving the sidecar a format it can always parse without Opus codec dependencies.
 */
async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext({ sampleRate: 16_000 });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0); // mono: first channel
    const dataLen = samples.length * 2;
    const buf = new ArrayBuffer(44 + dataLen);
    const v = new DataView(buf);
    const s = (off: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
    s(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); s(8, 'WAVE');
    s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, 16_000, true); v.setUint32(28, 32_000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    s(36, 'data'); v.setUint32(40, dataLen, true);
    for (let i = 0; i < samples.length; i++)
      v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, samples[i] * 32768)), true);
    return new Blob([buf], { type: 'audio/wav' });
  } finally {
    await ctx.close();
  }
}

/** Sidecar STT: upload a recorded audio blob, get a transcript back. */
export async function transcribeAudio(blob: Blob): Promise<{ text: string } | null> {
  try {
    const wav = await toWav16k(blob);
    const res = await apiFetch('/api/asa/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { text: String(data.text ?? '') };
  } catch {
    return null;
  }
}

/** Fetch a pre-generated spoken cue clip ("ok"/"processing"/…) in a voice. Null if unavailable. */
export async function fetchVoiceCue(voiceId: string, cue: string): Promise<ArrayBuffer | null> {
  try {
    const res = await apiFetch(`/api/asa/voice/cues/${encodeURIComponent(voiceId)}/${encodeURIComponent(cue)}`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** Sidecar TTS: synthesize speech for a short text. Returns a playable audio Blob, or null. */
export async function synthesizeSpeech(text: string, voiceId?: string): Promise<Blob | null> {
  try {
    const res = await apiFetch('/api/asa/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...(voiceId ? { voiceId } : {}) }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Sidecar streaming TTS: returns the raw fetch Response so the caller can read the PCM16 body as it
 * arrives (audio/L16, mono, rate on the X-Sample-Rate header) and start playback on the first chunk.
 * Returns null when the sidecar is unavailable (caller falls back to batch synthesizeSpeech).
 */
export async function synthesizeSpeechStream(text: string, voiceId?: string): Promise<Response | null> {
  try {
    const res = await apiFetch('/api/asa/voice/synthesize/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...(voiceId ? { voiceId } : {}) }),
    });
    if (!res.ok || !res.body) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * Open the rolling-window streaming STT WebSocket (core relays to the sidecar). The access token
 * rides on the query string because browsers can't set Authorization on a WS handshake. Returns
 * null if there's no session or the environment has no WebSocket. Caller sends binary PCM16 mono
 * @16kHz frames + a "flush" text message at end-of-utterance, and receives {type,text} JSON.
 */
export function openSttStream(voiceSessionId?: string): WebSocket | null {
  if (typeof WebSocket === 'undefined') return null;
  const session = getValidSession();
  if (!session?.accessToken) return null;
  const base = getApiBaseUrl().replace(/^http/, 'ws');
  const params = new URLSearchParams({ token: session.accessToken });
  if (voiceSessionId) params.set('voiceSessionId', voiceSessionId);
  const url = `${base}/ws/asa/voice/stt?${params}`;
  try {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    return ws;
  } catch {
    return null;
  }
}

/** Voice catalog from the sidecar for the settings picker. */
export async function fetchVoiceCatalog(): Promise<AsaVoiceOption[]> {
  try {
    const res = await apiFetch('/api/asa/voice/models');
    if (!res.ok) return [];
    const data = await res.json();
    const voices = data?.tts?.voices;
    return Array.isArray(voices) ? (voices as AsaVoiceOption[]) : [];
  } catch {
    return [];
  }
}

export async function getAsaSession(): Promise<AsaSession | null> {
  if (previewMode) {
    return {
      sessionId: 'preview-asa-session',
      tokensUsed: 1240,
      tokensReserved: 0,
      tokenBudget: 10_000,
      tokensRemaining: 8760,
      resetAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };
  }
  try {
    const res = await apiFetch('/api/asa/session');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      sessionId: data.sessionId,
      tokensUsed: data.tokensUsed ?? 0,
      tokensReserved: data.tokensReserved ?? 0,
      tokenBudget: data.tokenBudget,
      tokensRemaining: data.tokensRemaining ?? data.tokenBudget,
      resetAt: data.resetAt,
    };
  } catch {
    return null;
  }
}

export async function getAsaMessages(before?: string, limit = 30): Promise<AsaMessagePage> {
  if (previewMode) return { items: [], nextCursor: null, hasMore: false };
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  const res = await apiFetch(`/api/asa/session/messages?${params}`);
  if (!res.ok) {
    throw new Error(`Unable to load ASA history: ${res.status}`);
  }
  const data = await res.json();
  const items = (data.items ?? []) as Array<Omit<AsaMessage, 'timestamp'> & {
    createdAt: string;
    timestamp?: string;
  }>;
  return {
    items: items.map((message) => ({
      ...message,
      id: String(message.id),
      timestamp: String(message.timestamp ?? message.createdAt),
    })),
    nextCursor: data.nextCursor ?? null,
    hasMore: Boolean(data.hasMore),
  };
}

export async function cancelAsaRequest(requestId: string): Promise<void> {
  try {
    await apiFetch(`/api/asa/cancel/${requestId}`, { method: 'POST' });
  } catch { /* ignore */ }
}

export const CLIENT_SUPPORTED_ACTIONS: string[] = [
  'navigate:v1',
  'reload_page:v1',
  'open_modal:v1',
  'close_modal:v1',
  'show_toast:v1',
  'show_form:v1',
  'select_option:v1',
  'highlight:v1',
  'focus_element:v1',
  'confirm_required:v1',
];

export async function negotiateCapabilities(): Promise<AsaCapabilitiesResponse | null> {
  if (previewMode) return { serverCapabilities: [...CLIENT_SUPPORTED_ACTIONS] };
  try {
    const res = await apiFetch('/api/asa/capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supportedActions: CLIENT_SUPPORTED_ACTIONS }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface AsaEntityCatalog {
  projects: Array<{ id: string; key: string; name: string }>;
  plans: Array<{ id: string; name: string; releaseDate: string | null; squadId: string }>;
  builds: Array<{ id: string; version: string | null; projectId: string; buildKey: string }>;
  squads: Array<{ id: string; name: string }>;
  generatedAt: string;
}

export interface AsaVoiceEntity {
  type: string;
  id: string;
  display: string;
  originalSpan: string;
  score: number;
  resolution: string;
}

export interface AsaVoiceInput {
  source: 'moonshine' | 'sidecar';
  rawText: string;
  normalizedText: string;
  resolvedText: string;
  entities: AsaVoiceEntity[];
}

export interface AsaPreparedVoiceSession {
  voiceSessionId: string;
  stt: {
    streamUrl: string;
    finalUrl: string;
    sampleRate: number;
    channels: number;
    sampleFormat: string;
    language: string;
    hotwords: string[];
    prompt: string;
  };
}

export interface AsaResolvedVoiceTranscript {
  rawText: string;
  normalizedText: string;
  resolvedText: string;
  confidence: number;
  entities: AsaVoiceEntity[];
  ambiguities: unknown[];
  needsClarification: boolean;
}

export async function prepareVoiceSession(): Promise<AsaPreparedVoiceSession | null> {
  try {
    const route = typeof window === 'undefined' ? '/' : window.location.pathname;
    const res = await apiFetch('/api/asa/voice/session/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        mode: 'VOICE_COMMAND',
        context: { session: {}, navigation: { route }, page: {}, formatted: `route=${route}` },
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function finalizeVoicePcm(
  session: AsaPreparedVoiceSession,
  pcm: ArrayBuffer,
): Promise<AsaResolvedVoiceTranscript | null> {
  try {
    const res = await apiFetch(session.stt.finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/l16',
        'X-Sample-Rate': String(session.stt.sampleRate),
        'X-Channels': String(session.stt.channels),
        'X-Sample-Format': session.stt.sampleFormat,
      },
      body: pcm,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchEntityCatalog(): Promise<AsaEntityCatalog | null> {
  if (previewMode) {
    return { projects: [], plans: [], builds: [], squads: [], generatedAt: new Date().toISOString() };
  }
  try {
    const res = await apiFetch('/api/asa/entity-catalog');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Opens an SSE stream for an ASA message. Yields raw JSON strings (AsaEvent). */
export function streamAsaMessage(opts: {
  requestId: string;
  message: string;
  context: Record<string, unknown>;
  voiceInput?: AsaVoiceInput;
  confirmation?: AsaConfirmationSubmission;
  signal: AbortSignal;
}): ReadableStreamDefaultReader<string> {
  const body = JSON.stringify({
    requestId: opts.requestId,
    message: opts.message,
    context: opts.context,
    ...(opts.voiceInput ? { voiceInput: opts.voiceInput } : {}),
    ...(opts.confirmation ? {
      confirmationToken: opts.confirmation.token,
      confirmationDecision: opts.confirmation.decision,
    } : {}),
  });

  const url = `${getApiBaseUrl()}/api/asa/chat`;

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body,
          signal: opts.signal,
          credentials: 'include',
        });

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          controller.error(new Error(`ASA HTTP ${res.status}: ${errorBody.slice(0, 500)}`));
          return;
        }

        if (!res.body) {
          controller.error(new Error('ASA response has no body'));
          return;
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
          const preview = await res.text().catch(() => '');
          controller.error(
            new Error(
              `Expected text/event-stream but got ${contentType}. URL=${url}. Preview=${preview.slice(0, 500)}`,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        const emitFrame = (frame: string) => {
          const dataLines: string[] = [];
          for (const rawLine of frame.split('\n')) {
            const line = rawLine.trimEnd();
            if (!line || line.startsWith(':')) continue;
            if (line.startsWith('data:')) {
              // SSE allows "data:value" and "data: value" (one optional leading space)
              dataLines.push(line.slice(5).replace(/^ /, ''));
            }
          }
          const payload = dataLines.join('\n').trim();
          if (payload) controller.enqueue(payload);
        };

        const processBuffer = () => {
          buf = buf.replace(/\r\n/g, '\n');
          let index: number;
          while ((index = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, index);
            buf = buf.slice(index + 2);
            emitFrame(frame);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          processBuffer();
        }

        buf += decoder.decode();
        if (buf.trim()) emitFrame(buf);
        controller.close();
      } catch (err) {
        if ((err as Error).name === 'AbortError') controller.close();
        else controller.error(err);
      }
    },
  });

  return stream.getReader();
}

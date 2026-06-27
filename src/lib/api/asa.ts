import { apiFetch, authHeaders } from './client';
import { getApiBaseUrl } from './config';

export interface AsaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: AsaAction[];
}

export interface AsaAction {
  type: string;  // versioned: e.g., 'navigate:v1', 'show_toast:v1'
  version?: string;  // optional separate version field for forward compat
  payload: Record<string, unknown>;
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
  eventType: 'thinking' | 'token' | 'action' | 'error' | 'done';
  payload: Record<string, unknown>;
}

export interface AsaConfig {
  voiceEnabled: boolean;
}

export async function fetchAsaConfig(): Promise<AsaConfig | null> {
  try {
    const res = await apiFetch('/api/asa/config');
    if (res.status !== 200) return null;
    const data = await res.json();
    return { voiceEnabled: data.voiceEnabled === true };
  } catch {
    return null;
  }
}

export async function getAsaSession(): Promise<AsaSession | null> {
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
  'open_modal:v1',
  'close_modal:v1',
  'show_toast:v1',
  'show_form:v1',
  'select_option:v1',
  'highlight:v1',
  'focus_element:v1',
];

export async function negotiateCapabilities(): Promise<AsaCapabilitiesResponse | null> {
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
  resolution: 'auto' | 'confirmed';
}

export interface AsaVoiceInput {
  source: 'moonshine';
  rawText: string;
  normalizedText: string;
  resolvedText: string;
  entities: AsaVoiceEntity[];
}

export async function fetchEntityCatalog(): Promise<AsaEntityCatalog | null> {
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
  signal: AbortSignal;
}): ReadableStreamDefaultReader<string> {
  const body = JSON.stringify({
    requestId: opts.requestId,
    message: opts.message,
    context: opts.context,
    ...(opts.voiceInput ? { voiceInput: opts.voiceInput } : {}),
  });

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/asa/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body,
          signal: opts.signal,
        });
        if (!res.ok || !res.body) {
          controller.error(new Error(`ASA error: ${res.status}`));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) controller.enqueue(line.slice(6).trim());
          }
        }
        controller.close();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') controller.error(err);
        else controller.close();
      }
    },
  });

  return stream.getReader();
}

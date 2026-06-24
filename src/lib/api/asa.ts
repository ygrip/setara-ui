import { apiFetch, authHeaders } from './client';
import { getApiBaseUrl } from './config';

export interface AsaMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: AsaAction[];
}

export interface AsaAction {
  type: 'navigate' | 'highlight' | 'open_modal' | 'refresh';
  payload: Record<string, unknown>;
}

export interface AsaSession {
  sessionId: string;
  conversationId: string;
  tokensUsed: number;
  tokenBudget: number;
  resetAt: string;
}

/** Versioned event envelope from the backend. */
export interface AsaEvent {
  protocolVersion: string;
  eventId: string;
  eventType: 'thinking' | 'token' | 'action' | 'error' | 'done';
  payload: Record<string, unknown>;
}

export async function checkAsaAvailable(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/asa/config');
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function getAsaSession(): Promise<AsaSession | null> {
  try {
    const res = await apiFetch('/api/asa/session');
    if (!res.ok) return null;
    const data = await res.json();
    // Backend returns {tokenBudget, tokensUsed, resetAt}
    return { sessionId: '', conversationId: '', tokensUsed: data.tokensUsed ?? 0, tokenBudget: data.tokenBudget, resetAt: data.resetAt };
  } catch {
    return null;
  }
}

export async function cancelAsaRequest(requestId: string): Promise<void> {
  try {
    await apiFetch(`/api/asa/cancel/${requestId}`, { method: 'POST' });
  } catch { /* ignore */ }
}

/** Opens an SSE stream for an ASA message. Yields raw JSON strings (AsaEvent). */
export function streamAsaMessage(opts: {
  requestId: string;
  message: string;
  conversationId?: string;
  context: Record<string, unknown>;
  signal: AbortSignal;
}): ReadableStreamDefaultReader<string> {
  const body = JSON.stringify({
    requestId: opts.requestId,
    message: opts.message,
    conversationId: opts.conversationId,
    context: opts.context,
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

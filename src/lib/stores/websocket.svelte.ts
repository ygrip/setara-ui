import { executionSocketUrl, type ExecutionEvent } from '$lib/api/realtime';
import { MockWebSocket, isStaticMockMode } from '$lib/mock/websocket';

export type SocketState = 'idle' | 'connecting' | 'live' | 'offline';

/**
 * Centralized WebSocket manager.
 *
 * - Manages a single active connection at a time.
 * - Automatically reconnects with exponential back-off (up to maxReconnects attempts).
 * - Supports multiple handler registrations via addHandler(); each returns an unsubscribe fn.
 * - Calling connect() with the same URL while live is a no-op.
 * - Calling connect() with a different URL disconnects the previous connection first.
 *
 * Usage (inside a .svelte component):
 *
 *   import { wsManager } from '$lib/stores/websocket.svelte';
 *   onMount(() => {
 *     wsManager.connect(projectKey);
 *     const unsub = wsManager.addHandler(event => applyEvent(event));
 *     return () => { unsub(); wsManager.disconnect(); };
 *   });
 *   // Read wsManager.state reactively in templates.
 */
class WebSocketManager {
  state = $state<SocketState>('idle');

  private ws: WebSocket | null = null;
  private currentUrl = '';
  private handlers = new Set<(event: ExecutionEvent) => void>();
  private reconnectAttempts = 0;
  private readonly maxReconnects = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Open (or reuse) a connection for the given project/run scope.
   * Calling with the same URL while live/connecting is a no-op.
   */
  connect(projectKey: string, runId?: string): void {
    const url = executionSocketUrl(projectKey, runId);
    if (url === this.currentUrl && (this.state === 'live' || this.state === 'connecting')) return;
    this.teardown();
    this.currentUrl = url;
    this.reconnectAttempts = 0;
    this.open();
  }

  /**
   * Close the active connection and cancel any pending reconnect.
   * Does NOT remove registered handlers — call the returned unsubscribe fn for that.
   */
  disconnect(): void {
    this.teardown();
    this.currentUrl = '';
    this.state = 'idle';
  }

  /**
   * Register a handler for incoming ExecutionEvents.
   * Returns an unsubscribe function — call it in onDestroy to avoid leaks.
   */
  addHandler(fn: (event: ExecutionEvent) => void): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  private open(): void {
    this.state = 'connecting';
    const ws = isStaticMockMode()
      ? (new MockWebSocket(this.currentUrl) as unknown as WebSocket)
      : new WebSocket(this.currentUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.state = 'live';
      this.reconnectAttempts = 0;
    };

    ws.onclose = () => {
      this.state = 'offline';
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires right after onerror; let onclose handle state + reconnect.
      this.state = 'offline';
    };

    ws.onmessage = (msg: MessageEvent) => {
      try {
        const event = JSON.parse(msg.data as string) as ExecutionEvent;
        this.handlers.forEach(h => h(event));
      } catch {
        // Ignore malformed frames; persisted data remains authoritative.
      }
    };
  }

  private scheduleReconnect(): void {
    if (!this.currentUrl || this.reconnectAttempts >= this.maxReconnects) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private teardown(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Suppress the onclose handler so we don't trigger an unwanted reconnect.
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

/** Singleton — import and use directly in components. */
export const wsManager = new WebSocketManager();

import { page } from '$app/state';
import type { AsaMessage, AsaSession, AsaStreamChunk } from '$lib/api/asa';
import { checkAsaAvailable, getAsaSession, streamAsaMessage } from '$lib/api/asa';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AsaOrbState = 'hidden' | 'idle' | 'opening' | 'open' | 'thinking';

type ContextContributor = () => Record<string, unknown>;

// ── Context registry ──────────────────────────────────────────────────────────

const contributors = new Map<string, ContextContributor>();

/** Register a context contributor for a page/section. Returns unregister fn. */
export function registerASAContext(key: string, fn: ContextContributor): () => void {
  contributors.set(key, fn);
  return () => contributors.delete(key);
}

/** Snapshot all current contributors (call at message-send time, not reactively). */
function snapshotContext(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, fn] of contributors) {
    try { out[k] = fn(); } catch { /* skip broken contributor */ }
  }
  return out;
}

// ── Store ─────────────────────────────────────────────────────────────────────

class AsaStore {
  // Availability
  available = $state(false);
  checked = $state(false);

  // Orb visual state
  orbState = $state<AsaOrbState>('hidden');

  // Chat
  open = $state(false);
  messages = $state<AsaMessage[]>([]);
  streaming = $state(false);
  streamBuffer = $state('');
  error = $state<string | null>(null);

  // Session / budget
  session = $state<AsaSession | null>(null);
  conversationId = $state<string | undefined>(undefined);

  private abortController: AbortController | null = null;
  private prevPath = '';

  async init() {
    if (this.checked) return;
    this.checked = true;
    this.available = await checkAsaAvailable();
    if (this.available) {
      this.orbState = 'idle';
      this.session = await getAsaSession();
    }
  }

  /** Called by layout on navigation — clears page-level context contributors. */
  onNavigate(path: string) {
    if (path === this.prevPath) return;
    this.prevPath = path;
    // Remove all Layer 2 (page-scoped) contributors; session-level ones persist.
    for (const key of contributors.keys()) {
      if (key.startsWith('page:')) contributors.delete(key);
    }
  }

  toggle() {
    if (!this.available) return;
    if (this.open) {
      this.close();
    } else {
      this.activate();
    }
  }

  activate() {
    if (!this.available || this.open) return;
    this.orbState = 'opening';
    this.open = true;
    // After born animation (~1.5s), settle to open
    setTimeout(() => {
      if (this.open) this.orbState = 'open';
    }, 1500);
  }

  close() {
    this.open = false;
    this.orbState = this.available ? 'idle' : 'hidden';
    this.cancel();
  }

  async send(text: string) {
    if (!text.trim() || this.streaming) return;
    this.error = null;

    const userMsg: AsaMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    this.messages = [...this.messages, userMsg];
    this.streaming = true;
    this.streamBuffer = '';
    this.orbState = 'thinking';

    this.abortController = new AbortController();

    // Build assistant placeholder
    const assistantMsg: AsaMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    this.messages = [...this.messages, assistantMsg];
    const assistantIdx = this.messages.length - 1;

    try {
      const context = {
        navigation: { path: typeof window !== 'undefined' ? window.location.pathname : '' },
        ...snapshotContext(),
      };

      const reader = streamAsaMessage({
        message: text,
        conversationId: this.conversationId,
        context,
        signal: this.abortController.signal,
      });

      let fullContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        try {
          const chunk: AsaStreamChunk = JSON.parse(value);
          if (chunk.type === 'token' && chunk.content) {
            fullContent += chunk.content;
            this.streamBuffer = fullContent;
            // Update the last assistant message in-place
            const updated = [...this.messages];
            updated[assistantIdx] = { ...updated[assistantIdx], content: fullContent };
            this.messages = updated;
          } else if (chunk.type === 'actions' && chunk.actions) {
            const updated = [...this.messages];
            updated[assistantIdx] = { ...updated[assistantIdx], actions: chunk.actions };
            this.messages = updated;
            this.executeActions(chunk.actions);
          } else if (chunk.type === 'done') {
            if (chunk.session) {
              this.session = { ...this.session!, ...chunk.session };
            }
          } else if (chunk.type === 'error') {
            this.error = chunk.error ?? 'ASA error';
          }
        } catch { /* malformed chunk */ }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error = 'Connection error. Try again.';
      }
    } finally {
      this.streaming = false;
      this.streamBuffer = '';
      if (this.open) this.orbState = 'open';
    }
  }

  cancel() {
    this.abortController?.abort();
    this.abortController = null;
    if (this.streaming) {
      this.streaming = false;
      this.streamBuffer = '';
      if (this.open) this.orbState = 'open';
    }
  }

  clearConversation() {
    this.messages = [];
    this.conversationId = undefined;
    this.error = null;
  }

  private executeActions(actions: AsaMessage['actions']) {
    if (!actions?.length) return;
    for (const action of actions) {
      if (action.type === 'navigate' && action.payload.path) {
        import('$app/navigation').then(({ goto }) => goto(action.payload.path as string));
      }
      // Other action types handled by setara-f15v
    }
  }
}

export const asa = new AsaStore();

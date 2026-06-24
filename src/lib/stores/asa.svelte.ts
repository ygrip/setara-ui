import type { AsaAction, AsaEvent, AsaMessage, AsaSession } from '$lib/api/asa';
import { cancelAsaRequest, checkAsaAvailable, getAsaSession, streamAsaMessage } from '$lib/api/asa';

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

function snapshotContext(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, fn] of contributors) {
    try { out[k] = fn(); } catch { /* skip broken contributor */ }
  }
  return out;
}

// ── Store ─────────────────────────────────────────────────────────────────────

class AsaStore {
  available  = $state(false);
  checked    = $state(false);
  orbState   = $state<AsaOrbState>('hidden');
  open       = $state(false);
  messages   = $state<AsaMessage[]>([]);
  streaming  = $state(false);
  error      = $state<string | null>(null);
  session    = $state<AsaSession | null>(null);
  conversationId = $state<string | undefined>(undefined);

  private abortController: AbortController | null = null;
  private currentRequestId: string | null = null;
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

  onNavigate(path: string) {
    if (path === this.prevPath) return;
    this.prevPath = path;
    for (const key of contributors.keys()) {
      if (key.startsWith('page:')) contributors.delete(key);
    }
  }

  toggle() {
    if (!this.available) return;
    this.open ? this.close() : this.activate();
  }

  activate() {
    if (!this.available || this.open) return;
    this.orbState = 'opening';
    this.open = true;
    setTimeout(() => { if (this.open) this.orbState = 'open'; }, 1500);
  }

  close() {
    this.open = false;
    this.orbState = this.available ? 'idle' : 'hidden';
    this.cancel();
  }

  async send(text: string) {
    if (!text.trim() || this.streaming) return;
    this.error = null;

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;

    this.messages = [...this.messages, { role: 'user', content: text, timestamp: new Date().toISOString() }];
    const assistantMsg: AsaMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    this.messages = [...this.messages, assistantMsg];
    const assistantIdx = this.messages.length - 1;

    this.streaming = true;
    this.orbState = 'thinking';
    this.abortController = new AbortController();

    try {
      const context = {
        navigation: { path: typeof window !== 'undefined' ? window.location.pathname : '' },
        ...snapshotContext(),
      };

      const reader = streamAsaMessage({
        requestId,
        message: text,
        conversationId: this.conversationId,
        context,
        signal: this.abortController.signal,
      });

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        let event: AsaEvent;
        try { event = JSON.parse(value); } catch { continue; }

        switch (event.eventType) {
          case 'token': {
            const token = event.payload.content as string ?? '';
            fullContent += token;
            const updated = [...this.messages];
            updated[assistantIdx] = { ...updated[assistantIdx], content: fullContent };
            this.messages = updated;
            break;
          }
          case 'action': {
            const actions = event.payload.actions as AsaAction[] ?? [];
            const updated = [...this.messages];
            updated[assistantIdx] = { ...updated[assistantIdx], actions };
            this.messages = updated;
            this.executeActions(actions);
            break;
          }
          case 'done': {
            const p = event.payload;
            if (this.session) {
              this.session = {
                ...this.session,
                tokensUsed: (p.tokensUsed as number) ?? this.session.tokensUsed,
                tokenBudget: (p.tokenBudget as number) ?? this.session.tokenBudget,
                resetAt: (p.resetAt as string) ?? this.session.resetAt,
              };
            }
            break;
          }
          case 'error':
            this.error = (event.payload.message as string) ?? 'ASA error';
            break;
          // 'thinking' events — ignored in UI for now (no visible indicator beyond orb state)
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error = 'Connection error. Try again.';
      }
    } finally {
      this.streaming = false;
      this.currentRequestId = null;
      if (this.open) this.orbState = 'open';
    }
  }

  cancel() {
    // Signal server-side cancel
    if (this.currentRequestId) {
      cancelAsaRequest(this.currentRequestId).catch(() => {});
      this.currentRequestId = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    if (this.streaming) {
      this.streaming = false;
      if (this.open) this.orbState = 'open';
    }
  }

  clearConversation() {
    this.messages = [];
    this.conversationId = undefined;
    this.error = null;
  }

  private executeActions(actions: AsaAction[]) {
    for (const action of actions) {
      if (action.type === 'navigate' && action.payload.path) {
        import('$app/navigation').then(({ goto }) => goto(action.payload.path as string));
      }
    }
  }
}

export const asa = new AsaStore();

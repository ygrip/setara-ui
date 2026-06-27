import type { AsaAction, AsaEvent, AsaMessage, AsaSession, AsaVoiceInput } from '$lib/api/asa';
import {
  cancelAsaRequest,
  fetchAsaConfig,
  getAsaMessages,
  getAsaSession,
  negotiateCapabilities,
  streamAsaMessage,
} from '$lib/api/asa';

export type AsaOrbState = 'hidden' | 'idle' | 'opening' | 'open' | 'thinking';

type ContextContributor = () => Record<string, unknown>;

const contributors = new Map<string, ContextContributor>();

export function registerASAContext(key: string, fn: ContextContributor): () => void {
  contributors.set(key, fn);
  return () => contributors.delete(key);
}

function snapshotContext(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, contributor] of contributors) {
    try {
      out[key] = contributor();
    } catch {
      // A broken page contributor must not prevent the user from opening ASA.
    }
  }
  return out;
}

class AsaStore {
  available = $state(false);
  voiceEnabled = $state(false);
  checked = $state(false);
  orbState = $state<AsaOrbState>('hidden');
  open = $state(false);
  messages = $state<AsaMessage[]>([]);
  streaming = $state(false);
  thinkingText = $state<string | null>(null);
  error = $state<string | null>(null);
  session = $state<AsaSession | null>(null);
  historyLoading = $state(false);
  historyLoaded = $state(false);
  historyHasMore = $state(false);
  scrollRevision = $state(0);

  private historyCursor: string | null = null;
  private abortController: AbortController | null = null;
  private currentRequestId: string | null = null;
  private prevPath = '';
  private actionRegistry = new Map<string, (payload: Record<string, unknown>) => void>();
  private serverCapabilities: string[] = [];
  private unknownActionEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];

  async init() {
    if (this.checked) return;
    this.checked = true;
    const config = await fetchAsaConfig();
    this.available = config !== null;
    this.voiceEnabled = config?.voiceEnabled ?? false;
    if (this.available) {
      this.orbState = 'idle';
      this.session = await getAsaSession();
      this.initActionRegistry();
      const caps = await negotiateCapabilities();
      if (caps) {
        this.serverCapabilities = caps.serverCapabilities;
      }
    }
  }

  get unknownActions(): ReadonlyArray<{ type: string; payload: Record<string, unknown> }> {
    return this.unknownActionEvents;
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
    void this.ensureHistoryLoaded();
    setTimeout(() => {
      if (this.open && !this.streaming) this.orbState = 'open';
    }, 1500);
  }

  close() {
    this.open = false;
    this.orbState = this.available ? 'idle' : 'hidden';
    this.cancel();
  }

  async ensureHistoryLoaded() {
    if (this.historyLoaded || this.historyLoading) return;
    this.historyLoading = true;
    this.error = null;
    try {
      const page = await getAsaMessages();
      this.messages = this.mergeMessages([], page.items);
      this.historyCursor = page.nextCursor;
      this.historyHasMore = page.hasMore;
      this.historyLoaded = true;
      this.scrollRevision += 1;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to load ASA history';
    } finally {
      this.historyLoading = false;
    }
  }

  async loadOlderMessages(): Promise<boolean> {
    if (!this.historyLoaded || !this.historyHasMore || this.historyLoading || this.streaming) {
      return false;
    }
    this.historyLoading = true;
    try {
      const page = await getAsaMessages(this.historyCursor ?? undefined);
      this.messages = this.mergeMessages(page.items, this.messages);
      this.historyCursor = page.nextCursor;
      this.historyHasMore = page.hasMore;
      return page.items.length > 0;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to load older ASA messages';
      return false;
    } finally {
      this.historyLoading = false;
    }
  }

  async send(text: string, voiceInput?: AsaVoiceInput) {
    if (!text.trim() || this.streaming) return;
    this.error = null;
    this.thinkingText = 'Preparing your request';

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;
    const timestamp = new Date().toISOString();
    this.messages = [
      ...this.messages,
      { id: `${requestId}:user`, role: 'user', content: text, timestamp },
      { id: `${requestId}:assistant`, role: 'assistant', content: '', timestamp },
    ];
    this.scrollRevision += 1;

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
        context,
        voiceInput,
        signal: this.abortController.signal,
      });
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        let event: AsaEvent;
        try {
          event = JSON.parse(value);
        } catch {
          continue;
        }

        switch (event.eventType) {
          case 'thinking':
            this.thinkingText = String(event.payload.content ?? 'Thinking');
            break;
          case 'token': {
            this.thinkingText = null;
            fullContent += String(event.payload.content ?? '');
            this.updateAssistant(requestId, { content: fullContent });
            this.scrollRevision += 1;
            break;
          }
          case 'action': {
            const actions = (event.payload.actions as AsaAction[] | undefined) ?? [];
            this.updateAssistant(requestId, { actions });
            this.executeActions(actions);
            break;
          }
          case 'done':
            this.updateSessionBudget(event.payload);
            break;
          case 'error':
            this.error = String(event.payload.message ?? 'ASA error');
            break;
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.error = 'Connection error. Try again.';
      }
    } finally {
      this.streaming = false;
      this.thinkingText = null;
      this.currentRequestId = null;
      this.abortController = null;
      if (this.open) this.orbState = 'open';
    }
  }

  cancel() {
    if (this.currentRequestId) {
      void cancelAsaRequest(this.currentRequestId);
      this.currentRequestId = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.thinkingText = null;
    if (this.streaming) {
      this.streaming = false;
      if (this.open) this.orbState = 'open';
    }
  }

  clearConversation() {
    this.messages = [];
    this.historyCursor = null;
    this.historyHasMore = false;
    this.historyLoaded = true;
    this.error = null;
    this.thinkingText = null;
  }

  private updateAssistant(requestId: string, patch: Partial<AsaMessage>) {
    const id = `${requestId}:assistant`;
    this.messages = this.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    );
  }

  private updateSessionBudget(payload: Record<string, unknown>) {
    if (!this.session) return;
    this.session = {
      ...this.session,
      tokensUsed: Number(payload.tokensUsed ?? this.session.tokensUsed),
      tokensReserved: Number(payload.tokensReserved ?? this.session.tokensReserved),
      tokenBudget: Number(payload.tokenBudget ?? this.session.tokenBudget),
      tokensRemaining: Number(payload.tokensRemaining ?? this.session.tokensRemaining),
      resetAt: String(payload.resetAt ?? this.session.resetAt),
    };
  }

  private mergeMessages(first: AsaMessage[], second: AsaMessage[]): AsaMessage[] {
    const seen = new Set<string>();
    return [...first, ...second].filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }

  private initActionRegistry() {
    this.actionRegistry.set('navigate:v1', (payload) => {
      const path = payload.path as string | undefined;
      if (path) {
        void import('$app/navigation').then(({ goto }) => goto(path));
      }
    });
    this.actionRegistry.set('show_toast:v1', (payload) => {
      const message = payload.message as string | undefined;
      if (message) {
        // Dispatch to a toast notification system; fallback: console.info
        console.info('[ASA toast]', message);
      }
    });
    this.actionRegistry.set('highlight:v1', (payload) => {
      const selector = payload.selector as string | undefined;
      if (selector && typeof document !== 'undefined') {
        const el = document.querySelector(selector);
        el?.classList.add('asa-highlight');
      }
    });
    this.actionRegistry.set('focus_element:v1', (payload) => {
      const selector = payload.selector as string | undefined;
      if (selector && typeof document !== 'undefined') {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) el.focus();
      }
    });
    // open_modal, close_modal, show_form, select_option: emit custom DOM events
    // so page components can handle them without coupling to the ASA store.
    for (const type of ['open_modal:v1', 'close_modal:v1', 'show_form:v1', 'select_option:v1']) {
      this.actionRegistry.set(type, (payload) => {
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('asa:action', { detail: { type, payload } }));
        }
      });
    }
  }

  private executeActions(actions: AsaAction[]) {
    for (const action of actions) {
      const key = action.type.includes(':') ? action.type : `${action.type}:v1`;
      const handler = this.actionRegistry.get(key);
      if (handler) {
        try {
          handler(action.payload);
        } catch (err) {
          console.warn('[ASA] Action handler error', key, err);
        }
      } else {
        console.warn('[ASA] Unsupported action type:', key);
        this.unknownActionEvents.push({ type: key, payload: action.payload });
      }
    }
  }
}

export const asa = new AsaStore();

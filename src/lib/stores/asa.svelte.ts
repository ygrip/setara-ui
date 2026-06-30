import type { AsaAction, AsaEvent, AsaMessage, AsaMessageOption, AsaSession, AsaVoiceInput } from '$lib/api/asa';
import {
  cancelAsaRequest,
  fetchAsaConfig,
  getAsaMessages,
  getAsaSession,
  negotiateCapabilities,
  streamAsaMessage,
} from '$lib/api/asa';
import { asaLog, asaWarn } from '$lib/asa-debug';
import { stripMarkdown } from '$lib/markdown';
import { sidecarVoice } from '$lib/voice/sidecar-voice.svelte';
import { reconcileCompletedContent, StreamBatcher } from './stream-batcher';

export type AsaOrbState = 'hidden' | 'idle' | 'opening' | 'open' | 'thinking';

type ContextContributor = () => Record<string, unknown>;

const contributors = new Map<string, ContextContributor>();
const TOKEN_FLUSH_INTERVAL_MS = 50;

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
  /** Sidecar voice (STT/TTS) reachable — gates mic + spoken replies. False → text-only. */
  voiceSidecar = $state(false);
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
  private flushActiveTokenBuffer: (() => void) | null = null;

  async init() {
    if (this.checked) return;
    this.checked = true;
    const config = await fetchAsaConfig();
    this.available = config !== null;
    this.voiceEnabled = config?.voiceEnabled ?? false;
    this.voiceSidecar = config?.voiceSidecar ?? false;
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
      this.messages = this.mergeMessages(page.items, this.messages);
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
    asaLog('chat', 'send', { text, voice: Boolean(voiceInput) });
    this.error = null;
    this.thinkingText = 'Preparing your request';

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;
    const timestamp = new Date().toISOString();
    this.messages = [
      ...this.messages,
      { id: `${requestId}:user`, role: 'user', content: text, timestamp },
      { id: `${requestId}:assistant`, role: 'assistant', content: '', timestamp, streaming: true },
    ];
    this.scrollRevision += 1;

    this.streaming = true;
    this.orbState = 'thinking';
    this.abortController = new AbortController();
    // Speak the reply sentence-by-sentence as it streams (sidecar voice only; no-op if TTS off).
    if (this.voiceSidecar) this.safeVoiceCall('beginSpeech', () => sidecarVoice.beginSpeech());
    else asaLog('chat', 'voice sidecar unavailable — reply is text-only');

    let ok = false;
    let gotError = false;
    let gotSpeech = false;
    let gotDone = false;
    let fullContent = '';
    const tokenBatcher = new StreamBatcher({
      delayMs: TOKEN_FLUSH_INTERVAL_MS,
      onFlush: (content) => {
        fullContent += content;
        this.updateAssistant(requestId, { content: fullContent });
        this.scrollRevision += 1;
      },
    });
    this.flushActiveTokenBuffer = () => tokenBatcher.flush();
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        let event: AsaEvent;
        try {
          event = JSON.parse(value);
        } catch {
          asaWarn('chat', 'unparseable SSE line', value);
          continue;
        }
        if (event.eventType !== 'token') asaLog('chat', 'event', event.eventType, event.payload);

        switch (event.eventType) {
          case 'thinking':
            this.thinkingText = String(event.payload.content ?? 'Thinking');
            break;
          case 'token': {
            this.thinkingText = null;
            tokenBatcher.push(String(event.payload.content ?? ''));
            break;
          }
          case 'speech': {
            // Dedicated spoken text (separate from the displayed markdown) — speak only this.
            this.thinkingText = null;
            const speechText = String(event.payload.text ?? '');
            if (this.voiceSidecar && speechText.trim()) {
              gotSpeech = this.safeVoiceCall('speakText', () => sidecarVoice.speakText(speechText));
            }
            break;
          }
          case 'clarification': {
            // ASA is unsure and is asking the user to pick. Render question + option buttons.
            tokenBatcher.flush();
            this.thinkingText = null;
            const question = String(event.payload.question ?? event.payload.content ?? '');
            const options = this.parseOptions(event.payload.options);
            if (question) fullContent = question;
            this.updateAssistant(requestId, { content: fullContent, options });
            this.scrollRevision += 1;
            break;
          }
          case 'action': {
            tokenBatcher.flush();
            const actions = (event.payload.actions as AsaAction[] | undefined) ?? [];
            this.updateAssistant(requestId, { actions });
            this.executeActions(actions);
            break;
          }
          case 'timing':
            asaLog('chat:timing', event.payload);
            break;
          case 'done':
            tokenBatcher.flush();
            gotDone = true;
            fullContent = reconcileCompletedContent(
              fullContent,
              String(event.payload.content ?? ''),
            );
            this.updateAssistant(requestId, { content: fullContent });
            this.scrollRevision += 1;
            this.updateSessionBudget(event.payload);
            break;
          case 'error':
            tokenBatcher.flush();
            gotError = true;
            // Clear markup-only partial content (e.g. bare `**`) that would show alongside the error
            if (stripMarkdown(fullContent).trim().length === 0 && fullContent) {
              fullContent = '';
              this.updateAssistant(requestId, { content: '' });
            }
            this.error = String(event.payload.message ?? 'ASA error');
            if (this.voiceSidecar) {
              this.safeVoiceCall('stopAudio', () => sidecarVoice.stopAudio());
              this.safeVoiceCall('playCue:sorry', () => sidecarVoice.playCue('sorry'));
            }
            asaWarn('chat', 'error event', this.error);
            break;
        }
      }
      tokenBatcher.flush();
      ok = true;
      asaLog('chat', 'stream done', { chars: fullContent.length });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        asaWarn('chat', 'stream failed', error);
        tokenBatcher.flush();
        if (gotDone || stripMarkdown(fullContent).trim().length > 0) {
          ok = true;
        } else {
          // Clear markdown-syntax-only partial content (e.g. bare `**`) so broken markup doesn't render
          if (fullContent) {
            fullContent = '';
            this.updateAssistant(requestId, { content: '' });
          }
          this.error = 'Connection error. Try again.';
          if (this.voiceSidecar) {
            this.safeVoiceCall('stopAudio', () => sidecarVoice.stopAudio());
          }
        }
      }
    } finally {
      tokenBatcher.flush();
      tokenBatcher.dispose();
      this.updateAssistant(requestId, { streaming: false });
      if (this.flushActiveTokenBuffer) this.flushActiveTokenBuffer = null;
      this.streaming = false;
      this.thinkingText = null;
      this.currentRequestId = null;
      this.abortController = null;
      if (this.voiceSidecar) {
        const aborted = !ok && !gotError && this.error == null; // user cancelled (AbortError)
        const errored = gotError || (!ok && this.error != null);
        const spoke = gotSpeech && sidecarVoice.ttsEnabled;
        this.safeVoiceCall('endTurn', () => sidecarVoice.endTurn({
          // static "done" only for a successful, content-bearing, NON-spoken turn (action/nav, or TTS off)
          playDone: ok && !errored && fullContent.trim().length > 0 && !spoke,
          rearm: sidecarVoice.handsFree && !aborted,
        }));
      }
      if (this.open) this.orbState = 'open';
    }
  }

  cancel() {
    this.flushActiveTokenBuffer?.();
    if (this.currentRequestId) {
      const requestId = this.currentRequestId;
      void cancelAsaRequest(requestId);
      this.updateAssistant(requestId, { streaming: false });
      this.currentRequestId = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.thinkingText = null;
    if (this.voiceSidecar) this.safeVoiceCall('stopAudio', () => sidecarVoice.stopAudio());
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

  private safeVoiceCall(label: string, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (error) {
      asaWarn('voice', `${label} failed`, error);
      return false;
    }
  }

  /** Normalize backend option payloads (strings or {label,value}) into AsaMessageOption[]. */
  private parseOptions(raw: unknown): AsaMessageOption[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const options = raw
      .map((item): AsaMessageOption | null => {
        if (typeof item === 'string') return { label: item, value: item };
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          const label = String(o.label ?? o.value ?? '');
          if (!label) return null;
          return { label, value: String(o.value ?? o.label ?? label) };
        }
        return null;
      })
      .filter((o): o is AsaMessageOption => o !== null);
    return options.length > 0 ? options : undefined;
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

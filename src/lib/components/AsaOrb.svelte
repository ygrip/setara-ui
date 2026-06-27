<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { asa } from '$lib/stores/asa.svelte';
  import { asaVoice } from '$lib/voice/asa-voice.svelte';
  import type { AsaAction } from '$lib/api/asa';

  // ── Constants ─────────────────────────────────────────────────────────────
  const ORB_SIZE   = 80;
  const PANEL_MIN_W = 300;
  const PANEL_MIN_H = 340;
  const PANEL_GAP   = 14;   // gap between orb edge and panel

  // ── Orb position (left/top viewport coords) ───────────────────────────────
  let orbX = $state(-1);  // -1 = not mounted yet
  let orbY = $state(-1);

  let orbDragging  = $state(false);
  let orbDragSX    = 0;
  let orbDragSY    = 0;
  let orbDragPx    = 0;

  // Ripple
  let rippling = $state(false);
  let rippleTimer: ReturnType<typeof setTimeout> | null = null;

  function startRipple() {
    rippling = false;
    if (rippleTimer) clearTimeout(rippleTimer);
    // Force re-trigger by toggling off then on next tick
    requestAnimationFrame(() => {
      rippling = true;
      rippleTimer = setTimeout(() => { rippling = false; }, 650);
    });
  }

  function onOrbPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    orbDragging = true;
    orbDragPx   = 0;
    orbDragSX   = e.clientX - orbX;
    orbDragSY   = e.clientY - orbY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRipple();
  }

  function onOrbPointerMove(e: PointerEvent) {
    if (!orbDragging) return;
    orbDragPx += Math.abs(e.movementX) + Math.abs(e.movementY);
    orbX = Math.max(0, Math.min(window.innerWidth  - ORB_SIZE, e.clientX - orbDragSX));
    orbY = Math.max(0, Math.min(window.innerHeight - ORB_SIZE, e.clientY - orbDragSY));
    snapPanelToOrb();
  }

  function onOrbPointerUp() {
    if (!orbDragging) return;
    orbDragging = false;
    if (orbDragPx < 6) asa.toggle();
  }

  // ── Panel position + size ─────────────────────────────────────────────────
  let panelW = $state(360);
  let panelH = $state(480);
  let panelX = $state(0);
  let panelY = $state(0);
  let panelMoving = $state(false);
  let panelMoveOffsetX = 0;
  let panelMoveOffsetY = 0;

  function snapPanelToOrb() {
    if (orbX < 0) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Horizontal: align panel right edge with orb right edge, clamp
    let px = orbX + ORB_SIZE - panelW;
    px = Math.max(8, Math.min(vw - panelW - 8, px));
    // Vertical: above orb if space, else below
    const spaceAbove = orbY - PANEL_GAP;
    let py = spaceAbove >= panelH
      ? orbY - panelH - PANEL_GAP
      : orbY + ORB_SIZE + PANEL_GAP;
    py = Math.max(8, Math.min(vh - panelH - 8, py));
    panelX = px;
    panelY = py;
  }

  function onPanelPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    panelMoving = true;
    panelMoveOffsetX = e.clientX - panelX;
    panelMoveOffsetY = e.clientY - panelY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPanelPointerMove(e: PointerEvent) {
    if (!panelMoving) return;
    panelX = Math.max(8, Math.min(window.innerWidth - panelW - 8, e.clientX - panelMoveOffsetX));
    panelY = Math.max(8, Math.min(window.innerHeight - panelH - 8, e.clientY - panelMoveOffsetY));
  }

  function onPanelPointerUp() {
    panelMoving = false;
  }

  // ── Panel resize (NW corner handle) ──────────────────────────────────────
  let resizing   = $state(false);
  let resizeSX   = 0;
  let resizeSY   = 0;
  let resizeOrigW = 0;
  let resizeOrigH = 0;
  let resizeRight = 0;
  let resizeBottom = 0;

  function onResizePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    resizing    = true;
    resizeSX    = e.clientX;
    resizeSY    = e.clientY;
    resizeOrigW = panelW;
    resizeOrigH = panelH;
    resizeRight = panelX + panelW;
    resizeBottom = panelY + panelH;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: PointerEvent) {
    if (!resizing) return;
    const maxWidth = Math.max(PANEL_MIN_W, Math.min(680, resizeRight - 8));
    const maxHeight = Math.max(PANEL_MIN_H, resizeBottom - 8);
    panelW = Math.max(PANEL_MIN_W, Math.min(maxWidth, resizeOrigW - (e.clientX - resizeSX)));
    panelH = Math.max(PANEL_MIN_H, Math.min(maxHeight, resizeOrigH - (e.clientY - resizeSY)));
    panelX = resizeRight - panelW;
    panelY = resizeBottom - panelH;
  }

  function onResizePointerUp() {
    resizing = false;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  let inputText = $state('');
  let chatEl    = $state<HTMLElement | null>(null);
  let inputEl   = $state<HTMLInputElement | null>(null);
  let orbEl     = $state<HTMLElement | null>(null);
  let voiceSettingsOpen = $state(false);

  $effect(() => {
    asa.scrollRevision;
    tick().then(() => chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' }));
  });

  $effect(() => {
    if (asa.open) tick().then(() => inputEl?.focus());
  });

  $effect(() => {
    if (asaVoice.state === 'command-listening' || asaVoice.state === 'reviewing' || asaVoice.state === 'clarifying') {
      asa.activate();
    }
  });

  $effect(() => {
    if (asa.open && orbX >= 0) snapPanelToOrb();
  });

  async function onMessagesScroll() {
    if (!chatEl || chatEl.scrollTop > 40 || asa.historyLoading || !asa.historyHasMore) return;
    const previousHeight = chatEl.scrollHeight;
    const previousTop = chatEl.scrollTop;
    const loaded = await asa.loadOlderMessages();
    if (!loaded) return;
    await tick();
    chatEl.scrollTop = previousTop + chatEl.scrollHeight - previousHeight;
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    inputText = '';
    asa.send(text);
  }

  function closePanel() {
    asa.close();
    tick().then(() => orbEl?.focus());
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !asa.open) return;
    event.preventDefault();
    closePanel();
  }

  // ── Orb image ─────────────────────────────────────────────────────────────
  const ORB_IMAGES: Record<string, string> = {
    idle:     '/asa-orb-idle.gif',
    opening:  '/asa-born.gif',
    open:     '/asa-born-idle.png',
    thinking: '/asa-idle.gif',
    hidden:   '/asa-orb.png',
  };
  let orbSrc = $derived(ORB_IMAGES[asa.orbState] ?? '/asa-orb.png');

  // ── Budget ────────────────────────────────────────────────────────────────
  let budgetPct = $derived(
    asa.session
      ? Math.max(0, Math.min(1, 1 - asa.session.tokensUsed / asa.session.tokenBudget))
      : 1
  );
  let resetLabel = $derived((() => {
    if (!asa.session?.resetAt) return '';
    const ms = new Date(asa.session.resetAt).getTime() - Date.now();
    if (ms < 0) return 'resets soon';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h` : `${m}m`;
  })());

  onMount(() => {
    orbX = window.innerWidth  - ORB_SIZE - 24;
    orbY = window.innerHeight - ORB_SIZE - 24;
    window.addEventListener('resize', snapPanelToOrb);
    window.addEventListener('keydown', onWindowKeydown);
    asaVoice.hydrate();
    asaVoice.setCommandHandler(async (transcript, voiceInput) => {
      asa.activate();
      await asa.send(transcript, voiceInput);
      return asa.messages.findLast((message) => message.role === 'assistant')?.content;
    });
    asa.init();
  });

  onDestroy(() => {
    if (rippleTimer) clearTimeout(rippleTimer);
    window.removeEventListener('resize', snapPanelToOrb);
    window.removeEventListener('keydown', onWindowKeydown);
    asaVoice.destroy();
  });
</script>

{#if asa.orbState !== 'hidden' && orbX >= 0}

  <!-- ── Orb ────────────────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={orbEl}
    class="orb"
    class:orb--dragging={orbDragging}
    style="left:{orbX}px;top:{orbY}px;width:{ORB_SIZE}px;height:{ORB_SIZE}px"
    role="button"
    tabindex="0"
    aria-label="ASA — AI Assistant (press to open)"
    onpointerdown={onOrbPointerDown}
    onpointermove={onOrbPointerMove}
    onpointerup={onOrbPointerUp}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') asa.toggle(); }}
  >
    <img class="orb-img" src={orbSrc} alt="ASA" draggable="false" />

    {#if rippling}
      <span class="orb-ripple" aria-hidden="true"></span>
    {/if}
  </div>

  <!-- ── Chat panel ─────────────────────────────────────────────────────── -->
  {#if asa.open}
    <div
      class="panel glass-container"
      class:panel--moving={panelMoving}
      style="left:{panelX}px;top:{panelY}px;width:{panelW}px;height:{panelH}px"
      role="dialog"
      aria-label="ASA Chat"
    >
      <!-- Resize handle (NW corner) -->
      <div
        class="resize-handle"
        aria-hidden="true"
        onpointerdown={onResizePointerDown}
        onpointermove={onResizePointerMove}
        onpointerup={onResizePointerUp}
        onpointercancel={onResizePointerUp}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M8 2 L2 8M5 2 L2 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>

      <div
        class="panel-header"
        role="group"
        aria-label="ASA chat header and drag handle"
        onpointerdown={onPanelPointerDown}
        onpointermove={onPanelPointerMove}
        onpointerup={onPanelPointerUp}
        onpointercancel={onPanelPointerUp}
      >
        <div class="panel-title">
          <img src="/asa-orb-idle.gif" alt="" class="panel-avatar" />
          <span>ASA</span>
          {#if asa.orbState === 'thinking'}
            <span class="panel-thinking-badge">thinking…</span>
          {/if}
        </div>
        <div
          class="panel-header-actions"
          role="group"
          aria-label="ASA chat controls"
          onpointerdown={(event) => event.stopPropagation()}
        >
          {#if asa.session}
            <span
              class="budget-pill"
              class:budget-pill--low={budgetPct < 0.3}
              title="Token budget · {resetLabel} until reset"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-dasharray="{budgetPct * 18.85} 18.85"
                  stroke-dashoffset="4.7"
                  stroke-linecap="round"
                />
              </svg>
              {Math.round(budgetPct * 100)}%
            </span>
          {/if}
          <button
            class="icon-btn"
            class:icon-btn--active={voiceSettingsOpen}
            onclick={() => voiceSettingsOpen = !voiceSettingsOpen}
            title="Voice settings"
            aria-label="Voice settings"
            aria-expanded={voiceSettingsOpen}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
          </button>
          <button
            class="icon-btn"
            onpointerdown={(event) => event.stopPropagation()}
            onclick={() => asa.clearConversation()}
            title="Clear view"
            aria-label="Clear conversation view"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
          <button
            class="icon-btn"
            onpointerdown={(event) => event.stopPropagation()}
            onclick={closePanel}
            title="Close"
            aria-label="Close ASA"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {#if voiceSettingsOpen}
        <div class="voice-settings">
          <label class="voice-toggle">
            <input
              type="checkbox"
              checked={asaVoice.preferences.autoSpeak}
              onchange={(event) => asaVoice.updatePreferences({
                autoSpeak: (event.currentTarget as HTMLInputElement).checked,
              })}
            />
            Speak responses
          </label>
          <label>
            <span>Speed {asaVoice.preferences.speed.toFixed(1)}x</span>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.1"
              value={asaVoice.preferences.speed}
              oninput={(event) => asaVoice.updatePreferences({
                speed: Number((event.currentTarget as HTMLInputElement).value),
              })}
            />
          </label>
          <label>
            <span>Volume {Math.round(asaVoice.preferences.volume * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={asaVoice.preferences.volume}
              oninput={(event) => asaVoice.updatePreferences({
                volume: Number((event.currentTarget as HTMLInputElement).value),
              })}
            />
          </label>
        </div>
      {/if}

      <!-- Messages -->
      <div class="messages" bind:this={chatEl} onscroll={onMessagesScroll} aria-live="polite">
        {#if asa.historyLoading && asa.messages.length > 0}
          <div class="history-status">Loading earlier messages...</div>
        {:else if !asa.historyHasMore && asa.messages.length > 0}
          <div class="history-status">Start of this session</div>
        {/if}
        {#if asa.messages.length === 0}
          <div class="empty-state">
            <img src="/asa-born-idle.png" alt="ASA" class="empty-img" />
            <p class="empty-title">Hi! I'm ASA</p>
            <p class="empty-hint">Ask about projects, builds, test coverage, or just navigate anywhere.</p>
          </div>
        {:else}
          {#each asa.messages as msg (msg.id)}
            <div class="msg" class:msg--user={msg.role === 'user'} class:msg--assistant={msg.role === 'assistant'}>
              {#if msg.role === 'assistant'}
                <img src="/asa-orb-idle.gif" alt="ASA" class="msg-avatar" />
              {/if}
              <div class="msg-bubble">
                {#if msg.content}
                  {msg.content}
                {:else if asa.streaming && msg === asa.messages.at(-1)}
                  <span class="thinking-bubble-text">{asa.thinkingText ?? 'Thinking'}</span>
                  <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>
                {/if}
                {#if msg.actions?.length}
                  <div class="msg-actions">
                    {#each msg.actions as action}
                      {@render ActionChip({ action })}
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
        {#if asa.error}
          <div class="error-msg">{asa.error}</div>
        {/if}
      </div>

      <!-- svelte-ignore a11y_unknown_role -->
      {#if asaVoice.state === 'downloading' || asaVoice.state === 'setup'}
        <div class="voice-progress" role="status">
          <span>{asaVoice.state === 'setup' ? 'Preparing voice' : 'Downloading local voice models'}</span>
          <progress max="1" value={asaVoice.downloadProgress}></progress>
        </div>
      {:else if asaVoice.state === 'clarifying'}
        <div class="voice-review" role="region" aria-label="Entity clarification">
          {#each asaVoice.clarifications as clarification (clarification.originalSpan)}
            <div class="voice-clarification">
              <p class="voice-clarification-label">I heard "<em>{clarification.originalSpan}</em>" — which did you mean?</p>
              <div class="voice-clarification-candidates" role="group" aria-label="Candidates for {clarification.originalSpan}">
                {#each clarification.candidates as candidate}
                  <button
                    class="voice-candidate-btn"
                    onclick={() => asaVoice.applyClarification(clarification, candidate)}
                    aria-label="Select {candidate.display} ({candidate.type})"
                  >
                    <span class="voice-candidate-name">{candidate.display}</span>
                    <span class="voice-candidate-type">{candidate.type}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
          <div class="voice-review-row" style="margin-top:8px">
            <button class="icon-btn" onclick={() => asaVoice.retryCommand()} title="Record again" aria-label="Record again">↻</button>
            <button class="icon-btn" onclick={() => asaVoice.cancelReview()} title="Cancel" aria-label="Cancel">✕</button>
          </div>
        </div>
      {:else if asaVoice.state === 'reviewing'}
        <div class="voice-review">
          <label for="asa-voice-transcript">Review transcript</label>
          <div class="voice-review-row">
            <input id="asa-voice-transcript" bind:value={asaVoice.resolvedText} class="chat-input" aria-label="Resolved transcript" />
            <button class="icon-btn" onclick={() => asaVoice.retryCommand()} title="Record again" aria-label="Record again">↻</button>
            <button class="send-btn" onclick={() => asaVoice.confirmTranscript()} title="Send transcript" aria-label="Send transcript">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      {/if}

      <form class="input-row" onsubmit={handleSubmit}>
        {#if asa.voiceEnabled}
        <button
          type="button"
          class="voice-btn"
          class:voice-btn--active={asaVoice.state === 'wake-listening' || asaVoice.state === 'command-listening'}
          class:voice-btn--error={asaVoice.state === 'error'}
          onclick={() => asaVoice.toggleListening()}
          title={asaVoice.enabled
            ? (asaVoice.state === 'paused' ? 'Resume wake listening' : 'Pause wake listening')
            : 'Set up local voice'}
          aria-label={asaVoice.enabled ? 'Toggle ASA wake listening' : 'Set up ASA voice'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>
        </button>
        {/if}
        <input
          bind:this={inputEl}
          bind:value={inputText}
          class="chat-input"
          placeholder="Ask anything…"
          disabled={asa.streaming}
          onkeydown={(e) => { if (e.key === 'Escape') asa.close(); }}
          autocomplete="off"
          aria-label="Message ASA"
        />
        {#if asa.streaming}
          <button type="button" class="send-btn send-btn--stop" onclick={() => asa.cancel()} aria-label="Stop">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
          </button>
        {:else}
          <button type="submit" class="send-btn" disabled={!inputText.trim()} aria-label="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        {/if}
      </form>

      {#if asaVoice.enabled && asaVoice.state !== 'reviewing' && asaVoice.state !== 'clarifying'}
        <!-- svelte-ignore a11y_unknown_role -->
        <div class=”voice-state” role=”status”>
          <span class=”voice-level” style:--voice-level={asaVoice.audioLevel}></span>
          {asaVoice.state === 'wake-listening' ? 'Listening for “Hi ASA” or “Hello ASA”' : asaVoice.state.replaceAll('-', ' ')}
        </div>
      {:else if asaVoice.error}
        <div class=”voice-state” class:voice-state--error={true}>{asaVoice.error}</div>
      {/if}

    </div>
  {/if}
{/if}

{#snippet ActionChip({ action }: { action: AsaAction })}
  {#if action.type === 'navigate'}
    <a href={action.payload.path as string} class="action-chip" onclick={() => asa.close()}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      {action.payload.label ?? action.payload.path}
    </a>
  {/if}
{/snippet}

<style>
  /* ── Orb ───────────────────────────────────────────────────────────────── */
  .orb {
    position: fixed;
    z-index: 9999;
    cursor: grab;
    user-select: none;
    touch-action: none;
    /* No background, no border — pure image */
  }
  .orb--dragging { cursor: grabbing; }

  .orb-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), filter 0.15s;
    filter: drop-shadow(0 4px 12px rgba(34,211,238,0.35));
  }
  .orb:hover .orb-img:not(.orb--dragging .orb-img) {
    transform: scale(1.1);
    filter: drop-shadow(0 6px 18px rgba(34,211,238,0.55));
  }

  /* Ripple */
  .orb-ripple {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2.5px solid rgba(34,211,238,0.7);
    animation: ripple-out 0.62s cubic-bezier(0.2,0.6,0.4,1) forwards;
    pointer-events: none;
  }
  @keyframes ripple-out {
    from { transform: scale(1);    opacity: 1; }
    to   { transform: scale(1.9);  opacity: 0; }
  }

  /* ── Panel ─────────────────────────────────────────────────────────────── */
  .panel {
    position: fixed;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    overflow: hidden;
    background: var(--surface-overlay, #ffffff);
    border: 1px solid rgba(203,213,225,0.7);
    box-shadow:
      0 2px 8px rgba(0,0,0,0.07),
      0 12px 32px rgba(0,0,0,0.12),
      0 0 0 1px rgba(0,0,0,0.02);
    animation: panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
    min-width: 300px;
    min-height: 340px;
  }
  :global([data-theme='dark']) .panel {
    background: #1a2235;
    border-color: rgba(51,65,85,0.75);
    box-shadow: 0 2px 8px rgba(0,0,0,0.25), 0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04);
  }
  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: none; }
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 10px 27px;
    border-bottom: 1px solid rgba(203,213,225,0.45);
    flex-shrink: 0;
    user-select: none;
    background: rgba(240,249,255,0.6);
    cursor: grab;
    touch-action: none;
  }
  .panel--moving .panel-header { cursor: grabbing; }
  :global([data-theme='dark']) .panel-header {
    background: rgba(14,165,233,0.06);
    border-bottom-color: rgba(51,65,85,0.5);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    letter-spacing: 0.01em;
    pointer-events: none;
  }
  :global([data-theme='dark']) .panel-title { color: #e2e8f0; }

  .panel-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: contain;
  }
  .panel-thinking-badge {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-accent, #22d3ee);
    background: rgba(14,165,233,0.1);
    border-radius: 999px;
    padding: 1px 7px;
    letter-spacing: 0.03em;
  }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    pointer-events: auto;
  }

  .budget-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--color-accent, #22d3ee);
    background: rgba(34,211,238,0.08);
    border: 1px solid rgba(34,211,238,0.2);
    border-radius: 999px;
    padding: 2px 7px;
    margin-right: 2px;
  }
  .budget-pill--low { color: var(--color-warning, #f59e0b); border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .icon-btn:hover {
    background: rgba(0,0,0,0.07);
    color: var(--text-primary, #0f172a);
  }
  .icon-btn--active { background: var(--color-accent-subtle, #ecfcfb); color: var(--color-accent, #00afa5); }
  :global([data-theme='dark']) .icon-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #e2e8f0;
  }

  .voice-settings {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px 12px;
    padding: 9px 12px;
    border-bottom: 1px solid rgba(203,213,225,0.45);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    font-size: 11px;
  }
  .voice-settings label { display: grid; gap: 3px; min-width: 0; }
  .voice-settings input[type='range'] { width: 100%; accent-color: var(--color-accent, #00afa5); }
  .voice-settings .voice-toggle { grid-column: 1 / -1; display: flex; align-items: center; gap: 7px; }
  .voice-settings input[type='checkbox'] { accent-color: var(--color-accent, #00afa5); }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 12px 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    scroll-behavior: smooth;
  }

  .history-status {
    align-self: center;
    padding: 3px 8px;
    color: var(--color-text-muted, #64748b);
    font-size: 10px;
  }

  .glass-container {
    /* Semi-transparent background (15% opacity) */
    background: rgba(255, 255, 255, 0.15); 
  
    /* The core frosting effect */
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); /* Safari support */
    
    /* Subtle white border to simulate glass edges */
    border: 1px solid rgba(255, 255, 255, 0.25);
    
    /* Smooth curves and depth shadow */
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 6px;
    padding: 24px 20px;
    text-align: center;
  }
  .empty-img {
    width: 60px;
    height: 60px;
    object-fit: contain;
    margin-bottom: 6px;
  }
  .empty-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
  }
  :global([data-theme='dark']) .empty-title { color: #e2e8f0; }
  .empty-hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted, #94a3b8);
    line-height: 1.5;
  }

  .msg {
    display: flex;
    gap: 7px;
    align-items: flex-end;
  }
  .msg--user { flex-direction: row-reverse; }

  .msg-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: contain;
    flex-shrink: 0;
    margin-bottom: 2px;
  }

  .msg-bubble {
    max-width: 80%;
    padding: 8px 11px;
    border-radius: 13px;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg--user .msg-bubble {
    background: var(--color-accent, #22d3ee);
    color: #fff;
    border-bottom-right-radius: 3px;
  }
  .msg--assistant .msg-bubble {
    background: var(--color-accent-subtle, #f1f5f9);
    color: var(--color-text-primary, #0f172a);
    border-bottom-left-radius: 3px;
  }
  :global([data-theme='dark']) .msg--assistant .msg-bubble {
    background: rgba(51,65,85,0.55);
    color: var(--color-text-primary, #e2e8f0);
  }

  /* Thinking dots */
  .dots { display: inline-flex; gap: 3px; align-items: center; height: 14px; }
  .thinking-bubble-text { margin-right: 6px; color: var(--color-text-muted, #64748b); }
  .dots span {
    width: 5px; height: 5px; border-radius: 50%;
    background: #94a3b8;
    animation: dot 1.1s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.18s; }
  .dots span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes dot {
    0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
    40%           { transform: scale(1);    opacity: 1; }
  }

  .msg-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
  .action-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(14,165,233,0.1);
    color: var(--color-accent, #22d3ee);
    text-decoration: none;
    border: 1px solid rgba(14,165,233,0.25);
    cursor: pointer;
    transition: background 0.1s;
  }
  .action-chip:hover { background: rgba(14,165,233,0.2); }

  .error-msg {
    font-size: 12px;
    color: var(--color-danger, #ef4444);
    background: rgba(239,68,68,0.07);
    border-radius: 8px;
    padding: 6px 9px;
  }

  /* Input */
  .input-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 10px;
    border-top: 1px solid rgba(203,213,225,0.45);
    flex-shrink: 0;
  }
  :global([data-theme='dark']) .input-row { border-top-color: rgba(51,65,85,0.5); }

  .chat-input {
    flex: 1;
    padding: 7px 11px;
    border-radius: 9px;
    border: 1px solid rgba(203,213,225,0.8);
    background: #f8fafc;
    color: #0f172a;
    font-size: 13px;
    outline: none;
    transition: border-color 0.12s, box-shadow 0.12s;
    font-family: inherit;
  }
  .chat-input:focus {
    border-color: var(--color-accent, #22d3ee);
    box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
  }
  .chat-input:disabled { opacity: 0.55; }
  :global([data-theme='dark']) .chat-input {
    background: rgba(15,23,42,0.7);
    border-color: rgba(51,65,85,0.7);
    color: #e2e8f0;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: none;
    background: var(--color-accent, #0ea5e9);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, opacity 0.12s, transform 0.1s;
  }
  .send-btn:not(:disabled):hover { background: var(--color-accent-hover, #0284c7); transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.38; cursor: default; }
  .send-btn--stop { background: var(--color-danger, #ef4444); }
  .send-btn--stop:hover { background: var(--color-danger-dark, #dc2626); }

  .voice-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 9px;
    background: transparent;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
  }
  .voice-btn--active {
    color: var(--color-accent, #00afa5);
    border-color: var(--color-accent, #00afa5);
    background: var(--color-accent-subtle, #ecfcfb);
  }
  .voice-btn--error { color: var(--color-danger, #ef4444); border-color: var(--color-danger, #ef4444); }

  .voice-progress, .voice-review {
    display: grid;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid var(--color-border, #cbd5e1);
    color: var(--color-text-muted, #64748b);
    font-size: 11px;
  }
  .voice-progress progress { width: 100%; height: 5px; accent-color: var(--color-accent, #00afa5); }
  .voice-review-row { display: flex; gap: 6px; align-items: center; min-width: 0; }
  .voice-review-row .chat-input { min-width: 0; }
  .voice-clarification { display: grid; gap: 5px; }
  .voice-clarification-label { margin: 0; font-size: 11px; color: var(--color-text, #1e293b); }
  .voice-clarification-label em { font-style: normal; font-weight: 600; }
  .voice-clarification-candidates { display: flex; flex-wrap: wrap; gap: 5px; }
  .voice-candidate-btn {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 5px 9px; border-radius: 6px; border: 1px solid var(--color-border, #cbd5e1);
    background: var(--color-surface, #fff); cursor: pointer; font-size: 11px; gap: 1px;
  }
  .voice-candidate-btn:hover { border-color: var(--color-accent, #00afa5); background: var(--color-accent-light, #e6faf9); }
  .voice-candidate-btn:focus { outline: 2px solid var(--color-accent, #00afa5); outline-offset: 2px; }
  .voice-candidate-name { font-weight: 600; color: var(--color-text, #1e293b); }
  .voice-candidate-type { font-size: 10px; color: var(--color-text-muted, #64748b); text-transform: capitalize; }
  .panel :global(.voice-state) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px 7px;
    color: var(--color-text-muted, #64748b);
    font-size: 10px;
  }
  .panel :global(.voice-state--error) { color: var(--color-danger, #ef4444); }
  .panel :global(.voice-level) {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--color-accent, #00afa5);
    transform: scale(calc(0.8 + var(--voice-level) * 1.7));
  }

  /* Resize handle */
  .resize-handle {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: nw-resize;
    color: var(--color-muted, #94a3b8);
    border-radius: 4px;
    transition: color 0.12s;
    touch-action: none;
    user-select: none;
    z-index: 2;
  }
  .resize-handle:hover { color: var(--color-accent, #0ea5e9); }
</style>

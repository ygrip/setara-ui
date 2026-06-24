<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { asa } from '$lib/stores/asa.svelte';
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
    // Re-anchor panel whenever orb moves (unless panel is detached)
    if (!panelDetached) snapPanelToOrb();
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
  let panelDetached = $state(false);  // true once user drags the panel header

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

  // ── Panel drag (header) ───────────────────────────────────────────────────
  let panelDragging = $state(false);
  let panelDragSX   = 0;
  let panelDragSY   = 0;

  function onPanelHeaderPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    panelDragging = true;
    panelDetached = true;
    panelDragSX   = e.clientX - panelX;
    panelDragSY   = e.clientY - panelY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPanelHeaderPointerMove(e: PointerEvent) {
    if (!panelDragging) return;
    panelX = Math.max(0, Math.min(window.innerWidth  - panelW, e.clientX - panelDragSX));
    panelY = Math.max(0, Math.min(window.innerHeight - 40,     e.clientY - panelDragSY));
  }

  function onPanelHeaderPointerUp() {
    panelDragging = false;
  }

  // ── Panel resize (SE corner handle) ──────────────────────────────────────
  let resizing   = $state(false);
  let resizeSX   = 0;
  let resizeSY   = 0;
  let resizeOrigW = 0;
  let resizeOrigH = 0;

  function onResizePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    resizing    = true;
    resizeSX    = e.clientX;
    resizeSY    = e.clientY;
    resizeOrigW = panelW;
    resizeOrigH = panelH;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: PointerEvent) {
    if (!resizing) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    panelW = Math.max(PANEL_MIN_W, Math.min(680, resizeOrigW + (e.clientX - resizeSX)));
    panelH = Math.max(PANEL_MIN_H, Math.min(vh - panelY - 8, resizeOrigH + (e.clientY - resizeSY)));
  }

  function onResizePointerUp() {
    resizing = false;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  let inputText = $state('');
  let chatEl    = $state<HTMLElement | null>(null);
  let inputEl   = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (asa.messages.length > 0) {
      tick().then(() => chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' }));
    }
  });

  $effect(() => {
    if (asa.open) tick().then(() => inputEl?.focus());
  });

  // Snap panel whenever orb is repositioned and panel is anchored
  $effect(() => {
    if (!panelDetached && asa.open && orbX >= 0) snapPanelToOrb();
  });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    inputText = '';
    asa.send(text);
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
    asa.init();
  });

  onDestroy(() => {
    if (rippleTimer) clearTimeout(rippleTimer);
  });
</script>

{#if asa.orbState !== 'hidden' && orbX >= 0}

  <!-- ── Orb ────────────────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
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
      class="panel"
      class:panel--dragging={panelDragging}
      style="left:{panelX}px;top:{panelY}px;width:{panelW}px;height:{panelH}px"
      role="dialog"
      aria-label="ASA Chat"
    >
      <!-- Header (drag handle) -->
      <div
        class="panel-header"
        class:panel-header--dragging={panelDragging}
        onpointerdown={onPanelHeaderPointerDown}
        onpointermove={onPanelHeaderPointerMove}
        onpointerup={onPanelHeaderPointerUp}
        role="presentation"
      >
        <div class="panel-title">
          <img src="/asa-orb-idle.gif" alt="" class="panel-avatar" />
          <span>ASA</span>
          {#if asa.orbState === 'thinking'}
            <span class="panel-thinking-badge">thinking…</span>
          {/if}
        </div>
        <div class="panel-header-actions">
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
          <button class="icon-btn" onclick={() => asa.clearConversation()} title="Clear" aria-label="Clear conversation">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
          <button class="icon-btn" onclick={() => asa.close()} title="Close" aria-label="Close ASA">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="messages" bind:this={chatEl}>
        {#if asa.messages.length === 0}
          <div class="empty-state">
            <img src="/asa-born-idle.png" alt="ASA" class="empty-img" />
            <p class="empty-title">Hi! I'm ASA</p>
            <p class="empty-hint">Ask about projects, builds, test coverage, or just navigate anywhere.</p>
          </div>
        {:else}
          {#each asa.messages as msg (msg.timestamp + msg.role)}
            <div class="msg" class:msg--user={msg.role === 'user'} class:msg--assistant={msg.role === 'assistant'}>
              {#if msg.role === 'assistant'}
                <img src="/asa-orb-idle.gif" alt="ASA" class="msg-avatar" />
              {/if}
              <div class="msg-bubble">
                {#if msg.content}
                  {msg.content}
                {:else if asa.streaming}
                  <span class="dots"><span></span><span></span><span></span></span>
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

      <!-- Input -->
      <form class="input-row" onsubmit={handleSubmit}>
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

      <!-- Resize handle (SE corner) -->
      <div
        class="resize-handle"
        aria-hidden="true"
        onpointerdown={onResizePointerDown}
        onpointermove={onResizePointerMove}
        onpointerup={onResizePointerUp}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 8 L8 2M5 8 L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
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
    padding: 10px 10px 10px 13px;
    border-bottom: 1px solid rgba(203,213,225,0.45);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
    touch-action: none;
    background: rgba(240,249,255,0.6);
  }
  .panel-header--dragging { cursor: grabbing; }
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
    color: #0ea5e9;
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
    color: #22d3ee;
    background: rgba(34,211,238,0.08);
    border: 1px solid rgba(34,211,238,0.2);
    border-radius: 999px;
    padding: 2px 7px;
    margin-right: 2px;
  }
  .budget-pill--low { color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }

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
  :global([data-theme='dark']) .icon-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #e2e8f0;
  }

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
    background: #0ea5e9;
    color: #fff;
    border-bottom-right-radius: 3px;
  }
  .msg--assistant .msg-bubble {
    background: #f1f5f9;
    color: #0f172a;
    border-bottom-left-radius: 3px;
  }
  :global([data-theme='dark']) .msg--assistant .msg-bubble {
    background: rgba(51,65,85,0.55);
    color: #e2e8f0;
  }

  /* Thinking dots */
  .dots { display: inline-flex; gap: 3px; align-items: center; height: 14px; }
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
    color: #0ea5e9;
    text-decoration: none;
    border: 1px solid rgba(14,165,233,0.25);
    cursor: pointer;
    transition: background 0.1s;
  }
  .action-chip:hover { background: rgba(14,165,233,0.2); }

  .error-msg {
    font-size: 12px;
    color: #ef4444;
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
    border-color: #0ea5e9;
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
    background: #0ea5e9;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, opacity 0.12s, transform 0.1s;
  }
  .send-btn:not(:disabled):hover { background: #0284c7; transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.38; cursor: default; }
  .send-btn--stop { background: #ef4444; }
  .send-btn--stop:hover { background: #dc2626; }

  /* Resize handle */
  .resize-handle {
    position: absolute;
    bottom: 3px;
    right: 3px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: se-resize;
    color: #94a3b8;
    border-radius: 4px;
    transition: color 0.12s;
    touch-action: none;
    user-select: none;
  }
  .resize-handle:hover { color: #0ea5e9; }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { asa } from '$lib/stores/asa.svelte';
  import type { AsaAction } from '$lib/api/asa';

  // ── Orb drag ──────────────────────────────────────────────────────────────
  let orbX = $state(0);
  let orbY = $state(0);
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMovedPx = 0;

  function onOrbPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragMovedPx = 0;
    dragStartX = e.clientX - orbX;
    dragStartY = e.clientY - orbY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onOrbPointerMove(e: PointerEvent) {
    if (!dragging) return;
    dragMovedPx += Math.abs(e.movementX) + Math.abs(e.movementY);
    orbX = e.clientX - dragStartX;
    orbY = e.clientY - dragStartY;
  }

  function onOrbPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    if (dragMovedPx < 6) asa.toggle();
  }

  // ── Chat input ────────────────────────────────────────────────────────────
  let inputText = $state('');
  let chatEl = $state<HTMLElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (asa.messages.length > 0) {
      tick().then(() => {
        chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
      });
    }
  });

  $effect(() => {
    if (asa.open) {
      tick().then(() => inputEl?.focus());
    }
  });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    inputText = '';
    asa.send(text);
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') asa.close();
  }

  // ── Orb image by state ────────────────────────────────────────────────────
  const ORB_IMAGES = {
    idle:     '/asa-orb-idle.gif',   // gentle ambient pulse
    opening:  '/asa-born.gif',       // birth animation (plays once)
    open:     '/asa-born-idle.png',  // settled, chat open
    thinking: '/asa-idle.gif',       // processing
    hidden:   '/asa-orb.png',        // static fallback
  } as const;

  let orbSrc = $derived(ORB_IMAGES[asa.orbState] ?? '/asa-orb.png');

  // ── Budget ring ───────────────────────────────────────────────────────────
  let budgetPct = $derived(
    asa.session
      ? Math.max(0, Math.min(1, 1 - asa.session.tokensUsed / asa.session.tokenBudget))
      : 1
  );
  const RING_R = 22;
  const RING_CIRC = 2 * Math.PI * RING_R;
  let ringDash = $derived(budgetPct * RING_CIRC);

  // ── Format reset time ─────────────────────────────────────────────────────
  let resetLabel = $derived((() => {
    if (!asa.session?.resetAt) return '';
    const ms = new Date(asa.session.resetAt).getTime() - Date.now();
    if (ms < 0) return 'resets soon';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `resets in ${h}h` : `resets in ${m}m`;
  })());

  onMount(() => {
    asa.init();
  });
</script>

{#if asa.orbState !== 'hidden'}
  <!-- Floating orb -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="asa-orb-wrap"
    class:asa-orb-wrap--open={asa.open}
    style:--orb-x="{orbX}px"
    style:--orb-y="{orbY}px"
    role="img"
    aria-label="ASA — AI Assistant"
    onpointerdown={onOrbPointerDown}
    onpointermove={onOrbPointerMove}
    onpointerup={onOrbPointerUp}
  >
    <!-- Budget ring SVG overlay -->
    {#if asa.session}
      <svg class="asa-budget-ring" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={RING_R} fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="3"/>
        <circle
          cx="28" cy="28" r={RING_R} fill="none"
          stroke={budgetPct > 0.3 ? 'var(--asa-ring-ok, #22d3ee)' : 'var(--asa-ring-low, #f59e0b)'}
          stroke-width="3"
          stroke-dasharray="{ringDash} {RING_CIRC}"
          stroke-dashoffset={RING_CIRC * 0.25}
          stroke-linecap="round"
        />
      </svg>
    {/if}

    <img
      class="asa-orb-img"
      src={orbSrc}
      alt="ASA"
      draggable="false"
    />
  </div>

  <!-- Chat overlay -->
  {#if asa.open}
    <div class="asa-panel" role="dialog" aria-label="ASA Chat" aria-modal="false">
      <!-- Header -->
      <div class="asa-panel-header">
        <span class="asa-panel-title">
          <img src="/asa-born-idle.png" alt="" class="asa-panel-avatar" />
          ASA
        </span>
        <div class="asa-panel-actions">
          {#if asa.session}
            <span class="asa-budget-label" title={resetLabel}>
              {Math.round(budgetPct * 100)}% budget · {resetLabel}
            </span>
          {/if}
          <button
            class="asa-icon-btn"
            onclick={() => asa.clearConversation()}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
          <button
            class="asa-icon-btn"
            onclick={() => asa.close()}
            title="Close"
            aria-label="Close ASA"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="asa-messages" bind:this={chatEl}>
        {#if asa.messages.length === 0}
          <div class="asa-empty">
            <img src="/asa-born-idle.png" alt="ASA" class="asa-empty-img" />
            <p>Hi! I'm ASA, your Setara assistant.</p>
            <p class="asa-empty-hint">Ask me about projects, builds, test coverage, or navigate anywhere.</p>
          </div>
        {:else}
          {#each asa.messages as msg (msg.timestamp + msg.role)}
            <div class="asa-msg" class:asa-msg--user={msg.role === 'user'} class:asa-msg--assistant={msg.role === 'assistant'}>
              {#if msg.role === 'assistant'}
                <img src="/asa-born-idle.png" alt="ASA" class="asa-msg-avatar" />
              {/if}
              <div class="asa-msg-bubble">
                {#if msg.content}
                  <span>{msg.content}</span>
                {:else if asa.streaming && msg.role === 'assistant'}
                  <span class="asa-thinking-dots">
                    <span></span><span></span><span></span>
                  </span>
                {/if}
                {#if msg.actions?.length}
                  <div class="asa-msg-actions">
                    {#each msg.actions as action}
                      {@render AsaActionChip({ action })}
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}

        {#if asa.error}
          <div class="asa-error">{asa.error}</div>
        {/if}
      </div>

      <!-- Input -->
      <form class="asa-input-row" onsubmit={handleSubmit}>
        <input
          bind:this={inputEl}
          bind:value={inputText}
          class="asa-input"
          placeholder="Ask anything…"
          disabled={asa.streaming}
          onkeydown={handleInputKeydown}
          autocomplete="off"
          aria-label="Message ASA"
        />
        {#if asa.streaming}
          <button type="button" class="asa-send-btn asa-send-btn--stop" onclick={() => asa.cancel()} aria-label="Stop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
        {:else}
          <button type="submit" class="asa-send-btn" disabled={!inputText.trim()} aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        {/if}
      </form>
    </div>
  {/if}
{/if}

<!-- Inline micro-component for action chips -->
{#snippet AsaActionChip({ action }: { action: AsaAction })}
  {#if action.type === 'navigate'}
    <a href={action.payload.path as string} class="asa-action-chip" onclick={() => asa.close()}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Go to {action.payload.label ?? action.payload.path}
    </a>
  {/if}
{/snippet}

<style>
  /* ── Orb ─────────────────────────────────────────────────────────────── */
  .asa-orb-wrap {
    position: fixed;
    bottom: calc(24px - var(--orb-y, 0px));
    right: calc(24px - var(--orb-x, 0px));
    width: 56px;
    height: 56px;
    cursor: grab;
    z-index: 9998;
    user-select: none;
    touch-action: none;
  }
  .asa-orb-wrap:active { cursor: grabbing; }

  .asa-orb-img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: block;
    pointer-events: none;
    transition: transform 0.15s ease;
  }
  .asa-orb-wrap:hover .asa-orb-img {
    transform: scale(1.08);
  }

  .asa-budget-ring {
    position: absolute;
    inset: 0;
    width: 56px;
    height: 56px;
    pointer-events: none;
    transform: rotate(-90deg);
  }

  /* ── Panel ───────────────────────────────────────────────────────────── */
  .asa-panel {
    position: fixed;
    bottom: 92px;
    right: 24px;
    width: 360px;
    max-height: 520px;
    background: var(--surface-overlay, #fff);
    border: 1px solid var(--border-color, rgba(203,213,225,0.8));
    border-radius: 16px;
    box-shadow:
      0 4px 6px -1px rgba(0,0,0,0.08),
      0 20px 40px -8px rgba(0,0,0,0.14),
      0 0 0 1px rgba(0,0,0,0.03);
    display: flex;
    flex-direction: column;
    z-index: 9997;
    overflow: hidden;
    animation: asa-panel-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
  }

  @keyframes asa-panel-in {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }

  :global([data-theme='dark']) .asa-panel {
    background: var(--surface-overlay, #1e293b);
    border-color: rgba(51,65,85,0.8);
  }

  /* Header */
  .asa-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 10px 14px;
    border-bottom: 1px solid var(--border-color, rgba(203,213,225,0.5));
    flex-shrink: 0;
  }
  .asa-panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    letter-spacing: 0.01em;
  }
  .asa-panel-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }
  .asa-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .asa-budget-label {
    font-size: 10px;
    color: var(--text-muted, #64748b);
    margin-right: 4px;
    white-space: nowrap;
  }
  .asa-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .asa-icon-btn:hover {
    background: var(--surface-hover, rgba(0,0,0,0.06));
    color: var(--text-primary, #0f172a);
  }

  /* Messages */
  .asa-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .asa-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 24px 16px;
    text-align: center;
    gap: 6px;
    color: var(--text-secondary, #475569);
  }
  .asa-empty-img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    margin-bottom: 8px;
    opacity: 0.9;
  }
  .asa-empty p { margin: 0; font-size: 13px; }
  .asa-empty-hint { font-size: 12px; color: var(--text-muted, #94a3b8); }

  .asa-msg {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .asa-msg--user {
    flex-direction: row-reverse;
  }
  .asa-msg-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .asa-msg-bubble {
    max-width: 82%;
    padding: 8px 11px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .asa-msg--user .asa-msg-bubble {
    background: var(--color-primary, #0ea5e9);
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .asa-msg--assistant .asa-msg-bubble {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #0f172a);
    border-bottom-left-radius: 4px;
  }
  :global([data-theme='dark']) .asa-msg--assistant .asa-msg-bubble {
    background: rgba(51,65,85,0.6);
    color: var(--text-primary, #f1f5f9);
  }

  /* Thinking dots */
  .asa-thinking-dots {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 16px;
  }
  .asa-thinking-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #94a3b8);
    animation: asa-dot 1.2s ease-in-out infinite;
  }
  .asa-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .asa-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes asa-dot {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  .asa-msg-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .asa-action-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(14,165,233,0.12);
    color: var(--color-primary, #0ea5e9);
    text-decoration: none;
    border: 1px solid rgba(14,165,233,0.3);
    cursor: pointer;
    transition: background 0.12s;
  }
  .asa-action-chip:hover {
    background: rgba(14,165,233,0.22);
  }

  .asa-error {
    font-size: 12px;
    color: var(--color-error, #ef4444);
    padding: 6px 8px;
    background: rgba(239,68,68,0.08);
    border-radius: 8px;
  }

  /* Input row */
  .asa-input-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--border-color, rgba(203,213,225,0.5));
    flex-shrink: 0;
  }
  .asa-input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-color, rgba(203,213,225,0.8));
    background: var(--surface-input, #f8fafc);
    color: var(--text-primary, #0f172a);
    font-size: 13px;
    outline: none;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .asa-input:focus {
    border-color: var(--color-primary, #0ea5e9);
    box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
  }
  .asa-input:disabled {
    opacity: 0.6;
  }
  :global([data-theme='dark']) .asa-input {
    background: rgba(30,41,59,0.8);
    border-color: rgba(51,65,85,0.8);
    color: #f1f5f9;
  }

  .asa-send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    background: var(--color-primary, #0ea5e9);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, opacity 0.12s;
  }
  .asa-send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .asa-send-btn:not(:disabled):hover {
    background: var(--color-primary-hover, #0284c7);
  }
  .asa-send-btn--stop {
    background: var(--color-error, #ef4444);
  }
  .asa-send-btn--stop:hover {
    background: #dc2626;
  }
</style>

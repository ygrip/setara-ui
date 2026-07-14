<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { asa } from '$lib/stores/asa.svelte';
  import { fetchVoiceModelsInfo, type AsaAction, type AsaVoiceModelsInfo } from '$lib/api/asa';
  import { renderMarkdown } from '$lib/markdown';
  import { sidecarVoice, type SidecarTranscript } from '$lib/voice/sidecar-voice.svelte';
  import type { SttMode } from '$lib/voice/stt-stream/protocol';
  import { getValidSession } from '$lib/auth';

  type ManualVoiceMode = Extract<SttMode, 'command' | 'dictation'>;
  let manualVoiceMode = $state<ManualVoiceMode>('command');

  // Dictation and degraded command transcripts await explicit review. An authoritative command
  // final is submitted directly by sidecarVoice according to the shared finality policy.
  let pendingTranscript = $state<SidecarTranscript | null>(null);
  let pendingDraft = $state('');

  // Dev/admin voice diagnostics panel (setara-s94o.12) - mode/provider/model come from GET
  // /models; last-request latency/fallback come from sidecarVoice.lastSttStats.
  const DIAGNOSTICS_ROLES = new Set(['SYSTEM_ADMIN', 'ADMIN', 'DEVELOPER']);
  const canSeeDiagnostics = DIAGNOSTICS_ROLES.has(getValidSession()?.role ?? '');
  let diagnosticsOpen = $state(false);
  let voiceModelsInfo = $state<AsaVoiceModelsInfo | null>(null);

  async function toggleDiagnostics() {
    diagnosticsOpen = !diagnosticsOpen;
    if (diagnosticsOpen && !voiceModelsInfo) {
      voiceModelsInfo = await fetchVoiceModelsInfo();
    }
  }

  // ── Constants ─────────────────────────────────────────────────────────────
  const ORB_SIZE   = 80;
  const PANEL_MIN_W = 280;
  const PANEL_MIN_H = 320;
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
    // Real user gesture - AudioContext.resume() (unlike creation) needs one, and browsers refuse it
    // silently otherwise. The onMount preload call earlier could only create the context + compile
    // the worklet module, not actually resume it, so it sat 'suspended' until the record button's
    // own click resumed it - eating ~800ms of real mic hardware spin-up out of the recording itself
    // (setara-s94o STT truncation, round 7). Resuming here instead, on opening the orb, gives that
    // spin-up the gap between "open ASA" and "click record" to finish instead.
    if (asa.voiceSidecar) sidecarVoice.preloadCapture();
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
    panelW = Math.min(panelW, Math.max(PANEL_MIN_W, vw - 16));
    panelH = Math.min(panelH, Math.max(PANEL_MIN_H, vh - 16));
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

  function fitToViewport() {
    orbX = Math.max(0, Math.min(window.innerWidth - ORB_SIZE, orbX));
    orbY = Math.max(0, Math.min(window.innerHeight - ORB_SIZE, orbY));
    snapPanelToOrb();
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
  // Free-text fallback typed alongside a clarification's option buttons, keyed by message id -
  // options are single-click shortcuts, this is the "type your own answer" escape hatch.
  let optionFreeText = $state<Record<string, string>>({});
  let chatEl    = $state<HTMLElement | null>(null);
  let inputEl   = $state<HTMLTextAreaElement | null>(null);
  const INPUT_MAX_HEIGHT = 140;
  let orbEl     = $state<HTMLElement | null>(null);
  let reviewEl  = $state<HTMLTextAreaElement | null>(null);
  let voiceSettingsOpen = $state(false);

  $effect(() => {
    asa.scrollRevision;
    tick().then(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; });
  });

  $effect(() => {
    if (asa.open) tick().then(() => inputEl?.focus());
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

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    inputText = '';
    resetInputHeight();
    // Reply is spoken sentence-by-sentence as it streams (handled in the asa store).
    await asa.send(text);
  }

  async function handleOptionFreeText(e: SubmitEvent, messageId: string) {
    e.preventDefault();
    const text = (optionFreeText[messageId] ?? '').trim();
    if (!text) return;
    optionFreeText[messageId] = '';
    await asa.answerOption(messageId, text);
  }

  // Auto-grow the composer like a normal chat input: expand with content, cap at
  // INPUT_MAX_HEIGHT and let it scroll beyond that instead of growing forever. The grown height is
  // kept in state (not just the element's inline style) because the textarea sits inside an {#if
  // asa.open} block - closing the panel unmounts it, and an inline style set only via JS would be
  // lost on remount. Reapplying it through the `style` binding survives that unmount/remount.
  let inputHeightPx = $state<number | null>(null);

  function autoGrowInput() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputHeightPx = Math.min(inputEl.scrollHeight, INPUT_MAX_HEIGHT);
  }

  function resetInputHeight() {
    inputHeightPx = null;
    if (inputEl) inputEl.style.height = 'auto';
  }

  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { asa.close(); return; }
    // Enter sends; Shift+Enter (or Cmd/Ctrl+Enter, mirrored by the window-level shortcut) inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (!asa.streaming && inputText.trim()) {
        (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
      }
    }
  }

  async function showTranscriptForReview(transcript: SidecarTranscript) {
    if (!asa.open) asa.activate();
    pendingTranscript = transcript;
    pendingDraft = transcript.text;
    await tick();
    reviewEl?.focus();
  }

  async function toggleSidecarMic() {
    if (sidecarVoice.recording) {
      const transcript = await sidecarVoice.stopRecording();
      if (transcript) await showTranscriptForReview(transcript);
    } else {
      pendingTranscript = null;
      await sidecarVoice.startRecording(manualVoiceMode);
    }
  }

  function toggleManualVoiceMode() {
    manualVoiceMode = manualVoiceMode === 'command' ? 'dictation' : 'command';
  }

  const manualVoiceLabel = $derived(manualVoiceMode === 'command' ? 'Command' : 'Dictation');
  const handsFreeCapturing = $derived(
    sidecarVoice.recording && sidecarVoice.captureMode === 'hands_free',
  );
  const activeVoiceLabel = $derived(handsFreeCapturing ? 'Command' : manualVoiceLabel);
  const voiceMicTitle = $derived(
    handsFreeCapturing
      ? 'Hands-free Command recording; pause to send'
      : sidecarVoice.recording
      ? `Stop ${manualVoiceLabel} recording (⌘/Ctrl+M)`
      : sidecarVoice.status === 'transcribing'
        ? `Transcribing ${manualVoiceLabel}…`
        : manualVoiceMode === 'command'
          ? 'Record Command (up to 15 seconds, ⌘/Ctrl+M)'
          : 'Record Dictation (up to 5 minutes, ⌘/Ctrl+M)',
  );

  async function confirmPendingTranscript() {
    const text = pendingDraft.trim();
    if (!text || !pendingTranscript) return;
    const voiceInput = { ...pendingTranscript.voiceInput, resolvedText: text };
    pendingTranscript = null;
    pendingDraft = '';
    await asa.send(text, voiceInput);
  }

  function discardPendingTranscript() {
    pendingTranscript = null;
    pendingDraft = '';
    sidecarVoice.resumeHandsFreeAfterReview();
  }

  function closePanel() {
    asa.close();
    tick().then(() => orbEl?.focus());
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (!asa.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    // Cmd/Ctrl+Enter sends from anywhere in the panel (plain Enter already submits from the input).
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      if (!asa.streaming && inputText.trim()) {
        event.preventDefault();
        const text = inputText.trim();
        inputText = '';
        resetInputHeight();
        void asa.send(text);
      }
      return;
    }
    // Cmd/Ctrl+Shift+M toggles Command/Dictation mode (checked before the plain Cmd/Ctrl+M below).
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === 'm' || event.key === 'M')) {
      if (asa.voiceSidecar && !sidecarVoice.busy) {
        event.preventDefault();
        toggleManualVoiceMode();
      }
      return;
    }
    // Cmd/Ctrl+M toggles voice recording (record shortcut).
    if ((event.metaKey || event.ctrlKey) && (event.key === 'm' || event.key === 'M')) {
      if (asa.voiceSidecar && sidecarVoice.status !== 'transcribing') {
        event.preventDefault();
        void toggleSidecarMic();
      }
    }
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

  // Sleek "thinking" glow border on the panel while a reply is streaming/being composed.
  // Held for a minimum visible duration so a near-instant response still flashes it -
  // otherwise a fast/mocked reply can resolve before the animation ever paints a frame.
  let panelActive = $state(false);
  let panelActiveOffTimer: ReturnType<typeof setTimeout> | null = null;
  const PANEL_ACTIVE_MIN_MS = 900;
  $effect(() => {
    const wantsActive = asa.streaming || asa.orbState === 'thinking';
    if (wantsActive) {
      if (panelActiveOffTimer) { clearTimeout(panelActiveOffTimer); panelActiveOffTimer = null; }
      panelActive = true;
    } else if (panelActive) {
      panelActiveOffTimer = setTimeout(() => { panelActive = false; panelActiveOffTimer = null; }, PANEL_ACTIVE_MIN_MS);
    }
  });

  function formatMsgTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  onMount(() => {
    orbX = window.innerWidth  - ORB_SIZE - 24;
    orbY = window.innerHeight - ORB_SIZE - 24;
    window.addEventListener('resize', fitToViewport);
    window.addEventListener('keydown', onWindowKeydown);
    // Hands-free auto-sends each transcribed utterance.
    sidecarVoice.onTranscript = (text, voiceInput) => { void asa.send(text, voiceInput); };
    sidecarVoice.onReviewTranscript = (transcript) => { void showTranscriptForReview(transcript); };
    asa.init().then(() => {
      if (asa.voiceSidecar) {
        sidecarVoice.hydrate();
        void sidecarVoice.loadVoices();
        void sidecarVoice.loadCatalog();
        sidecarVoice.preloadCapture();
      }
    });
  });

  // Arm hands-free only while the panel is open (mic off otherwise - privacy).
  $effect(() => {
    sidecarVoice.syncHandsFree(asa.open && asa.voiceSidecar);
  });

  onDestroy(() => {
    if (rippleTimer) clearTimeout(rippleTimer);
    if (panelActiveOffTimer) clearTimeout(panelActiveOffTimer);
    window.removeEventListener('resize', fitToViewport);
    window.removeEventListener('keydown', onWindowKeydown);
    sidecarVoice.onTranscript = null;
    sidecarVoice.onReviewTranscript = null;
    sidecarVoice.cancelRecording();
    sidecarVoice.disarmHandsFree();
    sidecarVoice.stopAudio();
  });
</script>

{#if asa.orbState !== 'hidden' && orbX >= 0}

  <!-- ── Orb ────────────────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={orbEl}
    class="orb"
    class:orb--dragging={orbDragging}
    class:orb--voice-active={sidecarVoice.recording}
    style="left:{orbX}px;top:{orbY}px;width:{ORB_SIZE}px;height:{ORB_SIZE}px"
    role="button"
    tabindex="0"
    aria-label="ASA - AI Assistant (press to open)"
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

  {#if asa.voiceSidecar}
    <button
      class="orb-voice-btn"
      class:orb-voice-btn--active={sidecarVoice.recording}
      class:orb-voice-btn--error={sidecarVoice.status === 'error'}
      style="left:{orbX + ORB_SIZE - 30}px;top:{orbY + ORB_SIZE - 30}px"
      onclick={toggleSidecarMic}
      disabled={sidecarVoice.status === 'transcribing' || handsFreeCapturing}
      aria-label={handsFreeCapturing ? 'Hands-free Command recording' : sidecarVoice.recording ? `Stop ${manualVoiceLabel} recording` : `Record ${manualVoiceLabel}`}
      title={voiceMicTitle}
    >
      {#if sidecarVoice.status === 'transcribing'}
        <span class="orb-voice-spinner" aria-hidden="true"></span>
      {:else}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>
      {/if}
    </button>

    {#if !asa.open && (sidecarVoice.recording || sidecarVoice.status === 'transcribing')}
      <div
        class="orb-voice-status"
        style="left:{orbX + ORB_SIZE / 2}px;top:{Math.max(8, orbY - 30)}px"
        role="status"
      >
        {#if sidecarVoice.recording && sidecarVoice.interimTranscript}
          {sidecarVoice.interimTranscript}
        {:else}
          {sidecarVoice.recording ? `Recording ${activeVoiceLabel}… ${handsFreeCapturing ? 'pause to send' : 'tap to stop'}` : `Transcribing ${activeVoiceLabel}…`}
        {/if}
      </div>
    {/if}
  {/if}

  <!-- ── Chat panel ─────────────────────────────────────────────────────── -->
  {#if asa.open}
    <div
      class="panel"
      class:panel--moving={panelMoving}
      class:panel--active={panelActive}
      style="left:{panelX}px;top:{panelY}px;width:{panelW}px;height:{panelH}px"
      role="dialog"
      aria-label="ASA Chat"
      aria-busy={panelActive}
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
          <span class="panel-avatar-wrap">
            <img src="/asa-orb-idle.gif" alt="" class="panel-avatar" />
            <span class="panel-avatar-dot" class:panel-avatar-dot--active={panelActive} aria-hidden="true"></span>
          </span>
          <span class="panel-title-text">
            <span class="panel-name">ASA</span>
            <span class="panel-status">
              {#if panelActive}
                Working<span class="status-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              {:else}
                Online
              {/if}
            </span>
          </span>
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
              title="Context budget · {resetLabel} until reset"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              Context · {Math.round(budgetPct * 100)}%
            </span>
          {/if}
          {#if asa.voiceSidecar}
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
          {/if}
          {#if asa.voiceSidecar && canSeeDiagnostics}
          <button
            class="icon-btn"
            class:icon-btn--active={diagnosticsOpen}
            onclick={toggleDiagnostics}
            title="Voice diagnostics"
            aria-label="Voice diagnostics"
            aria-expanded={diagnosticsOpen}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v4H9zM4 21V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M9 21v-6h6v6"/></svg>
          </button>
          {/if}
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
              checked={sidecarVoice.ttsEnabled}
              onchange={(event) => sidecarVoice.setTtsEnabled((event.currentTarget as HTMLInputElement).checked)}
            />
            Speak responses
          </label>
          {#if sidecarVoice.voices.length > 0}
            <label class="voice-pick">
              <span>Voice</span>
              <select
                value={sidecarVoice.voiceId ?? ''}
                onchange={(event) => sidecarVoice.setVoice((event.currentTarget as HTMLSelectElement).value)}
              >
                {#each sidecarVoice.voices as v (v.id)}
                  <option value={v.id}>{v.label}</option>
                {/each}
              </select>
            </label>
          {/if}
          <label class="voice-toggle">
            <input
              type="checkbox"
              checked={sidecarVoice.speakOnlyShort}
              onchange={(event) => sidecarVoice.setSpeakOnlyShort((event.currentTarget as HTMLInputElement).checked)}
            />
            Speak only short replies
          </label>
          <label class="voice-toggle">
            <input
              type="checkbox"
              checked={sidecarVoice.handsFree}
              onchange={(event) => sidecarVoice.setHandsFree((event.currentTarget as HTMLInputElement).checked)}
            />
            Hands-free (auto-listen &amp; send)
          </label>
          <label class="voice-toggle">
            <input
              type="checkbox"
              checked={sidecarVoice.earcons}
              onchange={(event) => sidecarVoice.setEarcons((event.currentTarget as HTMLInputElement).checked)}
            />
            Sound cues
          </label>
        </div>
      {/if}

      {#if diagnosticsOpen && canSeeDiagnostics}
        <div class="voice-diagnostics" role="group" aria-label="Voice diagnostics">
          {#if voiceModelsInfo}
            <dl>
              <dt>Voice mode</dt><dd>{voiceModelsInfo.mode}</dd>
              <dt>STT provider</dt><dd>{voiceModelsInfo.stt.activeProvider}</dd>
              <dt>STT model</dt><dd>{voiceModelsInfo.stt.activeModel}</dd>
              <dt>Fallback</dt><dd>{voiceModelsInfo.stt.fallbackProvider ? `enabled (${voiceModelsInfo.stt.fallbackProvider})` : 'disabled'}</dd>
              <dt>Last latency</dt><dd>{sidecarVoice.lastSttStats?.latencyMs != null ? `${sidecarVoice.lastSttStats.latencyMs}ms` : '-'}</dd>
              <dt>Fallback used</dt><dd>{sidecarVoice.lastSttStats ? (sidecarVoice.lastSttStats.fallbackUsed ? 'true' : 'false') : '-'}</dd>
            </dl>
          {:else}
            <span class="voice-diagnostics__empty">Voice service info unavailable.</span>
          {/if}
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
            <p class="empty-title">Hey, I'm ASA 👋</p>
            <p class="empty-hint">Your buddy for projects, builds, and test coverage. Ask me anything, or just tell me where you want to go.</p>
          </div>
        {:else}
          {#each asa.messages as msg (msg.id)}
            <div class="msg" class:msg--user={msg.role === 'user'} class:msg--assistant={msg.role === 'assistant'}>
              {#if msg.role === 'assistant'}
                <img src="/asa-orb-idle.gif" alt="ASA" class="msg-avatar" />
              {/if}
              <div class="msg-col">
                <div class="msg-bubble">
                  {#if msg.content}
                    {#if msg.role === 'assistant' && msg.streaming}
                      <div class="msg-streaming">{msg.content}</div>
                    {:else if msg.role === 'assistant'}
                      <!-- Content originates from our own backend LLM; rendered as markdown. -->
                      <div class="msg-md">{@html renderMarkdown(msg.content)}</div>
                    {:else}
                      {msg.content}
                    {/if}
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
                {#if msg.content}
                  <span class="msg-time">{formatMsgTime(msg.timestamp)}</span>
                {/if}
                {#if msg.options?.length}
                  <div class="msg-question-card" role="group" aria-label="Choose an option">
                    {#each msg.options as opt, i}
                      {@const selected = msg.answeredValue === opt.value}
                      {@const answered = !!msg.answeredValue}
                      <button
                        type="button"
                        class="msg-question-option"
                        class:msg-question-option--selected={selected}
                        disabled={asa.streaming || answered}
                        onclick={() => asa.answerOption(msg.id, opt.value)}
                      >
                        <span class="msg-question-num">{selected ? '✓' : i + 1}</span>
                        <span class="msg-question-text">
                          <span class="msg-question-title">{opt.label}</span>
                          {#if opt.description}
                            <span class="msg-question-subtitle">{opt.description}</span>
                          {/if}
                        </span>
                      </button>
                    {/each}
                    <form class="msg-options-freetext" onsubmit={(e) => handleOptionFreeText(e, msg.id)}>
                      <input
                        type="text"
                        class="msg-option-input"
                        placeholder="Or type your own answer…"
                        disabled={asa.streaming || !!msg.answeredValue}
                        value={optionFreeText[msg.id] ?? ''}
                        oninput={(e) => (optionFreeText[msg.id] = e.currentTarget.value)}
                      />
                      <button
                        type="submit"
                        class="msg-option-send"
                        disabled={asa.streaming || !!msg.answeredValue || !(optionFreeText[msg.id] ?? '').trim()}
                      >Send</button>
                    </form>
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

      {#if sidecarVoice.recording && sidecarVoice.interimTranscript}
        <div class="interim-transcript" role="status" aria-live="polite">{sidecarVoice.interimTranscript}</div>
      {/if}

      {#if pendingTranscript}
        <!-- Voice transcript review: never auto-sent, user edits/confirms or discards (setara-s94o.10). -->
        <div class="transcript-review" role="group" aria-label="Review voice transcript">
          <div class="input-shell">
            <textarea
              bind:this={reviewEl}
              bind:value={pendingDraft}
              class="chat-input"
              rows="2"
              aria-label="Edit transcribed text before sending"
              onkeydown={(e) => {
                if (e.key === 'Escape') { discardPendingTranscript(); return; }
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void confirmPendingTranscript(); }
              }}
            ></textarea>
            <button type="button" class="send-btn send-btn--secondary" onclick={discardPendingTranscript} aria-label="Discard" title="Discard (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
            <button type="button" class="send-btn" disabled={!pendingDraft.trim()} onclick={confirmPendingTranscript} aria-label="Send" title="Send (⌘/Ctrl+Enter)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      {:else}
      <form class="input-row" onsubmit={handleSubmit}>
        <div class="input-shell" class:input-shell--disabled={asa.streaming}>
          {#if asa.voiceSidecar}
          <button
            type="button"
            class="voice-mode-toggle"
            onclick={toggleManualVoiceMode}
            disabled={sidecarVoice.busy}
            aria-label="Voice capture mode: {manualVoiceLabel}. Press to switch."
            title="Mode: {manualVoiceLabel} (click or ⌘/Ctrl+Shift+M to switch)"
          >
            {@render VoiceModeIcon()}
          </button>
          <!-- Shared v2 push-to-talk: command can auto-submit; dictation always opens review. -->
          <button
            type="button"
            class="voice-btn"
            class:voice-btn--active={sidecarVoice.recording}
            class:voice-btn--error={sidecarVoice.status === 'error'}
            disabled={sidecarVoice.status === 'transcribing' || handsFreeCapturing}
            onclick={toggleSidecarMic}
            title={voiceMicTitle}
            aria-label={handsFreeCapturing ? 'Hands-free Command recording' : sidecarVoice.recording ? `Stop ${manualVoiceLabel} recording` : `Record ${manualVoiceLabel}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>
          </button>
          {/if}
          <textarea
            bind:this={inputEl}
            bind:value={inputText}
            class="chat-input"
            rows="1"
            style={inputHeightPx ? `height:${inputHeightPx}px` : undefined}
            placeholder="Ask ASA anything…"
            disabled={asa.streaming}
            oninput={autoGrowInput}
            onkeydown={onInputKeydown}
            autocomplete="off"
            aria-label="Message ASA"
          ></textarea>
          {#if asa.streaming}
            <button type="button" class="send-btn send-btn--stop" onclick={() => asa.cancel()} aria-label="Stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
            </button>
          {:else}
            <button type="submit" class="send-btn" disabled={!inputText.trim()} aria-label="Send" title="Send (Enter or ⌘/Ctrl+Enter)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          {/if}
        </div>
      </form>
      {/if}

      {#if asa.voiceSidecar && sidecarVoice.notice}
        <div class="voice-state voice-state--notice" role="status">{sidecarVoice.notice}</div>
      {/if}

      {#if asa.voiceSidecar && sidecarVoice.status === 'recording'}
        <!-- svelte-ignore a11y_unknown_role -->
        <div class="voice-state" role="status">
          <span class="voice-level voice-level--rec"></span>
          {#if sidecarVoice.captureMode === 'hands_free'}
            Recording Command… pause to send
          {:else}
            Recording {manualVoiceLabel}… click the mic to stop
          {/if}
        </div>
      {:else if asa.voiceSidecar && sidecarVoice.status === 'transcribing'}
        <!-- svelte-ignore a11y_unknown_role -->
        <div class="voice-state" role="status">
          Transcribing {sidecarVoice.captureMode === 'dictation' ? 'Dictation' : 'Command'}…
        </div>
      {:else if asa.voiceSidecar && sidecarVoice.status === 'listening'}
        <!-- svelte-ignore a11y_unknown_role -->
        <div class="voice-state" role="status">
          <span class="voice-level"></span>
          {sidecarVoice.wakeMode === 'wake' ? 'Say Hi ASA to start' : 'Hands-free on, listening'}
        </div>
      {:else if asa.voiceSidecar && sidecarVoice.error}
        <div class="voice-state voice-state--error" role="alert">{sidecarVoice.error}</div>
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
  {:else if action.type === 'confirm_required'}
    <div class="confirmation-card" role="group" aria-label="Confirm ASA action">
      <span class="confirmation-summary">{action.payload.summary ?? 'Confirm this action?'}</span>
      <div class="confirmation-actions">
        <button type="button" class="action-chip" disabled={asa.streaming}
          onclick={() => asa.confirmAction(action, 'REJECT')}>Cancel</button>
        <button type="button" class="action-chip action-chip--confirm" disabled={asa.streaming}
          onclick={() => asa.confirmAction(action, 'APPROVE')}>Approve</button>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet VoiceModeIcon()}
  {#if manualVoiceMode === 'command'}
    <!-- Command: quick, one-shot capture -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 11-13h-8l1-7z"/></svg>
  {:else}
    <!-- Dictation: longer-form text capture -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M21 6H3M17 12H3M13 18H3"/></svg>
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
    border-radius: 50%;
  }
  .orb--dragging { cursor: grabbing; }
  .orb--voice-active .orb-img {
    filter: drop-shadow(0 0 16px color-mix(in srgb, var(--color-accent), transparent 25%));
  }
  .orb:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

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

  .orb-voice-btn {
    position: fixed;
    z-index: 10000;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--color-border) 72%, white);
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-surface) 90%, transparent);
    color: var(--color-text-muted);
    box-shadow: 0 4px 12px rgb(15 23 42 / 0.2);
    backdrop-filter: blur(10px);
    cursor: pointer;
  }
  .orb-voice-btn:hover:not(:disabled),
  .orb-voice-btn--active {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: white;
  }
  .orb-voice-btn--error { border-color: var(--color-danger); color: var(--color-danger); }
  .orb-voice-btn:disabled { cursor: wait; }
  .orb-voice-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

  .voice-mode-toggle {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    flex-shrink: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .voice-mode-toggle:hover:not(:disabled) {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
  }
  .voice-mode-toggle:disabled { cursor: not-allowed; opacity: 0.55; }
  .voice-mode-toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .orb-voice-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: voice-spin 0.7s linear infinite;
  }
  @keyframes voice-spin { to { transform: rotate(360deg); } }

  .orb-voice-status {
    position: fixed;
    z-index: 9999;
    max-width: min(240px, calc(100vw - 16px));
    padding: 5px 9px;
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 58%);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-surface) 90%, transparent);
    color: var(--color-text);
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
    font-size: 11px;
    white-space: nowrap;
    transform: translateX(-50%);
    pointer-events: none;
  }

  /* ── Panel ─────────────────────────────────────────────────────────────── */
  .panel {
    position: fixed;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    border-radius: var(--radius);
    overflow: hidden;
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    background: color-mix(in srgb, var(--color-surface) 55%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-border) 72%, white);
    box-shadow: 0 8px 32px rgb(15 23 42 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.5);
    animation: panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
    min-width: min(280px, calc(100vw - 16px));
    min-height: min(320px, calc(100vh - 16px));
  }
  :global([data-theme='dark']) .panel {
    background: color-mix(in srgb, var(--color-surface) 58%, transparent);
    border-color: color-mix(in srgb, var(--color-border) 78%, white 8%);
    box-shadow: 0 12px 36px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.08);
  }
  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: none; }
  }

  /* Sleek animated thinking border.
     The border stays quiet while idle, then a narrow teal, cyan, blue, and violet
     light streak travels around the panel while ASA is working. */
  @property --asa-glow-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  .panel::before,
  .panel::after {
    content: '';
    position: absolute;
    pointer-events: none;
    border-radius: inherit;
    opacity: 0;
    transition: opacity 220ms ease;
  }

  /* Crisp animated ring. Most of the circumference remains transparent so the
     animation reads as a moving light streak instead of a spinning rainbow frame. */
  .panel::before {
    inset: 0;
    z-index: 4;
    padding: 1.5px;
    background: conic-gradient(
      from var(--asa-glow-angle),
      transparent 0deg 18deg,
      rgb(255 255 255 / 0.96) 28deg,
      var(--color-accent-mint, #5ef2d6) 48deg,
      #25c8df 78deg,
      #69a8ff 112deg,
      #a58bff 146deg,
      transparent 178deg 318deg,
      rgb(255 255 255 / 0.82) 340deg,
      transparent 360deg
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  /* A restrained inner bloom keeps the border visible over both light and dark
     content without turning the panel into illuminated gaming hardware. */
  .panel::after {
    inset: 1px;
    z-index: 3;
    border: 1px solid rgb(255 255 255 / 0.34);
    box-shadow:
      inset 0 0 14px color-mix(in srgb, var(--color-accent, #00afa5), transparent 91%),
      inset 0 0 3px rgb(255 255 255 / 0.28);
  }

  .panel--active {
    border-color: color-mix(in srgb, var(--color-accent, #00afa5), transparent 58%);
    box-shadow:
      0 10px 34px rgb(15 23 42 / 0.17),
      inset 0 1px 0 rgb(255 255 255 / 0.54),
      0 0 16px color-mix(in srgb, var(--color-accent, #00afa5), transparent 76%),
      0 0 34px rgb(91 166 255 / 0.11),
      0 0 48px rgb(165 139 255 / 0.08);
  }

  .panel--active::before {
    opacity: 1;
    animation: asa-glow-orbit 3.4s linear infinite;
  }

  .panel--active::after {
    opacity: 0.72;
    animation: asa-edge-breathe 2.4s ease-in-out infinite;
  }

  :global([data-theme='dark']) .panel--active {
    border-color: color-mix(in srgb, var(--color-accent, #00afa5), transparent 48%);
    box-shadow:
      0 14px 40px rgb(0 0 0 / 0.44),
      inset 0 1px 0 rgb(255 255 255 / 0.1),
      0 0 18px color-mix(in srgb, var(--color-accent, #00afa5), transparent 70%),
      0 0 38px rgb(91 166 255 / 0.14),
      0 0 52px rgb(165 139 255 / 0.1);
  }

  @keyframes asa-glow-orbit {
    to { --asa-glow-angle: 360deg; }
  }

  @keyframes asa-edge-breathe {
    0%, 100% { opacity: 0.44; }
    50% { opacity: 0.82; }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel--active::before,
    .panel--active::after {
      animation: none;
    }

    .panel--active::before {
      --asa-glow-angle: 105deg;
      opacity: 0.82;
    }

    .panel--active::after {
      opacity: 0.54;
    }
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 10px 27px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    user-select: none;
    background: color-mix(in srgb, var(--color-surface) 72%, var(--color-accent) 4%);
    cursor: grab;
    touch-action: none;
  }
  .panel--moving .panel-header { cursor: grabbing; }
  .panel-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: 0;
    pointer-events: none;
  }
  .panel-avatar-wrap {
    position: relative;
    flex-shrink: 0;
    display: inline-flex;
  }
  .panel-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: contain;
    background: var(--color-accent-subtle);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 55%);
  }
  .panel-avatar-dot {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--color-success, #22c55e);
    border: 2px solid var(--color-surface);
  }
  .panel-avatar-dot--active {
    background: var(--color-accent);
    animation: dot 1.1s ease-in-out infinite;
  }
  .panel-title-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.2;
  }
  .panel-name { font-weight: 700; }
  .panel-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 500;
    color: var(--color-text-muted);
  }
  .status-dots { display: inline-flex; gap: 2px; align-items: center; }
  .status-dots span {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--color-accent);
    animation: dot 1.1s ease-in-out infinite;
  }
  .status-dots span:nth-child(2) { animation-delay: 0.18s; }
  .status-dots span:nth-child(3) { animation-delay: 0.36s; }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    pointer-events: auto;
  }

  .budget-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10.5px;
    font-weight: 500;
    font-family: inherit;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 94%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 55%);
    border-radius: 999px;
    padding: 3px 9px;
    margin-right: 4px;
    white-space: nowrap;
  }
  .budget-pill--low { color: var(--color-warning, #f59e0b); border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.08); }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .icon-btn:hover {
    background: rgba(0,0,0,0.07);
    color: var(--color-text);
  }
  .icon-btn--active { background: var(--color-accent-subtle, #ecfcfb); color: var(--color-accent, #00afa5); }
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
  .voice-settings .voice-toggle { grid-column: 1 / -1; display: flex; align-items: center; gap: 7px; }
  .voice-settings input[type='checkbox'] { accent-color: var(--color-accent, #00afa5); }
  .voice-settings .voice-pick { grid-column: 1 / -1; }
  .voice-settings select {
    width: 100%;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #cbd5e1);
    background: var(--color-bg, #fff);
    color: var(--color-text, #0f172a);
    font-size: 11px;
    font-family: inherit;
  }

  .voice-diagnostics {
    padding: 9px 12px;
    border-bottom: 1px solid rgba(203,213,225,0.45);
    background: var(--color-surface, #fff);
    font-size: 11px;
  }
  .voice-diagnostics dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 0; }
  .voice-diagnostics dt { color: var(--color-text-muted, #64748b); font-weight: 500; }
  .voice-diagnostics dd { margin: 0; color: var(--color-text, #0f172a); text-align: right; overflow-wrap: anywhere; }
  .voice-diagnostics__empty { color: var(--color-text-muted, #64748b); }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 12px 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .history-status {
    align-self: center;
    padding: 3px 8px;
    color: var(--color-text-muted, #64748b);
    font-size: 10px;
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
    color: var(--color-text);
  }
  .empty-hint {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .msg {
    display: flex;
    gap: 7px;
    align-items: flex-end;
    min-width: 0;
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

  .msg-col {
    display: flex;
    flex-direction: column;
    max-width: 80%;
    min-width: 0;
  }
  .msg--user .msg-col { align-items: flex-end; }
  .msg--assistant .msg-col { align-items: flex-start; }

  .msg-bubble {
    padding: 9px 12px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    /* Flex item of .msg-col (column flex) - default min-width:auto lets it grow to an unwrapped
       child's (e.g. a wide markdown table) full content width instead of respecting max-width,
       which also breaks that child's own overflow-x:auto (nothing left to scroll within). */
    min-width: 0;
    max-width: 100%;
    /* Stay opaque + lifted so bubbles read clearly over the now-transparent panel. */
  }
  .msg--user .msg-bubble {
    /* Fixed to the light-theme accent pair (not var(--color-accent)) — dark theme's accent-hover
       is a bright mint (#5EF2D6) that white text can't read against. */
    background: linear-gradient(135deg, #00afa5, #008b84);
    color: #fff;
    border-bottom-right-radius: 4px;
    box-shadow: 0 3px 12px color-mix(in srgb, var(--color-accent), transparent 62%);
  }
  .msg--assistant .msg-bubble {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 10px rgb(15 23 42 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.4);
  }
  .msg-time {
    margin-top: 3px;
    padding: 0 3px;
    font-size: 9.5px;
    color: var(--color-text-muted);
    opacity: 0.8;
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
    color: var(--color-accent);
    text-decoration: none;
    border: 1px solid rgba(14,165,233,0.25);
    cursor: pointer;
    transition: background 0.1s;
  }
  .action-chip:hover { background: rgba(14,165,233,0.2); }
  .confirmation-card { display: grid; gap: 7px; width: 100%; }
  .confirmation-summary { font-size: 0.78rem; color: var(--color-text); }
  .confirmation-actions { display: flex; gap: 6px; }
  .action-chip--confirm { color: var(--color-danger, #dc2626); border-color: color-mix(in srgb, var(--color-danger, #dc2626), transparent 65%); }

  .transcript-review { display: flex; padding: 10px; }
  .transcript-review .input-shell { min-height: 44px; }
  .transcript-review .chat-input { resize: vertical; }

  /* Markdown-rendered assistant content (injected via {@html}, so selectors are :global). */
  .msg-streaming {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .msg-md { white-space: normal; }
  .msg-md :global(p) { margin: 0 0 6px; }
  .msg-md :global(p:last-child) { margin-bottom: 0; }
  .msg-md :global(ul), .msg-md :global(ol) { margin: 4px 0 6px; padding-left: 22px; list-style-position: outside; }
  .msg-md :global(ul) { list-style-type: disc; }
  .msg-md :global(ol) { list-style-type: decimal; }
  .msg-md :global(li) { margin: 3px 0; padding-left: 2px; }
  .msg-md :global(li::marker) { color: var(--color-accent); }
  .msg-md :global(ul ul) { list-style-type: circle; }
  .msg-md :global(ol ol) { list-style-type: lower-alpha; }
  .msg-md :global(a) { color: var(--color-accent); text-decoration: underline; }
  .msg-md :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    background: rgba(100,116,139,0.15);
    padding: 1px 4px;
    border-radius: 4px;
  }
  .msg-md :global(pre) {
    margin: 6px 0;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--color-bg-subtle, #0f172a0d);
    overflow-x: auto;
  }
  .msg-md :global(pre code) { background: none; padding: 0; font-size: 12px; line-height: 1.45; }
  .msg-md :global(h1), .msg-md :global(h2), .msg-md :global(h3) { font-size: 13px; font-weight: 600; margin: 6px 0 4px; }
  .msg-md :global(strong) { font-weight: 700; color: var(--color-text); }
  .msg-md :global(em) { font-style: italic; }
  .msg-md :global(hr) { border: none; border-top: 1px solid var(--color-border, #e2e8f0); margin: 8px 0; }
  /* Tables can be wider than the bubble - let them scroll instead of overflowing. */
  .msg-md :global(table) { border-collapse: collapse; margin: 6px 0; font-size: 12px; display: block; overflow-x: auto; max-width: 100%; }
  .msg-md :global(th), .msg-md :global(td) { border: 1px solid var(--color-border, #e2e8f0); padding: 3px 6px; white-space: nowrap; }
  .msg-md :global(th) { background: rgba(100,116,139,0.1); font-weight: 600; text-align: left; }
  .msg-md :global(blockquote) {
    margin: 4px 0;
    padding-left: 8px;
    border-left: 3px solid var(--color-border, #cbd5e1);
    color: var(--color-text-muted, #64748b);
  }

  /* Clarification question - a numbered list card, separate from the chat bubble (like an IDE's
     ask-the-user prompt), not another chat pill. Sits under msg-bubble, inside msg-col. */
  .msg-question-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
    padding: 6px;
    border-radius: 10px;
    background: var(--color-surface, rgba(100,116,139,0.06));
    border: 1px solid var(--color-border, #e2e8f0);
  }
  .msg-question-option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }
  .msg-question-option:hover:not(:disabled) { background: rgba(100,116,139,0.1); }
  .msg-question-option:disabled { cursor: default; }
  .msg-question-option:disabled:not(.msg-question-option--selected) { opacity: 0.45; }
  .msg-question-option--selected {
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border-color: var(--color-accent);
  }
  .msg-question-num {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    background: var(--color-bg, #fff);
    color: var(--color-accent);
    border: 1px solid var(--color-accent);
  }
  .msg-question-option--selected .msg-question-num {
    background: var(--color-accent);
    color: #fff;
  }
  .msg-question-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .msg-question-title { font-size: 12.5px; font-weight: 600; color: var(--color-text, #0f172a); }
  .msg-question-subtitle { font-size: 11.5px; color: var(--color-text-muted, #64748b); }

  /* Free-text fallback alongside the options - always available, not just "Other". */
  .msg-options-freetext { display: flex; gap: 6px; margin-top: 2px; padding: 0 2px; }
  .msg-option-input {
    flex: 1;
    min-width: 0;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: var(--color-bg, #fff);
    color: var(--color-text, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
  }
  .msg-option-input:disabled { opacity: 0.5; cursor: default; }
  .msg-option-send {
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    background: var(--color-accent);
    color: #fff;
    border: 1px solid var(--color-accent);
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .msg-option-send:disabled { opacity: 0.4; cursor: default; }

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
    align-items: flex-end;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid rgba(203,213,225,0.45);
    flex-shrink: 0;
  }
  :global([data-theme='dark']) .input-row { border-top-color: rgba(51,65,85,0.5); }

  .input-shell {
    flex: 1;
    display: flex;
    align-items: flex-end;
    min-width: 0;
    padding: 6px 6px 6px 14px;
    border-radius: 22px;
    border: 1px solid color-mix(in srgb, var(--color-border) 75%, white);
    background: var(--color-bg);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .input-shell:focus-within {
    border-color: color-mix(in srgb, var(--color-accent), transparent 20%);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 85%);
  }
  .input-shell--disabled { opacity: 0.7; }

  .interim-transcript {
    padding: 4px 12px 6px;
    font-size: 12.5px;
    font-style: italic;
    color: var(--color-text-muted, #64748b);
    border-top: 1px solid rgba(203,213,225,0.4);
    flex-shrink: 0;
    word-break: break-word;
  }

  .chat-input {
    flex: 1;
    min-width: 0;
    max-height: 140px;
    padding: 5px 2px;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.45;
    outline: none;
    font-family: inherit;
    resize: none;
    overflow-y: auto;
    /* Grows with content up to max-height via autoGrowInput(); rows="1" is just the collapsed size. */
  }
  .chat-input:disabled { opacity: 0.55; }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--color-accent, #0ea5e9);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 3px 10px color-mix(in srgb, var(--color-accent), transparent 55%);
    transition: background 0.12s, opacity 0.12s, transform 0.1s;
  }
  .send-btn:not(:disabled):hover { background: var(--color-accent-hover, #0284c7); transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.38; cursor: default; box-shadow: none; }
  .send-btn--stop { background: var(--color-danger, #ef4444); }
  .send-btn--stop:hover { background: var(--color-danger-dark, #dc2626); }
  .send-btn--secondary {
    background: color-mix(in srgb, var(--color-text-muted), transparent 88%);
    color: var(--color-text-muted);
    box-shadow: none;
  }
  .send-btn--secondary:hover {
    background: color-mix(in srgb, var(--color-danger, #ef4444), transparent 85%);
    color: var(--color-danger, #ef4444);
  }

  .voice-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .voice-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent), transparent 90%); }
  .voice-btn--active {
    color: var(--color-accent, #00afa5);
    background: var(--color-accent-subtle, #ecfcfb);
  }
  .voice-btn--error { color: var(--color-danger, #ef4444); }


  .voice-state {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px 7px;
    color: var(--color-text-muted, #64748b);
    font-size: 10px;
  }
  .voice-state--error { color: var(--color-danger); }
  .voice-state--notice { color: var(--color-accent, #00afa5); }
  .voice-level {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--color-accent, #00afa5);
    transform: scale(calc(0.8 + var(--voice-level) * 1.7));
  }
  .voice-level--rec {
    background: var(--color-danger, #ef4444);
    animation: rec-pulse 1s ease-in-out infinite;
  }
  @keyframes rec-pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.8); }
    50%      { opacity: 1;   transform: scale(1.3); }
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

  @media (max-width: 480px) {
    .panel-header { padding-left: 25px; }
    .budget-pill { display: none; }
    .voice-settings { grid-template-columns: 1fr; }
    .voice-settings .voice-toggle { grid-column: auto; }
  }
</style>

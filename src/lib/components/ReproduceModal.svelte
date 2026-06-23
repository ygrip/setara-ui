<script lang="ts">
  interface StepItem {
    num: number;
    keyword: string;
    name: string;
    failed: boolean;
    errorMessage?: string | null;
  }

  interface Props {
    scenarioName: string;
    steps: StepItem[];
    exceptionType?: string | null;
    exceptionMessage?: string | null;
    onclose: () => void;
  }

  let { scenarioName, steps, exceptionType, exceptionMessage, onclose }: Props = $props();

  let copied = $state(false);

  const failedIndex = $derived(steps.findIndex(s => s.failed));
  const visibleSteps = $derived(
    failedIndex >= 0 ? steps.slice(0, failedIndex + 1) : steps
  );
  const failedStep = $derived(failedIndex >= 0 ? steps[failedIndex] : null);

  function buildCopyText(): string {
    const lines: string[] = [];
    if (failedStep) {
      lines.push(`Failed at step ${failedStep.num}: ${scenarioName}`);
    } else {
      lines.push(`Failure details: ${scenarioName}`);
    }
    lines.push('');
    for (const s of visibleSteps) {
      lines.push(`${s.num}. [${s.keyword.trim()}] ${s.name}`);
    }
    const err = failedStep?.errorMessage;
    if (err) {
      lines.push('');
      lines.push('Error:');
      lines.push(err);
    }
    if (exceptionType || exceptionMessage) {
      lines.push('');
      if (exceptionType) lines.push(`Exception: ${exceptionType}`);
      if (exceptionMessage) lines.push(exceptionMessage);
    }
    return lines.join('\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // ignore
    }
  }

  function keywordClass(kw: string): string {
    switch (kw?.toLowerCase().trim()) {
      case 'given': return 'kw-given';
      case 'when':  return 'kw-when';
      case 'then':  return 'kw-then';
      case 'and':
      case 'but':   return 'kw-and';
      default:      return 'kw-other';
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onclose}></div>

<div class="modal" role="dialog" aria-label="How to Reproduce" aria-modal="true">
  <div class="modal-header">
    <div class="modal-header-left">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span class="modal-title">How to Reproduce</span>
    </div>
    <div class="modal-actions">
      <button class="copy-btn" class:copy-btn--done={copied} onclick={copy} title="Copy to clipboard">
        {#if copied}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy
        {/if}
      </button>
      <button class="close-btn" onclick={onclose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="modal-body">
    <p class="scenario-name">{scenarioName}</p>

    {#if failedStep}
      <p class="failed-at">
        Failed at step <strong>{failedStep.num}</strong>
        {#if visibleSteps.length > 1}— steps leading up to failure:
        {/if}
      </p>
    {/if}

    <ol class="step-list">
      {#each visibleSteps as s}
        <li class="step-item" class:step-item--failed={s.failed}>
          <span class="step-num">{s.num}</span>
          <span class="step-kw {keywordClass(s.keyword)}">{s.keyword.trim()}</span>
          <span class="step-name">{s.name}</span>
          {#if s.failed}
            <span class="step-badge">FAILED</span>
          {/if}
        </li>
        {#if s.failed && s.errorMessage}
          <li class="step-error" aria-label="Error message">
            <pre class="step-error-pre">{s.errorMessage}</pre>
          </li>
        {/if}
      {/each}
    </ol>

    {#if exceptionType || exceptionMessage}
      <div class="exception-block">
        {#if exceptionType}
          <span class="exception-type">{exceptionType}</span>
        {/if}
        {#if exceptionMessage}
          <pre class="exception-msg">{exceptionMessage}</pre>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 400;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 401;
    width: min(640px, 92vw);
    max-height: 80vh;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: popIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes popIn {
    from { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
    to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-danger), transparent 93%);
    flex-shrink: 0;
  }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-danger);
  }

  .modal-title {
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-danger);
  }

  .modal-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
  }

  .copy-btn--done {
    border-color: var(--color-success, #0d9488);
    color: var(--color-success, #0d9488);
    background: color-mix(in srgb, var(--color-success, #0d9488), transparent 90%);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .scenario-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;
  }

  .failed-at {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .failed-at strong {
    color: var(--color-danger);
    font-weight: 700;
  }

  .step-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .step-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
  }

  .step-item--failed {
    background: color-mix(in srgb, var(--color-danger), transparent 93%);
    border-color: color-mix(in srgb, var(--color-danger), transparent 55%);
    border-left: 3px solid var(--color-danger);
  }

  .step-num {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--color-text-muted);
    min-width: 18px;
    font-family: ui-monospace, monospace;
    flex-shrink: 0;
  }

  .step-kw {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .kw-given  { color: #818cf8; }
  .kw-when   { color: #fbbf24; }
  .kw-then   { color: #34d399; }
  .kw-and    { color: #94a3b8; }
  .kw-other  { color: #94a3b8; }

  .step-name {
    font-size: 0.86rem;
    font-weight: 500;
    color: var(--color-text);
    flex: 1;
    line-height: 1.4;
  }

  .step-badge {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger), transparent 85%);
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .step-error {
    list-style: none;
    padding: 0 0 0 20px;
  }

  .step-error-pre {
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger), transparent 93%);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%);
    border-radius: 5px;
    padding: 8px 12px;
  }

  .exception-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: color-mix(in srgb, var(--color-danger), transparent 93%);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 65%);
    border-radius: 6px;
  }

  .exception-type {
    font-family: ui-monospace, monospace;
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--color-danger);
  }

  .exception-msg {
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
    color: var(--color-text);
  }
</style>

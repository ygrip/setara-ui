<script lang="ts">
  import { getScenario, type Scenario } from '$lib/api/testcases';
  import type { ScenarioRunResult } from '$lib/api/runs';
  import Badge from './Badge.svelte';

  interface Props {
    result: ScenarioRunResult | null;
    projectKey: string;
    onclose: () => void;
  }

  let { result, projectKey, onclose }: Props = $props();

  let scenario = $state<Scenario | null>(null);
  let scenarioLoading = $state(false);
  let scenarioError = $state<string | null>(null);

  $effect(() => {
    const sid = result?.scenarioId ?? null;
    if (!sid) { scenario = null; return; }
    scenarioLoading = true;
    scenarioError = null;
    getScenario(projectKey, sid)
      .then(s => { scenario = s; })
      .catch(e => { scenarioError = (e as Error).message; scenario = null; })
      .finally(() => { scenarioLoading = false; });
  });

  function statusVariant(s: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (s?.toUpperCase()) {
      case 'PASSED':  return 'success';
      case 'FAILED':  return 'danger';
      case 'SKIPPED': return 'warning';
      case 'PENDING': return 'info';
      default:        return 'neutral';
    }
  }

  function fmt(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function durationMs(ms: number | null): string {
    if (ms == null) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function keywordVariant(kw: string): string {
    switch (kw?.toLowerCase()) {
      case 'given': return 'kw-given';
      case 'when':  return 'kw-when';
      case 'then':  return 'kw-then';
      case 'and':
      case 'but':   return 'kw-and';
      default:      return 'kw-other';
    }
  }
</script>

<!-- Overlay backdrop -->
{#if result}
  <div class="overlay" role="presentation" onclick={onclose} onkeydown={() => {}}></div>

  <div class="panel" role="dialog" aria-label="Scenario result detail" aria-modal="true">

    <!-- Panel header -->
    <div class="panel-header">
      <div class="panel-header-left">
        <Badge text={result.status} variant={statusVariant(result.status)} />
        <span class="panel-title">{result.scenarioName}</span>
      </div>
      <button class="close-btn" onclick={onclose} aria-label="Close detail panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="panel-body">

      <!-- Meta grid -->
      <div class="meta-grid">
        {#if result.featureName}
          <div class="meta-item">
            <span class="meta-label">Feature</span>
            <span class="meta-value">{result.featureName}</span>
          </div>
        {/if}
        {#if result.featureUri}
          <div class="meta-item">
            <span class="meta-label">Feature file</span>
            <span class="meta-value mono small">{result.featureUri}</span>
          </div>
        {/if}
        {#if result.cucumberId}
          <div class="meta-item">
            <span class="meta-label">Cucumber ID</span>
            <span class="meta-value mono small">{result.cucumberId}</span>
          </div>
        {/if}
        {#if result.scenarioLine}
          <div class="meta-item">
            <span class="meta-label">Line</span>
            <span class="meta-value mono">{result.scenarioLine}</span>
          </div>
        {/if}
        <div class="meta-item">
          <span class="meta-label">Duration</span>
          <span class="meta-value">{durationMs(result.durationMs)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Started</span>
          <span class="meta-value">{fmt(result.startedAt)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Finished</span>
          <span class="meta-value">{fmt(result.finishedAt)}</span>
        </div>
      </div>

      <!-- Tags -->
      {#if result.tags && result.tags.length > 0}
        <div class="tags-row">
          {#each result.tags as tag}
            <span class="tag-chip">@{tag}</span>
          {/each}
        </div>
      {/if}

      <!-- Exception -->
      {#if result.exceptionType || result.exceptionMessage}
        <div class="exception-block">
          <div class="exception-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/>
            </svg>
            <span class="exception-type">{result.exceptionType ?? 'Error'}</span>
          </div>
          {#if result.exceptionMessage}
            <pre class="exception-message">{result.exceptionMessage}</pre>
          {/if}
        </div>
      {/if}

      <!-- Scenario steps -->
      <div class="steps-section">
        <h3 class="steps-title">
          Steps
          {#if scenario}
            <span class="steps-count">{scenario.steps.length}</span>
          {/if}
        </h3>

        {#if scenarioLoading}
          <div class="steps-loading">Loading steps…</div>
        {:else if scenarioError}
          <div class="steps-error">Could not load steps — {scenarioError}</div>
        {:else if scenario && scenario.steps.length > 0}
          <ol class="steps-list">
            {#each scenario.steps as step}
              <li class="step-row">
                <span class="step-num">{step.sequenceNo}</span>
                <span class="step-keyword {keywordVariant(step.keyword)}">{step.keyword}</span>
                <span class="step-name">{step.name}</span>
                {#if step.description}
                  <span class="step-desc">{step.description}</span>
                {/if}
              </li>
            {/each}
          </ol>
        {:else if scenario && scenario.steps.length === 0}
          <p class="steps-empty">No steps defined for this scenario.</p>
        {:else if !result.scenarioId}
          <p class="steps-empty">Steps not available — this result was not linked to a tracked scenario.</p>
        {/if}
      </div>

      <!-- Link to repository scenario -->
      {#if scenario}
        <div class="footer-links">
          <a
            href="/projects/{projectKey}/repository?scenario={scenario.id}"
            class="footer-link"
          >
            Open in Repository →
          </a>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 200;
    backdrop-filter: blur(1px);
  }

  [role="dialog"] {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(520px, 100vw);
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    z-index: 201;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);   opacity: 1; }
  }

  /* ── Header ────────────────────────────────────────────────── */
  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-shrink: 0;
  }

  .panel-header-left {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .panel-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.4;
    word-break: break-word;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover { background: var(--color-border); color: var(--color-text); }

  /* ── Body ──────────────────────────────────────────────────── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Meta ──────────────────────────────────────────────────── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .meta-value {
    font-size: 0.82rem;
    color: var(--color-text);
    font-weight: 500;
    word-break: break-all;
  }
  .meta-value.mono { font-family: ui-monospace, monospace; }
  .meta-value.small { font-size: 0.75rem; }

  /* ── Tags ──────────────────────────────────────────────────── */
  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    font-size: 0.72rem;
    font-family: ui-monospace, monospace;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%);
    border-radius: 4px;
    padding: 2px 7px;
  }

  /* ── Exception ─────────────────────────────────────────────── */
  .exception-block {
    background: color-mix(in srgb, var(--color-danger), transparent 92%);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%);
    border-radius: var(--radius);
    padding: 14px;
  }

  .exception-header {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--color-danger);
    margin-bottom: 8px;
  }

  .exception-type {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .exception-message {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: var(--color-text);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.6;
  }

  /* ── Steps ─────────────────────────────────────────────────── */
  .steps-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .steps-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .steps-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    border-radius: 9px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: 0.7rem;
    padding: 0 6px;
    font-weight: 700;
  }

  .steps-loading,
  .steps-error,
  .steps-empty {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .steps-error { color: var(--color-danger); font-style: normal; }

  .steps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .step-row {
    display: grid;
    grid-template-columns: 22px 50px 1fr;
    gap: 8px;
    align-items: baseline;
    padding: 7px 10px;
    border-radius: 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .step-num {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
    text-align: right;
    padding-top: 1px;
  }

  .step-keyword {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 3px;
    padding: 1px 4px;
    text-align: center;
  }

  .kw-given  { background: color-mix(in srgb, #6366f1, transparent 82%); color: #818cf8; }
  .kw-when   { background: color-mix(in srgb, #f59e0b, transparent 82%); color: #fbbf24; }
  .kw-then   { background: color-mix(in srgb, #10b981, transparent 82%); color: #34d399; }
  .kw-and    { background: color-mix(in srgb, #64748b, transparent 82%); color: #94a3b8; }
  .kw-other  { background: color-mix(in srgb, #64748b, transparent 82%); color: #94a3b8; }

  .step-name {
    color: var(--color-text);
  }

  .step-desc {
    grid-column: 3;
    font-size: 0.73rem;
    color: var(--color-text-muted);
    font-style: italic;
    margin-top: 2px;
  }

  /* ── Footer links ──────────────────────────────────────────── */
  .footer-links {
    padding-top: 4px;
    border-top: 1px solid var(--color-border);
  }

  .footer-link {
    font-size: 0.8rem;
    color: var(--color-accent);
    font-weight: 500;
  }
</style>

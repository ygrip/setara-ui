<script lang="ts">
  import { getScenario, type Scenario } from '$lib/api/testcases';
  import type { ScenarioRunResult } from '$lib/api/runs';
  import Badge from './Badge.svelte';
  import SetaraLoader from './SetaraLoader.svelte';
  import MarkdownBlock from './MarkdownBlock.svelte';
  import ReproduceModal from './ReproduceModal.svelte';
  import { lockBodyScroll } from '$lib/scroll-lock';

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
    if (!result) return;
    return lockBodyScroll();
  });

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

  function stepRunResult(stepName: string): import('$lib/api/runs').StepRunResult | null {
    if (!result?.stepsJson) return null;
    return result.stepsJson.find(s => s.name === stepName) ?? null;
  }

  function stepRunStatus(stepName: string): string | null {
    return stepRunResult(stepName)?.status?.toUpperCase() ?? null;
  }

  function stepRunErrorMessage(stepName: string): string | null {
    return stepRunResult(stepName)?.errorMessage ?? null;
  }

  function stepRunDuration(stepName: string): string | null {
    const ms = stepRunResult(stepName)?.durationMs;
    if (ms == null) return null;
    if (ms < 1000) return `${ms}ms`;
    const s = (ms / 1000).toFixed(1);
    return `${s}s`;
  }

  const failedStepNames = $derived(
    result?.stepsJson?.filter(s => s.status?.toUpperCase() === 'FAILED') ?? []
  );

  let showReproduceModal = $state(false);

  function buildReproduceSteps() {
    if (!scenario) return [];
    return scenario.steps.map(s => {
      const r = stepRunResult(s.name);
      return {
        num: s.sequenceNo,
        keyword: s.keyword,
        name: s.name,
        failed: r?.status?.toUpperCase() === 'FAILED',
        errorMessage: r?.errorMessage ?? null
      };
    });
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
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

      <!-- Failure: How to Reproduce button -->
      {#if result.status?.toUpperCase() === 'FAILED' && (failedStepNames.length > 0 || result.exceptionType || result.exceptionMessage)}
        <button class="reproduce-trigger" onclick={() => { showReproduceModal = true; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          How to Reproduce
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="trigger-arrow">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
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
          <div class="steps-loading">
            <SetaraLoader mode="progress" size={36} label="Loading steps" />
            <span>Loading steps…</span>
          </div>
        {:else if scenarioError}
          <div class="steps-error">Could not load steps — {scenarioError}</div>
        {:else if scenario && scenario.steps.length > 0}
          <ol class="steps-list">
            {#each scenario.steps as step}
              {@const runStatus = stepRunStatus(step.name)}
              {@const isFailed = runStatus === 'FAILED'}
              {@const isPassed = runStatus === 'PASSED'}
              {@const isSkipped = runStatus === 'SKIPPED'}
              {@const stepError = stepRunErrorMessage(step.name)}
              {@const stepDur = stepRunDuration(step.name)}
              <li class="step-card" class:step-card--failed={isFailed} class:step-card--passed={isPassed} class:step-card--skipped={isSkipped}>
                <div class="step-card-header">
                  <span class="step-num">{step.sequenceNo}</span>
                  <span class="step-kw {keywordVariant(step.keyword)}">{step.keyword}</span>
                  {#if stepDur}
                    <span class="step-duration">{stepDur}</span>
                  {/if}
                  {#if runStatus}
                    <span class="step-run-status step-run-status--{runStatus.toLowerCase()}">{runStatus}</span>
                  {/if}
                </div>
                <div class="step-card-body">
                  <span class="step-text">{step.name}</span>
                  {#if isFailed && stepError}
                    <div class="step-error-msg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
                      <pre class="step-error-pre">{stepError}</pre>
                    </div>
                  {/if}
                  {#if step.description}
                    <div class="step-section">
                      <span class="step-section-label">Description</span>
                      <MarkdownBlock value={step.description} collapsedHeight={120} />
                    </div>
                  {/if}
                  {#if step.expectation}
                    <div class="step-section step-section--expectation">
                      <span class="step-section-label">Expectation</span>
                      <MarkdownBlock value={step.expectation} collapsedHeight={120} />
                    </div>
                  {/if}
                </div>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in Repository
          </a>
        </div>
      {/if}

    </div>
  </div>

  {#if showReproduceModal && result}
    <ReproduceModal
      scenarioName={result.scenarioName}
      steps={buildReproduceSteps()}
      exceptionType={result.exceptionType}
      exceptionMessage={result.exceptionMessage}
      onclose={() => { showReproduceModal = false; }}
    />
  {/if}
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 200;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  :global([data-theme="dark"]) .overlay {
    background: rgba(0, 0, 0, 0.5);
  }

  [role="dialog"] {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(720px, 100vw);
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
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .close-btn:hover {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: scale(1.05);
  }

  :global([data-theme="dark"]) .close-btn {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.12);
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  }
  :global([data-theme="dark"]) .close-btn:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.25);
    color: #fff;
  }

  /* ── Body ──────────────────────────────────────────────────── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    min-height: 0;
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

  /* ── Reproduce trigger ─────────────────────────────────────── */
  .reproduce-trigger {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 9px 14px;
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 55%);
    background: color-mix(in srgb, var(--color-danger), transparent 92%);
    color: var(--color-danger);
    cursor: pointer;
    transition: all 0.15s;
    align-self: flex-start;
  }

  .reproduce-trigger:hover {
    background: color-mix(in srgb, var(--color-danger), transparent 84%);
    border-color: color-mix(in srgb, var(--color-danger), transparent 35%);
  }

  .trigger-arrow {
    margin-left: auto;
    opacity: 0.6;
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

  .steps-loading {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .steps-error { color: var(--color-danger); font-style: normal; }

  .steps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .step-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg);
  }

  .step-card--failed {
    border-color: color-mix(in srgb, var(--color-danger), transparent 55%);
    background: color-mix(in srgb, var(--color-danger), transparent 96%);
  }

  .step-card--passed {
    border-color: color-mix(in srgb, var(--color-success, #0d9488), transparent 65%);
  }

  .step-card--skipped {
    opacity: 0.6;
  }

  .step-duration {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    font-family: ui-monospace, monospace;
    margin-left: auto;
  }

  .step-duration + .step-run-status {
    margin-left: 6px;
  }

  .step-run-status {
    margin-left: auto;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .step-run-status--passed  { color: var(--color-success, #0d9488); background: color-mix(in srgb, var(--color-success, #0d9488), transparent 88%); }
  .step-run-status--failed  { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger), transparent 88%); }
  .step-run-status--skipped { color: var(--color-text-muted); background: var(--color-surface); }
  .step-run-status--pending { color: var(--color-warning, #f59e0b); background: color-mix(in srgb, var(--color-warning, #f59e0b), transparent 88%); }

  .step-error-msg {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: var(--color-danger);
    padding: 8px 10px;
    background: color-mix(in srgb, var(--color-danger), transparent 92%);
    border-radius: 5px;
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 75%);
  }

  .step-error-msg svg { flex-shrink: 0; margin-top: 2px; }

  .step-error-pre {
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
    color: var(--color-text);
  }

  .step-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: color-mix(in srgb, var(--color-surface), transparent 30%);
    border-bottom: 1px solid var(--color-border);
  }

  .step-num {
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--color-text-muted);
    min-width: 20px;
    font-family: ui-monospace, monospace;
  }

  .step-kw {
    font-size: 0.73rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .kw-given  { color: #818cf8; }
  .kw-when   { color: #fbbf24; }
  .kw-then   { color: #34d399; }
  .kw-and    { color: #94a3b8; }
  .kw-other  { color: #94a3b8; }

  .step-card-body {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.4;
  }

  .step-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-left: 2px solid var(--color-border);
    padding-left: 10px;
  }

  .step-section--expectation {
    border-left-color: var(--color-success, #0d9488);
  }

  .step-section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  /* ── Footer links ──────────────────────────────────────────── */
  .footer-links {
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .footer-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #fff;
    background: var(--color-accent);
    padding: 9px 16px;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
  }
  .footer-link:hover {
    background: color-mix(in srgb, var(--color-accent), black 12%);
    transform: translateY(-1px);
  }
  .footer-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>

<script lang="ts">
  import AiThinkingPanel from './AiThinkingPanel.svelte';
  import MarkdownBlock from './MarkdownBlock.svelte';
  import { getApiBaseUrl } from '$lib/api/config';
  import { authHeaders } from '$lib/api/client';
  import { normalizeErrorMessage, readApiError } from '$lib/api/errors';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let {
    reviewUrl,
    label = 'this resource'
  }: {
    reviewUrl: string;
    label?: string;
  } = $props();

  interface AiReviewFinding {
    type: 'RISK' | 'COVERAGE' | 'QUALITY' | 'INFO';
    severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    title: string;
    detail: string;
    confidence?: number | null;
    reasoning_evidence?: string | null;
    related_requirement?: string | null;
  }

  interface AiReviewResult {
    findings: AiReviewFinding[];
    summary: string | null;
    recommendation: string | null;
    message: string | null;
    generatedAt?: string | null;
    provider?: string | null;
    model?: string | null;
    reviewType?: string | null;
  }

  let loading = $state(false);
  let streaming = $state(false);
  let streamingTokens = $state('');
  let result = $state<AiReviewResult | null>(null);
  let error = $state('');

  const reviewSteps = [
    'Reading context',
    'Analyzing coverage',
    'Identifying risks',
    'Preparing insights'
  ];

  const aiReviewUnavailableMessage = 'AI review is unavailable right now. Check the Intelligence configuration and try again.';
  const aiReviewEmptyMessage = 'No review was generated. The AI model may not have enough context or the review feature may not be properly configured. Try again or contact your administrator.';

  function apiReviewUrl(): string {
    if (/^https?:\/\//i.test(reviewUrl)) return reviewUrl;
    return `${getApiBaseUrl().replace(/\/$/, '')}${reviewUrl.startsWith('/') ? reviewUrl : `/${reviewUrl}`}`;
  }

  async function requestReview() {
    loading = true;
    streaming = false;
    streamingTokens = '';
    error = '';
    result = null;

    try {
      const res = await fetch(apiReviewUrl(), { method: 'POST', headers: authHeaders() });

      if (!res.ok) {
        const errMsg = await readApiError(res, aiReviewUnavailableMessage);
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error(aiReviewUnavailableMessage);

      const decoder = new TextDecoder();
      let buffer = '';
      let doneReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5);

          if (payload.startsWith('[TOOL:')) continue;

          if (payload === '[DONE]') {
            doneReceived = true;
            continue;
          }

          if (doneReceived) {
            try {
              const parsed = JSON.parse(payload.trim()) as AiReviewResult;
              if (parsed.message && !parsed.summary && !parsed.findings?.length) {
                error = parsed.message;
              } else if (!parsed.summary && (!parsed.findings || parsed.findings.length === 0)) {
                error = aiReviewEmptyMessage;
              } else {
                result = parsed;
              }
            } catch {
              error = aiReviewUnavailableMessage;
            }
            streaming = false;
            loading = false;
            continue;
          }

          if (loading) {
            loading = false;
            streaming = true;
          }

          // Sanitize: strip any accidental "data:" prefix in stream content
          let cleanPayload = payload;
          if (cleanPayload.startsWith('data:')) cleanPayload = cleanPayload.slice(5);
          streamingTokens += cleanPayload;
        }
      }

      if (loading || streaming) {
        loading = false;
        streaming = false;
        if (!result && !error) error = aiReviewUnavailableMessage;
      }
    } catch (e: any) {
      error = normalizeErrorMessage(e, aiReviewUnavailableMessage);
      loading = false;
      streaming = false;
    }
  }

  function severityClass(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'finding--high';
      case 'MEDIUM': return 'finding--medium';
      case 'LOW': return 'finding--low';
      default: return 'finding--info';
    }
  }

  function severityBadge(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'badge--danger';
      case 'MEDIUM': return 'badge--warning';
      case 'LOW': return 'badge--accent';
      default: return 'badge--muted';
    }
  }

  function typeLabel(type: string): string {
    switch (type) {
      case 'RISK': return 'Risk';
      case 'COVERAGE': return 'Coverage';
      case 'QUALITY': return 'Quality';
      default: return 'Info';
    }
  }

  function typeIcon(type: string): string {
    switch (type) {
      case 'RISK': return '⚠';
      case 'COVERAGE': return '⊡';
      case 'QUALITY': return '✓';
      default: return 'ℹ';
    }
  }

  function formattedDate(iso?: string | null): string {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }
</script>

{#if loading}
  <div class="review-root">
    <AiThinkingPanel
      title="AI is reviewing"
      subtitle="Analyzing {label} and preparing a review."
      hint="This may take a moment depending on model load."
      steps={reviewSteps}
    />
  </div>
{:else if streaming}
  <div class="review-root review-streaming">
    <div class="stream-card">
      <div class="stream-card-header">
        <div class="stream-card-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <span class="stream-card-label">AI Reasoning</span>
        <span class="live-badge">live</span>
      </div>
      <div class="stream-card-divider"></div>
      {#if streamingTokens}
        <div class="stream-text-wrap">
          <p class="stream-text">{streamingTokens}<span class="cursor" aria-hidden="true"></span></p>
        </div>
      {/if}
    </div>
  </div>
{:else if result}
  <div class="review-root review-done">
    <div class="done-header">
      <div class="done-header-left">
        <span class="done-eyebrow">AI Review</span>
        {#if result.reviewType}
          <span class="done-type-badge">{result.reviewType}</span>
        {/if}
      </div>
      <button class="rerun-btn" onclick={requestReview} title="Re-run review">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Re-run
      </button>
    </div>

    {#if result.summary}
      <div class="bento-summary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div class="bento-summary-text">
          <MarkdownBlock value={result.summary} collapsedHeight={0} />
        </div>
      </div>
    {/if}

    {#if result.findings?.length}
      <div class="bento-grid">
        {#each result.findings as finding}
          <div class="bento-finding {severityClass(finding.severity)}">
            <div class="bento-finding-top">
              <span class="bento-finding-icon">{typeIcon(finding.type)}</span>
              <span class="bento-finding-type">{typeLabel(finding.type)}</span>
              <span class="bento-finding-severity badge {severityBadge(finding.severity)}">{finding.severity}</span>
              {#if finding.confidence != null}
                <span class="conf-badge" title="AI confidence: {Math.round(finding.confidence * 100)}%">
                  {Math.round(finding.confidence * 100)}%
                </span>
              {/if}
            </div>
            <strong class="bento-finding-title">{finding.title}</strong>
            <p class="bento-finding-detail">{finding.detail}</p>
            {#if finding.reasoning_evidence}
              <details class="finding-evidence">
                <summary>Evidence &amp; reasoning</summary>
                <p>{finding.reasoning_evidence}</p>
              </details>
            {/if}
            {#if finding.related_requirement}
              <span class="finding-requirement">📋 {finding.related_requirement}</span>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="no-findings">No issues found.</p>
    {/if}

    {#if result.recommendation}
      <div class="bento-rec">
        <div class="bento-rec-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span class="rec-label">Recommendation</span>
        </div>
        <p>{result.recommendation}</p>
      </div>
    {/if}

    {#if result.message}
      <p class="review-note">{result.message}</p>
    {/if}

    {#if result.model || result.generatedAt}
      <div class="done-footer">
        <span>{result.model}{result.provider ? ` · ${result.provider}` : ''}</span>
        {#if result.generatedAt}<span> · {formattedDate(result.generatedAt)}</span>{/if}

      </div>
    {/if}
  </div>
{:else}
  <div class="review-idle">
    {#if error}
      <AppAlert tone="error" title="AI review unavailable">{error}</AppAlert>
    {/if}
    <button class="request-btn" onclick={requestReview}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v4l3 3"/></svg>
      Request AI Review
    </button>
    <p class="idle-caption">AI-generated analysis — always verify before acting on results.</p>
  </div>
{/if}

<style>
  .review-root { max-width: 100%; }

  /* ── Streaming card ─────────────────────────── */
  .review-streaming {
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 55%);
    background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent), transparent 96%), color-mix(in srgb, var(--color-accent), transparent 98%));
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px color-mix(in srgb, var(--color-accent), transparent 90%);
    animation: reasoning-glow 2.4s ease-in-out infinite;
  }
  @keyframes reasoning-glow {
    0%, 100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 85%); }
    50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent), transparent 70%); }
  }
  .stream-card { padding: 16px 18px 18px 18px; }
  .stream-card-header { display: flex; align-items: center; gap: 8px; }
  .stream-card-icon {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 8px;
    background: color-mix(in srgb, var(--color-accent), transparent 85%);
    color: var(--color-accent); flex-shrink: 0;
  }
  .stream-card-label {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--color-accent);
  }
  .stream-card-divider {
    height: 1px; margin: 10px 0 12px 0;
    background: linear-gradient(to right,
      color-mix(in srgb, var(--color-accent), transparent 60%),
      color-mix(in srgb, var(--color-accent), transparent 88%) 60%, transparent);
  }
  .live-badge {
    background: var(--color-accent); color: #fff;
    font-size: 0.6rem; font-weight: 700; padding: 2px 7px;
    border-radius: 10px; letter-spacing: 0.04em;
    animation: fade-in-out 1.5s infinite;
  }
  @keyframes fade-in-out { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .stream-text-wrap { max-height: 260px; overflow-y: auto; position: relative; }
  .stream-text-wrap::before {
    content: ''; position: sticky; top: 0; left: 0; right: 0; height: 28px;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--color-accent), transparent 96%), transparent);
    pointer-events: none; z-index: 1;
  }
  .stream-text {
    margin: 0; font-size: 0.85rem; line-height: 1.65;
    color: var(--color-text); white-space: pre-wrap; word-break: break-word;
  }
  .cursor {
    display: inline-block; width: 2px; height: 0.9em;
    background: var(--color-accent); margin-left: 1px;
    vertical-align: text-bottom; animation: blink 1s step-end infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  /* ── Done: bento layout ────────────────────── */
  .review-done {
    border: 1px solid var(--color-border); border-radius: 14px;
    background: var(--color-surface); padding: 22px 24px; box-shadow: var(--shadow-sm);
  }
  .done-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .done-header-left { display: flex; align-items: center; gap: 8px; }
  .done-eyebrow {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--color-accent);
  }
  .done-type-badge {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase; padding: 1px 7px;
    border-radius: 6px; background: color-mix(in srgb, var(--color-accent), transparent 86%);
    color: var(--color-accent); letter-spacing: 0.04em;
  }
  .rerun-btn {
    display: inline-flex; align-items: center; gap: 5px; background: none;
    border: 1px solid var(--color-border); border-radius: 8px;
    color: var(--color-text-muted); font: inherit; font-size: 0.76rem;
    cursor: pointer; padding: 4px 10px; transition: color 0.15s, border-color 0.15s;
  }
  .rerun-btn:hover { color: var(--color-text); border-color: var(--color-accent); }

  .bento-summary {
    display: flex; gap: 10px; padding: 14px 16px;
    background: color-mix(in srgb, var(--color-accent), transparent 94%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 75%);
    border-radius: 10px; margin-bottom: 14px; color: var(--color-text); line-height: 1.6;
  }
  .bento-summary svg { flex-shrink: 0; margin-top: 2px; color: var(--color-accent); }
  .bento-summary-text { font-size: 0.88rem; min-width: 0; }
  .bento-summary-text :global(p) { margin: 0; }
  .bento-summary-text :global(strong) { color: color-mix(in srgb, var(--color-text), var(--color-accent) 30%); }

  .bento-grid { display: grid; gap: 8px; margin-bottom: 14px; }
  .bento-finding {
    padding: 14px 16px; border-radius: 10px; border-left: 4px solid;
    background: var(--color-bg); transition: box-shadow 0.15s;
  }
  .bento-finding:hover { box-shadow: 0 1px 6px color-mix(in srgb, var(--color-accent), transparent 88%); }
  .finding--high  { border-color: var(--color-danger, #dc2626); background: color-mix(in srgb, var(--color-danger, #dc2626), transparent 96%); }
  .finding--medium{ border-color: var(--color-warning, #d97706); background: color-mix(in srgb, var(--color-warning, #d97706), transparent 96%); }
  .finding--low   { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 96%); }
  .finding--info  { border-color: var(--color-border); }

  .bento-finding-top { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
  .bento-finding-icon { font-size: 0.85rem; }
  .bento-finding-type {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-text-muted);
  }
  .badge {
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    padding: 2px 7px; border-radius: 6px; letter-spacing: 0.04em;
  }
  .badge--danger  { background: color-mix(in srgb, var(--color-danger, #dc2626), transparent 85%); color: var(--color-danger, #dc2626); }
  .badge--warning { background: color-mix(in srgb, var(--color-warning, #d97706), transparent 85%); color: var(--color-warning, #d97706); }
  .badge--accent  { background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); }
  .badge--muted   { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .conf-badge {
    font-size: 0.6rem; font-weight: 700; padding: 2px 7px; border-radius: 6px;
    background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); cursor: help;
  }
  .bento-finding-title { display: block; font-size: 0.88rem; font-weight: 650; margin-bottom: 4px; color: var(--color-text); line-height: 1.4; }
  .bento-finding-detail { margin: 0; font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.55; }
  .finding-evidence { margin-top: 8px; font-size: 0.76rem; color: var(--color-text-muted); }
  .finding-evidence summary { cursor: pointer; font-weight: 600; font-size: 0.73rem; color: var(--color-accent); user-select: none; }
  .finding-evidence summary:hover { text-decoration: underline; }
  .finding-evidence p { margin: 6px 0 0; line-height: 1.5; padding-left: 8px; border-left: 2px solid var(--color-border); }
  .finding-requirement {
    display: inline-block; margin-top: 6px; font-size: 0.7rem; font-weight: 600;
    color: var(--color-text-muted); background: var(--color-surface);
    padding: 2px 8px; border-radius: 6px; border: 1px solid var(--color-border);
  }
  .no-findings { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 14px; }

  .bento-rec {
    background: color-mix(in srgb, var(--color-accent), transparent 93%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%);
    border-radius: 10px; padding: 13px 16px; margin-bottom: 10px;
  }
  .bento-rec-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: var(--color-accent); }
  .rec-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .bento-rec p { margin: 0; font-size: 0.85rem; line-height: 1.55; color: var(--color-text); }
  .review-note { margin: 10px 0 0; font-size: 0.76rem; color: var(--color-text-muted); font-style: italic; }
  .done-footer {
    margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--color-border);
    font-size: 0.68rem; color: var(--color-text-muted); opacity: 0.6;
    display: flex; flex-wrap: wrap; gap: 2px;
  }

  /* ── Idle ─────────────────────────────────── */
  .review-idle { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .request-btn {
    display: inline-flex; align-items: center; gap: 7px; background: none;
    border: 1px solid var(--color-border); border-radius: var(--radius);
    color: var(--color-accent); font: inherit; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; padding: 8px 16px; transition: background 0.15s, border-color 0.15s;
  }
  .request-btn:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); border-color: var(--color-accent); }
  .idle-caption { margin: 0; font-size: 0.75rem; color: var(--color-text-muted); }

  @media (max-width: 640px) {
    .review-done { padding: 14px; }
    .bento-finding { padding: 12px 13px; }
    .bento-finding-top { gap: 4px; }
    .bento-finding-title { font-size: 0.82rem; }
    .bento-finding-detail { font-size: 0.78rem; }
    .stream-text-wrap { max-height: 180px; }
    .stream-text { font-size: 0.78rem; }
    .tool-events { flex-wrap: wrap; }
  }
</style>

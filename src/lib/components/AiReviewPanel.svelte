<script lang="ts">
  import AiThinkingPanel from './AiThinkingPanel.svelte';
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
  let toolEvents = $state<string[]>([]);
  let result = $state<AiReviewResult | null>(null);
  let error = $state('');

  const reviewSteps = [
    'Reading context',
    'Analyzing coverage',
    'Identifying risks',
    'Preparing insights'
  ];

  const aiReviewUnavailableMessage = 'AI review is unavailable right now. Check the Intelligence configuration and try again.';

  function apiReviewUrl(): string {
    if (/^https?:\/\//i.test(reviewUrl)) return reviewUrl;
    return `${getApiBaseUrl().replace(/\/$/, '')}${reviewUrl.startsWith('/') ? reviewUrl : `/${reviewUrl}`}`;
  }

  async function requestReview() {
    loading = true;
    streaming = false;
    streamingTokens = '';
    toolEvents = [];
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
          const data = line.slice(5).trim();

          if (data === '[DONE]') {
            doneReceived = true;
            continue;
          }

          if (doneReceived) {
            try {
              const parsed = JSON.parse(data) as AiReviewResult;
              if (parsed.message && !parsed.summary && !parsed.findings?.length) {
                error = parsed.message;
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

          // Filter out [TOOL:xxx] events — display them as tool steps, not as streaming text
          if (data.startsWith('[TOOL:') && data.endsWith(']')) {
            const toolName = data.slice(6, -1);
            toolEvents = [...toolEvents, toolName];
          } else {
            streamingTokens += data;
          }
        }
      }

      // Stream ended without receiving final JSON
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

  function typeLabel(type: string): string {
    switch (type) {
      case 'RISK': return 'Risk';
      case 'COVERAGE': return 'Coverage';
      case 'QUALITY': return 'Quality';
      default: return 'Info';
    }
  }
</script>

{#if loading}
  <div class="review-shell">
    <AiThinkingPanel
      title="AI is reviewing"
      subtitle="Analyzing {label} and preparing a review."
      hint="This may take a moment depending on model load."
      steps={reviewSteps}
    />
  </div>
{:else if streaming}
  <div class="review-shell streaming-shell">
    <div class="streaming-header">
      <span class="review-eyebrow">AI Reasoning</span>
      <span class="live-badge">live</span>
    </div>
    {#if toolEvents.length > 0}
      <div class="tool-events" aria-label="Context gathering steps">
        {#each toolEvents as event}
          <span class="tool-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            {event}
          </span>
        {/each}
      </div>
    {/if}
    {#if streamingTokens}
      <p class="streaming-tokens">{streamingTokens}<span class="cursor" aria-hidden="true"></span></p>
    {/if}
  </div>
{:else if result}
  <div class="review-shell">
    <div class="review-header">
      <span class="review-eyebrow">AI Review</span>
      <button class="rerun-btn" onclick={requestReview} title="Re-run review">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Re-run
      </button>
    </div>

    {#if result.summary}
      <p class="review-summary">{result.summary}</p>
    {/if}

    {#if result.findings?.length}
      <ul class="findings-list">
        {#each result.findings as finding}
          <li class="finding {severityClass(finding.severity)}">
            <div class="finding-meta">
              <span class="finding-type">{typeLabel(finding.type)}</span>
              <span class="finding-severity">{finding.severity}</span>
              {#if finding.confidence != null}
                <span class="finding-confidence" title="AI confidence: {Math.round(finding.confidence * 100)}%">
                  {Math.round(finding.confidence * 100)}% conf.
                </span>
              {/if}
            </div>
            <div class="finding-body">
              <strong class="finding-title">{finding.title}</strong>
              <p class="finding-detail">{finding.detail}</p>
              {#if finding.reasoning_evidence}
                <details class="finding-evidence">
                  <summary>Evidence &amp; reasoning</summary>
                  <p>{finding.reasoning_evidence}</p>
                </details>
              {/if}
              {#if finding.related_requirement}
                <span class="finding-requirement" title="Related requirement">📋 {finding.related_requirement}</span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="no-findings">No issues found.</p>
    {/if}

    {#if result.recommendation}
      <div class="review-rec">
        <span class="rec-label">Recommendation</span>
        <p>{result.recommendation}</p>
      </div>
    {/if}

    {#if result.message}
      <p class="review-note">{result.message}</p>
    {/if}

    {#if result.model || result.generatedAt}
      <p class="review-meta">
        {#if result.model}{result.model}{result.provider ? ` · ${result.provider}` : ''}{/if}{result.generatedAt ? ` · ${new Date(result.generatedAt).toLocaleString()}` : ''}
        {#if toolEvents.length > 0} · {toolEvents.length} context tool{toolEvents.length > 1 ? 's' : ''} used{/if}
      </p>
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
  .review-shell {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    padding: 20px;
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .review-eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
  }

  .rerun-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 4px 10px;
    transition: color 0.15s, border-color 0.15s;
  }

  .rerun-btn:hover { color: var(--color-text); border-color: var(--color-accent); }

  .streaming-shell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-color: color-mix(in srgb, var(--color-accent), transparent 40%);
    animation: pulse-border 2s infinite;
  }

  @keyframes pulse-border {
    0%, 100% { border-color: color-mix(in srgb, var(--color-accent), transparent 40%); }
    50% { border-color: var(--color-accent); }
  }

  .streaming-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .live-badge {
    background: var(--color-accent);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    animation: fade-in-out 1.5s infinite;
  }

  @keyframes fade-in-out { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .streaming-tokens {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.65;
    color: var(--color-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 0.9em;
    background: var(--color-accent);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .tool-events {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 10px;
  }

  .tool-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    color: var(--color-accent);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 65%);
    white-space: nowrap;
  }

  .tool-badge svg { flex-shrink: 0; }

  .review-summary {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
    margin: 0 0 16px;
  }

  .findings-list {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .finding {
    display: flex;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 8px;
    border-left: 3px solid;
  }

  .finding--high { border-color: var(--color-danger, #dc2626); background: color-mix(in srgb, var(--color-danger, #dc2626), transparent 94%); }
  .finding--medium { border-color: var(--color-warning, #d97706); background: color-mix(in srgb, var(--color-warning, #d97706), transparent 94%); }
  .finding--low { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .finding--info { border-color: var(--color-border); background: var(--color-bg); }

  .finding-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 68px;
    flex-shrink: 0;
  }

  .finding-type {
    font-size: 0.67rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .finding-severity {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .finding--high .finding-severity { color: var(--color-danger, #dc2626); }
  .finding--medium .finding-severity { color: var(--color-warning, #d97706); }
  .finding--low .finding-severity { color: var(--color-accent); }
  .finding--info .finding-severity { color: var(--color-text-muted); }

  .finding-body { flex: 1; min-width: 0; }

  .finding-title {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 3px;
  }

  .finding-detail {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .finding-confidence {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-accent), transparent 85%);
    color: var(--color-accent);
    white-space: nowrap;
    cursor: help;
  }

  .finding-evidence {
    margin-top: 8px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .finding-evidence summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--color-accent);
    user-select: none;
  }

  .finding-evidence summary:hover {
    text-decoration: underline;
  }

  .finding-evidence p {
    margin: 6px 0 0;
    line-height: 1.5;
    padding-left: 4px;
    border-left: 2px solid var(--color-border);
  }

  .finding-requirement {
    display: inline-block;
    margin-top: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-bg);
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
  }

  .no-findings {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0 0 16px;
  }

  .review-rec {
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 65%);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 4px;
  }

  .rec-label {
    display: block;
    font-size: 0.67rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent);
    margin-bottom: 5px;
  }

  .review-rec p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.55;
  }

  .review-note {
    margin: 12px 0 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .review-meta {
    margin: 10px 0 0;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    opacity: 0.65;
  }

  .review-idle {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .request-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-accent);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 16px;
    transition: background 0.15s, border-color 0.15s;
  }

  .request-btn:hover {
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    border-color: var(--color-accent);
  }

  .idle-caption {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  /* ── Mobile Responsive ─────────────────────────────────── */
  @media (max-width: 640px) {
    .review-shell {
      padding: 14px;
    }
    .finding {
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
    }
    .finding-meta {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }
    .finding-title {
      font-size: 0.82rem;
    }
    .finding-detail {
      font-size: 0.78rem;
    }
    .finding-confidence {
      font-size: 0.62rem;
    }
    .finding-evidence {
      font-size: 0.74rem;
    }
    .streaming-tokens {
      max-height: 200px;
      font-size: 0.75rem;
    }
    .tool-events {
      flex-wrap: wrap;
    }
    .request-btn {
      width: 100%;
      justify-content: center;
    }
  }</style>

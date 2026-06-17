<script lang="ts">
  import { page } from '$app/state';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import MarkdownBlock from '$lib/components/MarkdownBlock.svelte';
  import AiThinkingPanel from '$lib/components/AiThinkingPanel.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import { getApiBaseUrl } from '$lib/api/config';
  import { authHeaders } from '$lib/api/client';
  import { normalizeErrorMessage } from '$lib/api/errors';
  import { isMockMode } from '$lib/mock/client';

  const isMock = isMockMode();
  const projectKey = $derived(page.params.projectKey);

  interface SmartSearchResult {
    scenarioId: string;
    scenarioKey: string;
    name: string;
    path: string | null;
    priority: string | null;
    automationStatus: string | null;
    tags: string[];
    score: number;
  }

  let query = $state('');
  let reasoning = $state('');
  let results = $state<SmartSearchResult[]>([]);
  let phase = $state<'idle' | 'thinking' | 'streaming' | 'done' | 'error'>('idle');
  let error = $state('');

  function scoreColor(score: number): string {
    if (score >= 0.85) return 'var(--color-success, #16a34a)';
    if (score >= 0.65) return 'var(--color-accent)';
    return 'var(--color-warning, #d97706)';
  }

  function priorityVariant(priority: string | null): 'danger' | 'warning' | 'info' | 'neutral' {
    switch (priority) {
      case 'CRITICAL': return 'danger';
      case 'HIGH':     return 'warning';
      case 'MEDIUM':   return 'info';
      default:         return 'neutral';
    }
  }

  async function search() {
    if (!query.trim() || phase === 'streaming' || phase === 'thinking') return;
    phase = 'thinking';
    reasoning = '';
    results = [];
    error = '';

    try {
      const base = getApiBaseUrl().replace(/\/$/, '');
      const url = `${base}/api/projects/${projectKey}/scenarios/search/smart?q=${encodeURIComponent(query.trim())}&limit=10`;
      const res = await fetch(url, { headers: authHeaders() });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buf = '';
      let doneSeen = false;
      phase = 'streaming';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).replace(/\r$/, '');
          // IMPORTANT: do NOT .trim() the data — LLM tokens include leading
          // spaces that separate words (e.g. " scenarios" vs "scenarios").

          if (data === '[DONE]') { doneSeen = true; continue; }

          if (doneSeen) {
            try {
              const parsed = JSON.parse(data) as { scenarios: SmartSearchResult[]; query: string };
              results = parsed.scenarios ?? [];
            } catch { /* ignore */ }
            doneSeen = false;
            phase = 'done';
          } else {
            reasoning += data;
          }
        }
      }

      if (phase !== 'done') phase = 'done';
    } catch (e) {
      error = normalizeErrorMessage(e, 'Smart Search is unavailable. Check the Intelligence configuration.');
      phase = 'error';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  function reset() {
    phase = 'idle';
    reasoning = '';
    results = [];
    error = '';
    query = '';
  }
</script>

<svelte:head><title>Smart Search — {projectKey} — Setara</title></svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{projectKey}/repository">Repository</a>
    <span class="sep">›</span>
    <span>Smart Search</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">
        <svg class="title-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        Smart Search
      </h1>
      <p class="page-sub">Find test scenarios by describing what they do — powered by semantic similarity.</p>
    </div>
    <Button variant="secondary" href="/projects/{projectKey}/repository">← Repository</Button>
  </div>

  {#if isMock}
    <div class="empty-hero">
      <div class="empty-icon-wrap">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v4M11 15h.01"/></svg>
      </div>
      <h2>Not available in preview mode</h2>
      <p>Smart Search requires a live backend with the Intelligence feature enabled.</p>
    </div>
  {:else}
    <div class="search-bar-wrap">
      <div class="search-bar" class:active={phase === 'streaming' || phase === 'thinking'}>
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          class="search-input"
          type="search"
          placeholder="Describe what you're looking for… e.g. 'user login with invalid credentials'"
          bind:value={query}
          onkeydown={handleKeydown}
          aria-label="Search query"
          disabled={phase === 'thinking' || phase === 'streaming'}
        />
        {#if phase === 'done' || phase === 'error'}
          <button class="clear-btn" onclick={reset} title="Clear search" aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        {/if}
        <Button
          variant="primary"
          onclick={search}
          disabled={phase === 'thinking' || phase === 'streaming' || !query.trim()}
        >
          {#if phase === 'thinking' || phase === 'streaming'}
            <span class="btn-spinner"></span> Searching…
          {:else}
            Search
          {/if}
        </Button>
      </div>
      <p class="search-hint">Tip: describe the behaviour you want to test, not the exact scenario name.</p>
    </div>

    {#if phase === 'thinking'}
      <AiThinkingPanel
        title="Searching scenarios"
        subtitle="Embedding your query and searching for semantically similar scenarios."
        hint="This may take a moment depending on model load."
        steps={[
          'Embedding search query',
          'Searching vector store',
          'Ranking results by relevance',
          'Preparing AI analysis'
        ]}
      />
    {/if}

    {#if phase === 'streaming' || (phase === 'done' && reasoning)}
      <div class="reasoning-panel" class:streaming={phase === 'streaming'}>
        <div class="reasoning-header">
          <div class="reasoning-header-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <span class="reasoning-header-label">AI Analysis</span>
          {#if phase === 'streaming'}<span class="live-badge">live</span>{/if}
        </div>
        <div class="reasoning-divider"></div>
        <div class="reasoning-content">
          <MarkdownBlock value={reasoning} collapsedHeight={0} />
          {#if phase === 'streaming'}<span class="cursor" aria-hidden="true"></span>{/if}
        </div>
      </div>
    {/if}

    {#if phase === 'error'}
      <AppAlert tone="error" title="Smart Search unavailable">{error}</AppAlert>
    {/if}

    {#if phase === 'done' && results.length === 0}
      <div class="empty-hero">
        <div class="empty-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <h2>No matching scenarios</h2>
        <p>No scenarios matched <strong>"{query}"</strong>. Try a different description, or check that Intelligence is enabled and scenarios are indexed.</p>
      </div>
    {/if}

    {#if results.length > 0}
      <div class="results-section">
        <div class="results-header">
          <h2 class="results-title">{results.length} scenario{results.length === 1 ? '' : 's'} found</h2>
        </div>
        <div class="results-list">
          {#each results as result, i}
            {@const pct = Math.round(result.score * 100)}
            <a
              href="/projects/{projectKey}/repository?scenario={result.scenarioId}"
              class="result-card"
              style="--i:{i}"
            >
              <div class="result-top">
                <span class="result-key">{result.scenarioKey}</span>
                <span class="result-score" style="--sc:{scoreColor(result.score)}">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {pct}% match
                </span>
              </div>

              <p class="result-name">{result.name}</p>

              {#if result.path}
                <div class="result-path">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {result.path}
                </div>
              {/if}

              <div class="result-meta">
                {#if result.priority}
                  <Badge variant={priorityVariant(result.priority)} text={result.priority} />
                {/if}
                {#if result.automationStatus && result.automationStatus !== 'NONE'}
                  <Badge variant="neutral" text={result.automationStatus.replace(/_/g, ' ')} />
                {/if}
                {#each (result.tags ?? []).slice(0, 4) as tag}
                  <span class="tag">{tag}</span>
                {/each}
                {#if (result.tags?.length ?? 0) > 4}
                  <span class="tag tag--more">+{result.tags.length - 4}</span>
                {/if}
              </div>

              <div class="result-score-bar">
                <div class="score-fill" style="width:{pct}%; background:{scoreColor(result.score)}"></div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    {#if phase === 'idle'}
      <div class="how-it-works">
        <h3>How Smart Search works</h3>
        <div class="how-grid">
          <div class="how-step">
            <span class="how-num">1</span>
            <div>
              <strong>Semantic embedding</strong>
              <p>Your query is converted to a vector using the same AI model that indexed your scenarios.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-num">2</span>
            <div>
              <strong>Vector similarity search</strong>
              <p>pgvector finds scenarios whose meaning is closest to your query — not just keyword matches.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-num">3</span>
            <div>
              <strong>AI reasoning</strong>
              <p>An AI agent explains why the top results are relevant to what you are looking for.</p>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page { max-width: min(960px, 100%); }

  .breadcrumb {
    display: flex; gap: 8px; color: var(--color-text-muted);
    font-size: 0.82rem; margin-bottom: 18px; flex-wrap: wrap;
  }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .sep { opacity: 0.5; }

  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .page-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 1.5rem; font-weight: 700; margin: 0;
  }
  .title-icon { color: var(--color-accent); flex-shrink: 0; }
  .page-sub { color: var(--color-text-muted); font-size: 0.9rem; margin: 4px 0 0; }

  .search-bar-wrap { margin-bottom: 20px; }
  .search-bar {
    display: flex; gap: 10px; align-items: center;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: 12px; padding: 6px 10px 6px 14px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-bar.active,
  .search-bar:focus-within {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 82%);
  }
  .search-icon { color: var(--color-text-muted); flex-shrink: 0; }
  .search-input {
    flex: 1; border: none; background: transparent; color: var(--color-text);
    font: inherit; font-size: 0.95rem; outline: none; min-width: 0; padding: 6px 0;
  }
  .search-input:disabled { opacity: 0.6; }
  .search-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 6px 0 0; }

  .clear-btn {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 50%; border: none;
    background: var(--color-bg); color: var(--color-text-muted);
    cursor: pointer; transition: background 0.1s, color 0.1s; flex-shrink: 0;
  }
  .clear-btn:hover { background: var(--color-danger, #dc2626); color: #fff; }

  .btn-spinner {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .reasoning-panel {
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 55%);
    background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent), transparent 96%), color-mix(in srgb, var(--color-accent), transparent 98%));
    border-radius: 12px;
    margin-bottom: 20px;
    overflow: hidden;
    box-shadow: 0 1px 3px color-mix(in srgb, var(--color-accent), transparent 90%);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .reasoning-panel.streaming {
    border-color: color-mix(in srgb, var(--color-accent), transparent 35%);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 85%);
    animation: reasoning-glow 2.4s ease-in-out infinite;
  }
  @keyframes reasoning-glow {
    0%, 100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 85%); }
    50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent), transparent 70%); }
  }

  .reasoning-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px 0 18px;
  }
  .reasoning-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-accent), transparent 85%);
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .reasoning-header-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-accent);
  }

  .reasoning-divider {
    height: 1px;
    margin: 10px 18px 0 18px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-accent), transparent 60%),
      color-mix(in srgb, var(--color-accent), transparent 88%) 60%,
      transparent
    );
  }

  .live-badge {
    background: var(--color-accent);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    letter-spacing: 0.04em;
    animation: fade-in-out 1.5s infinite;
  }
  @keyframes fade-in-out { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  /* Markdown content inside reasoning panel */
  .reasoning-content {
    padding: 12px 18px 16px 18px;
    font-size: 0.875rem;
    line-height: 1.7;
    color: var(--color-text);
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
  }
  .reasoning-content :global(p) {
    margin: 0 0 10px;
  }
  .reasoning-content :global(p:last-child) {
    margin-bottom: 0;
  }
  .reasoning-content :global(strong) {
    color: color-mix(in srgb, var(--color-text), var(--color-accent) 30%);
    font-weight: 700;
  }
  .reasoning-content :global(em) {
    color: var(--color-text-muted);
  }
  .reasoning-content :global(ul),
  .reasoning-content :global(ol) {
    margin: 8px 0;
    padding-left: 20px;
  }
  .reasoning-content :global(li) {
    margin-bottom: 4px;
  }
  .reasoning-content :global(li::marker) {
    color: var(--color-accent);
  }
  .reasoning-content :global(pre) {
    max-width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid color-mix(in srgb, var(--color-border), #000 20%);
    border-radius: 8px;
    padding: 12px 14px;
    margin: 8px 0;
  }
  .reasoning-content :global(code) {
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.84em;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border-radius: 4px;
    padding: 1px 5px;
  }
  .reasoning-content :global(pre code) {
    background: transparent;
    padding: 0;
  }
  .reasoning-content :global(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .reasoning-content :global(th),
  .reasoning-content :global(td) {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    text-align: left;
    font-size: 0.82rem;
  }
  .reasoning-content :global(th) {
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    font-weight: 700;
  }
  .reasoning-content :global(img) {
    max-width: 100%;
    height: auto;
  }
  .reasoning-content :global(hr) {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 12px 0;
  }
  .reasoning-content :global(blockquote) {
    border-left: 3px solid var(--color-accent);
    margin: 8px 0;
    padding: 4px 12px;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-accent), transparent 95%);
    border-radius: 0 6px 6px 0;
  }

  .cursor {
    display: inline-block; width: 2px; height: 0.9em; background: var(--color-accent);
    margin-left: 1px; vertical-align: text-bottom; animation: blink 1s step-end infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  .results-section { margin-top: 4px; }
  .results-header { margin-bottom: 12px; }
  .results-title { font-size: 0.9rem; font-weight: 600; margin: 0; color: var(--color-text-muted); }
  .results-list { display: flex; flex-direction: column; gap: 10px; }

  .result-card {
    display: block; padding: 16px 18px;
    border: 1px solid var(--color-border); border-radius: 10px;
    background: var(--color-surface); text-decoration: none; color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    animation: slide-in 0.25s ease both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }
  .result-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--color-accent), transparent 82%);
    transform: translateY(-1px);
  }
  @keyframes slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .result-top {
    display: flex; justify-content: space-between; align-items: center;
    gap: 12px; margin-bottom: 6px;
  }
  .result-key {
    font-family: var(--font-mono, monospace); font-size: 0.78rem;
    color: var(--color-accent); font-weight: 700;
  }
  .result-score {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.75rem; font-weight: 700; color: var(--sc);
    background: color-mix(in srgb, var(--sc), transparent 90%);
    padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  }
  .result-name {
    font-size: 0.95rem; font-weight: 600; margin: 0 0 8px;
    color: var(--color-text); line-height: 1.4;
  }
  .result-path {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.75rem; color: var(--color-text-muted);
    font-family: var(--font-mono, monospace); margin-bottom: 10px;
  }
  .result-meta { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-bottom: 10px; }
  .tag {
    font-size: 0.7rem; padding: 2px 7px; border-radius: 8px;
    background: var(--color-bg); border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }
  .tag--more { color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent), transparent 70%); }
  .result-score-bar {
    height: 3px; border-radius: 2px; background: var(--color-bg); overflow: hidden;
  }
  .score-fill { height: 100%; border-radius: 2px; }

  .empty-hero {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    text-align: center; padding: 56px 24px;
  }
  .empty-icon-wrap {
    width: 56px; height: 56px; border-radius: 50%;
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
    color: var(--color-accent); display: flex; align-items: center; justify-content: center;
  }
  .empty-hero h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
  .empty-hero p { font-size: 0.875rem; color: var(--color-text-muted); max-width: 480px; margin: 0; line-height: 1.6; }

  .how-it-works {
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: 12px; padding: 20px; margin-top: 24px;
  }
  .how-it-works h3 { font-size: 0.875rem; font-weight: 700; margin: 0 0 14px; color: var(--color-accent); }
  .how-grid { display: grid; gap: 14px; }
  @media (min-width: 600px) { .how-grid { grid-template-columns: repeat(3, 1fr); } }
  .how-step { display: flex; gap: 12px; }
  .how-num {
    flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
    background: var(--color-accent); color: #fff; font-size: 0.75rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .how-step strong { display: block; font-size: 0.85rem; margin-bottom: 3px; }
  .how-step p { margin: 0; font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.5; }

  /* ── Mobile Responsive ─────────────────────────────────── */
  @media (max-width: 640px) {
    .page-header { flex-direction: column; }
    .page-title { font-size: 1.2rem; }
    .search-bar {
      flex-wrap: wrap; gap: 8px; padding: 8px 10px;
    }
    .search-input { font-size: 0.875rem; }
    .reasoning-panel { padding: 10px 12px; }
    .reasoning-content { font-size: 0.825rem; }
    .result-card { padding: 12px 14px; }
    .result-name { font-size: 0.875rem; }
    .result-top { flex-direction: column; align-items: flex-start; gap: 6px; }
    .how-grid { grid-template-columns: 1fr; }
  }
</style>

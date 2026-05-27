<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import { getApiBaseUrl } from '$lib/api/config';

  const projectKey = $derived(page.params.projectKey);

  let query = $state('');
  let results = $state<SimilarResult[]>([]);
  let searching = $state(false);
  let error = $state('');
  let searched = $state(false);

  interface SimilarResult {
    scenarioId: string;
    scenarioKey: string;
    name: string;
    path: string | null;
    score: number;
  }

  async function search() {
    if (!query.trim()) return;
    searching = true; error = ''; searched = true;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectKey}/scenarios/search/similar?q=${encodeURIComponent(query.trim())}&limit=15`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      results = await res.json();
    } catch (e) {
      error = (e as Error).message;
      results = [];
    } finally { searching = false; }
  }

  function formatScore(score: number): string {
    return `${(score * 100).toFixed(1)}%`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') search();
  }
</script>

<svelte:head><title>Semantic Search — {projectKey} — Setara</title></svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{projectKey}/repository">Repository</a>
    <span class="sep">›</span>
    <span>Semantic Search</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Semantic Search</h1>
      <p class="page-sub">Find similar scenarios by meaning, not just keywords.</p>
    </div>
    <Button variant="secondary" href="/projects/{projectKey}/repository">← Back to Repository</Button>
  </div>

  <div class="search-section">
    <div class="search-bar">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input
        class="search-input"
        type="search"
        placeholder="Describe what you're looking for… e.g. 'user login with invalid credentials'"
        bind:value={query}
        onkeydown={handleKeydown}
        aria-label="Semantic search query"
      />
      <Button variant="primary" onclick={search} disabled={searching || !query.trim()}>
        {searching ? 'Searching…' : 'Search'}
      </Button>
    </div>
    <p class="search-hint">Requires intelligence features enabled. Falls back to text search if vector store is unavailable.</p>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if searched}
    {#if results.length > 0}
      <div class="results-section">
        <h2 class="section-title">Results ({results.length})</h2>
        <div class="results-list">
          {#each results as result}
            <a href="/projects/{projectKey}/repository?scenario={result.scenarioId}" class="result-card">
              <div class="result-header">
                <strong class="result-key">{result.scenarioKey}</strong>
                <span class="result-score" style="--score:{result.score * 100}%">
                  {formatScore(result.score)}
                </span>
              </div>
              <span class="result-name">{result.name}</span>
              {#if result.path}
                <span class="result-path">{result.path}</span>
              {/if}
            </a>
          {/each}
        </div>
      </div>
    {:else if !searching}
      <div class="empty-state">
        <p>No similar scenarios found for <strong>"{query}"</strong>.</p>
        <p class="muted">Try rephrasing your query or check that intelligence features are enabled.</p>
      </div>
    {/if}
  {/if}

  {#if !searched}
    <div class="info-card">
      <h3>About Semantic Search</h3>
      <p>Semantic search finds scenarios by their <strong>meaning</strong>, not just exact keyword matches. It uses AI embeddings to understand the intent behind your query.</p>
      <ul>
        <li>Describe what the scenario should test</li>
        <li>Find duplicate or similar test cases</li>
        <li>Discover related scenarios across directories</li>
      </ul>
      <p class="muted">Enable with: <code>setara.intelligence.enabled=true</code> and configure an embedding provider.</p>
    </div>
  {/if}
</div>

<style>
  .page { max-width: min(960px, 100%); }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .sep { opacity: 0.5; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .page-sub { color: var(--color-text-muted); font-size: 0.9rem; margin: 4px 0 0; }
  .search-section { margin-bottom: 24px; }
  .search-bar { display: flex; gap: 10px; align-items: center; }
  .search-icon { position: absolute; margin-left: 12px; color: var(--color-text-muted); pointer-events: none; z-index: 1; }
  .search-input { flex: 1; padding: 10px 12px 10px 38px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.95rem; outline: none; transition: border-color 0.15s; }
  .search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(0,175,165,0.1); }
  .search-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 8px 0 0; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
  .results-section { margin-top: 8px; }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0 0 12px; color: var(--color-text); }
  .results-list { display: flex; flex-direction: column; gap: 8px; }
  .result-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); text-decoration: none; color: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
  .result-card:hover { border-color: var(--color-accent); box-shadow: var(--shadow); }
  .result-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .result-key { font-family: var(--font-mono, monospace); font-size: 0.82rem; color: var(--color-accent); }
  .result-score { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); }
  .result-name { font-size: 0.925rem; font-weight: 600; color: var(--color-text); }
  .result-path { font-size: 0.72rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); }
  .empty-state { text-align: center; padding: 48px 24px; color: var(--color-text-muted); }
  .muted { color: var(--color-text-muted); font-size: 0.85rem; }
  .info-card { background: var(--color-accent-subtle); border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%); border-radius: var(--radius); padding: 20px; margin-top: 8px; }
  .info-card h3 { font-size: 0.95rem; font-weight: 600; margin: 0 0 8px; color: var(--color-accent); }
  .info-card p { font-size: 0.875rem; color: var(--color-text-muted); margin: 0 0 8px; line-height: 1.5; }
  .info-card ul { margin: 0 0 8px; padding-left: 20px; color: var(--color-text-muted); font-size: 0.85rem; }
  .info-card li { margin-bottom: 4px; }
  .info-card code { font-size: 0.78rem; background: var(--color-bg); padding: 1px 5px; border-radius: 3px; }
</style>

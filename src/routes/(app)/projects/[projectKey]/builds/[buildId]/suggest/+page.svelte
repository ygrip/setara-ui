<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { suggestScenarios, bulkAddScenarios, type SuggestResponse, type SuggestionResult } from '$lib/api/builds';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';

  const projectKey = $derived(page.params.projectKey);
  const buildId = $derived(page.params.buildId);

  let loading = $state(true);
  let error = $state('');
  let response = $state<SuggestResponse | null>(null);
  let selectedIds = $state<Set<string>>(new Set());
  let adding = $state(false);
  let addError = $state('');
  let done = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      response = await suggestScenarios(projectKey, buildId);
      if (response.suggestions.length > 0) {
        selectedIds = new Set(response.suggestions.map(s => s.scenarioId));
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  function toggleAll() {
    if (!response) return;
    if (selectedIds.size === response.suggestions.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(response.suggestions.map(s => s.scenarioId));
    }
  }

  async function addSelected() {
    if (selectedIds.size === 0 || adding) return;
    adding = true;
    addError = '';
    try {
      await bulkAddScenarios(projectKey, buildId, { scenarioIds: [...selectedIds], source: 'AI_SUGGEST' });
      done = true;
    } catch (e) {
      addError = (e as Error).message;
    } finally {
      adding = false;
    }
  }

  function formatScore(score: number): string {
    return `${(score * 100).toFixed(0)}%`;
  }

  function scoreVariant(score: number): 'success' | 'info' | 'warning' {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'info';
    return 'warning';
  }

  function init() { load(); }
  init();
</script>

<svelte:head><title>AI Scenario Suggestions — Setara</title></svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span>›</span>
    <a href="/projects/{projectKey}/builds">Builds</a>
    <span>›</span>
    <a href="/projects/{projectKey}/builds/{buildId}">Build {buildId.substring(0, 8)}</a>
    <span>›</span>
    <span>AI Suggestions</span>
  </nav>

  <header class="page-header">
    <div>
      <h1 class="page-title">AI Scenario Suggestions</h1>
      <p class="page-sub">
        The system analyzes your build requirements and suggests relevant existing scenarios.
        Review and confirm which scenarios to add.
      </p>
    </div>
    <a class="back-link" href="/projects/{projectKey}/builds/{buildId}">← Back to Build</a>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Analyzing build requirements and searching for relevant scenarios…</p>
      <p class="loading-hint">This may take up to 30 seconds.</p>
    </div>
  {:else if error}
    <div class="error-banner">
      <strong>Error:</strong> {error}
      <Button variant="secondary" onclick={load}>Retry</Button>
    </div>
  {:else if done}
    <div class="success-banner">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      <div>
        <strong>{selectedIds.size} scenario(s) added to build</strong>
        <p>Scenarios have been added with source "AI_SUGGEST".</p>
      </div>
      <a href="/projects/{projectKey}/builds/{buildId}" class="primary-btn">Return to Build</a>
    </div>
  {:else if response && response.message && response.suggestions.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h2>No Suggestions Found</h2>
      <p>{response.message}</p>
      <p class="empty-hint">Try adding more detailed build requirements, or manually select scenarios from the repository.</p>
      <a href="/projects/{projectKey}/builds/{buildId}" class="primary-btn">Return to Build</a>
    </div>
  {:else if response}
    <div class="suggestions-section">
      <div class="suggestions-header">
        <div>
          <h2>{response.suggestions.length} suggestion(s)</h2>
          <p>Scenarios ranked by relevance (LLM + semantic similarity). Deselect any you don't want to add.</p>
        </div>
        <div class="suggestions-actions">
          <label class="select-all-label">
            <input type="checkbox" checked={selectedIds.size === response.suggestions.length} onchange={toggleAll} />
            Select all
          </label>
          <Button variant="primary" disabled={selectedIds.size === 0 || adding} onclick={addSelected}>
            {adding ? 'Adding…' : `Add ${selectedIds.size} Selected`}
          </Button>
        </div>
      </div>

      {#if addError}
        <div class="error-banner">{addError}</div>
      {/if}

      <div class="suggestions-list">
        {#each response.suggestions as suggestion}
          <label class="suggestion-card" class:selected={selectedIds.has(suggestion.scenarioId)}>
            <input
              type="checkbox"
              checked={selectedIds.has(suggestion.scenarioId)}
              onchange={() => toggle(suggestion.scenarioId)}
            />
            <div class="suggestion-body">
              <div class="suggestion-top">
                <strong class="suggestion-name">{suggestion.name}</strong>
                <Badge text={formatScore(suggestion.confidence)} variant={scoreVariant(suggestion.confidence)} />
              </div>
              {#if suggestion.scenarioKey}
                <span class="suggestion-key">{suggestion.scenarioKey}</span>
              {/if}
              {#if suggestion.path}
                <span class="suggestion-path">{suggestion.path}</span>
              {/if}
              {#if suggestion.reason}
                <p class="suggestion-reason">{suggestion.reason}</p>
              {/if}
            </div>
          </label>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 960px; margin: 0 auto; padding: 24px 20px 60px; }
  .breadcrumb { display: flex; gap: 6px; font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
  .page-title { margin: 0 0 4px; font-size: 1.3rem; }
  .page-sub { margin: 0; color: var(--color-text-muted); font-size: 0.88rem; }
  .back-link { color: var(--color-accent); text-decoration: none; font-size: 0.85rem; white-space: nowrap; }

  .loading-state { text-align: center; padding: 60px 20px; }
  .spinner { width: 36px; height: 36px; margin: 0 auto 16px; border: 3px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-hint { color: var(--color-text-muted); font-size: 0.78rem; }

  .error-banner, .success-banner { padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .error-banner { background: color-mix(in srgb, #dc2626, transparent 90%); border: 1px solid color-mix(in srgb, #dc2626, transparent 70%); color: #dc2626; }
  .success-banner { background: color-mix(in srgb, #16a34a, transparent 90%); border: 1px solid color-mix(in srgb, #16a34a, transparent 70%); color: #16a34a; flex-wrap: wrap; }
  .error-banner button { margin-left: auto; }
  .primary-btn { display: inline-flex; align-items: center; padding: 8px 16px; border: 0; border-radius: 6px; background: var(--color-accent); color: #fff; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap; }
  .primary-btn:disabled { opacity: 0.5; cursor: default; }

  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-state svg { color: var(--color-text-muted); margin-bottom: 12px; }
  .empty-state h2 { margin: 0 0 8px; }
  .empty-state p { color: var(--color-text-muted); margin: 0 0 4px; }
  .empty-hint { font-size: 0.82rem; margin-top: 12px !important; }

  .suggestions-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .suggestions-header h2 { margin: 0 0 4px; }
  .suggestions-header p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; }
  .suggestions-actions { display: flex; align-items: center; gap: 12px; }
  .select-all-label { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; }

  .suggestions-list { display: flex; flex-direction: column; gap: 8px; }
  .suggestion-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); cursor: pointer; transition: border-color 0.15s; }
  .suggestion-card:hover { border-color: var(--color-accent); }
  .suggestion-card.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .suggestion-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .suggestion-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .suggestion-name { font-size: 0.92rem; }
  .suggestion-key { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--color-accent); }
  .suggestion-path { font-size: 0.72rem; color: var(--color-text-muted); }
  .suggestion-reason { margin: 4px 0 0; font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4; }
</style>

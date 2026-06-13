<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { isMockMode } from '$lib/mock/client';

  let { data } = $props();
  const isMock = isMockMode();
  let reindexProjectKey = $state('');
  let reindexBusy = $state(false);
  let reindexResult = $state('');
  let createIndexBusy = $state(false);
  let createIndexResult = $state('');

  // Feature flags
  interface AiFlags { smartSearch: boolean; smartSuggestion: boolean; duplicateAnalysis: boolean; smartReview: boolean; }
  let localFlags = $state<AiFlags>(data.flags ?? { smartSearch: false, smartSuggestion: false, duplicateAnalysis: false, smartReview: false });
  let flagsBusy = $state(false);
  let flagsError = $state('');
  let flagsSaved = $state(false);

  $effect(() => { if (data.flags) localFlags = { ...data.flags }; });

  const flagDefs: { key: keyof AiFlags; label: string; desc: string }[] = [
    { key: 'smartSearch', label: 'Smart Search', desc: 'Semantic scenario search using AI embeddings' },
    { key: 'smartSuggestion', label: 'Smart Suggestion', desc: 'AI-powered scenario suggestions for builds' },
    { key: 'duplicateAnalysis', label: 'Duplicate Analysis', desc: 'Detect near-duplicate scenarios in the repository' },
    { key: 'smartReview', label: 'Smart Review', desc: 'AI review summaries for builds, plans, and scenarios' }
  ];

  async function toggleFlag(key: keyof AiFlags, value: boolean) {
    const prev = localFlags[key];
    localFlags = { ...localFlags, [key]: value };
    flagsBusy = true; flagsError = ''; flagsSaved = false;
    try {
      const res = await fetch('/api/admin/intelligence/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        flagsError = (json as any).message ?? `Failed to update (HTTP ${res.status})`;
        localFlags = { ...localFlags, [key]: prev };
      } else {
        localFlags = await res.json();
        flagsSaved = true;
        setTimeout(() => { flagsSaved = false; }, 2000);
      }
    } catch (e: any) {
      flagsError = e.message ?? 'Request failed';
      localFlags = { ...localFlags, [key]: prev };
    } finally {
      flagsBusy = false;
    }
  }

  async function triggerReindex() {
    if (!reindexProjectKey.trim()) return;
    reindexBusy = true;
    reindexResult = '';
    try {
      const res = await fetch(`/api/admin/intelligence/reindex?projectKey=${encodeURIComponent(reindexProjectKey)}`, { method: 'POST' });
      const json = await res.json();
      reindexResult = res.ok
        ? `Queued ${json.queuedScenarios} scenarios for project ${json.projectKey}`
        : `Error: ${json.message ?? res.status}`;
    } catch (e: any) {
      reindexResult = `Error: ${e.message}`;
    } finally {
      reindexBusy = false;
    }
  }

  async function createIndex() {
    createIndexBusy = true;
    createIndexResult = '';
    try {
      const res = await fetch('/api/admin/intelligence/create-index', { method: 'POST' });
      const json = await res.json();
      createIndexResult = json.message ?? (res.ok ? 'Done' : `HTTP ${res.status}`);
      if (res.ok) invalidateAll();
    } catch (e: any) {
      createIndexResult = `Error: ${e.message}`;
    } finally {
      createIndexBusy = false;
    }
  }

  function statusDot(ok: boolean) {
    return ok ? '🟢' : '🔴';
  }
</script>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Intelligence</h1>
    <p class="page-subtitle">AI-powered search and embedding pipeline status</p>
  </div>

  {#if isMock}
    <div class="disabled-state">
      <div class="disabled-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>
      <h2 class="disabled-title">Not available in preview mode</h2>
      <p class="disabled-desc">The Intelligence feature requires a live backend with an embedding provider configured. This page shows real-time health and lets you manage AI indexing.</p>
      <p class="disabled-hint">To enable: set <code>setara.intelligence.enabled=true</code> and configure an embedding provider in your backend settings.</p>
    </div>
  {:else}
    {#if data.error}
      <div class="error-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        {data.error}
      </div>
    {/if}

    {#if data.health}
      {@const h = data.health}
      <div class="health-grid">
        <div class="health-card">
          <div class="card-label">Intelligence</div>
          <div class="card-value">{statusDot(h.intelligenceEnabled)} {h.intelligenceEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div class="health-card">
          <div class="card-label">Embedding</div>
          <div class="card-value">{statusDot(h.embeddingEnabled)} {h.embeddingEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div class="health-card">
          <div class="card-label">Provider</div>
          <div class="card-value">
            {statusDot(h.embeddingProviderActive)} {h.embeddingProviderType}
            {#if h.embeddingDimension > 0}<span class="dim-badge">{h.embeddingDimension}d</span>{/if}
          </div>
        </div>
        <div class="health-card">
          <div class="card-label">Vector Store</div>
          <div class="card-value">
            {statusDot(h.vectorStoreActive && h.vectorStoreHealthy)} {h.vectorStoreType}
            {#if !h.vectorStoreHealthy}<span class="warn-badge">Unhealthy</span>{/if}
          </div>
        </div>
        <div class="health-card">
          <div class="card-label">Pending Jobs</div>
          <div class="card-value" class:warn={h.pendingEmbeddingJobs > 50}>{h.pendingEmbeddingJobs}</div>
        </div>
        <div class="health-card">
          <div class="card-label">Last Processed</div>
          <div class="card-value text-sm">{h.lastProcessedAt ? new Date(h.lastProcessedAt).toLocaleString() : '—'}</div>
        </div>
      </div>

      {#if h.lastError || h.recentErrorMessage}
        <div class="error-section">
          <div class="section-label">Recent Error</div>
          <pre class="error-text">{h.lastError ?? h.recentErrorMessage}</pre>
        </div>
      {/if}
    {:else if !data.error}
      <p class="empty-state">No health data available.</p>
    {/if}

    <!-- AI Feature Flags -->
    <div class="flags-section">
      <div class="flags-section-header">
        <div>
          <h2 class="flags-title">AI Feature Flags</h2>
          <p class="flags-subtitle">Enable or disable AI capabilities system-wide. Changes take effect immediately.</p>
        </div>
        {#if flagsSaved}<span class="flags-saved-badge">Saved</span>{/if}
      </div>
      <div class="flags-grid">
        {#each flagDefs as def}
          <div class="flag-row">
            <div class="flag-info">
              <span class="flag-name">{def.label}</span>
              <span class="flag-desc">{def.desc}</span>
            </div>
            <button
              class="toggle-btn"
              class:toggle-on={localFlags[def.key]}
              onclick={() => toggleFlag(def.key, !localFlags[def.key])}
              disabled={flagsBusy}
              aria-pressed={localFlags[def.key]}
              aria-label="Toggle {def.label}"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        {/each}
      </div>
      {#if flagsError}<p class="flags-error">{flagsError}</p>{/if}
    </div>

    {#if data.health}
      <div class="actions-section">
        <div class="action-card">
          <h3 class="action-title">Reindex Project</h3>
          <p class="action-desc">Queue all active test scenarios in a project to be re-processed by the AI embedding pipeline.</p>
          <div class="action-row">
            <input class="project-key-input" bind:value={reindexProjectKey} placeholder="Project key (e.g. PROJ)" />
            <button class="primary-btn" onclick={triggerReindex} disabled={reindexBusy || !reindexProjectKey.trim()}>
              {reindexBusy ? 'Queuing…' : 'Reindex'}
            </button>
          </div>
          {#if reindexResult}<p class="action-result">{reindexResult}</p>{/if}
        </div>

        <div class="action-card">
          <h3 class="action-title">Create Search Index</h3>
          <p class="action-desc">Build the vector search index to speed up semantic similarity queries. Run this after initial indexing is complete.</p>
          <div class="action-row">
            <button class="primary-btn" onclick={createIndex} disabled={createIndexBusy}>
              {createIndexBusy ? 'Creating…' : 'Create Index'}
            </button>
          </div>
          {#if createIndexResult}<p class="action-result">{createIndexResult}</p>{/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page { max-width: 900px; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { margin: 0; color: var(--color-text-muted); font-size: 0.875rem; }
  .error-banner { display: flex; align-items: center; gap: 8px; background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .disabled-state { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .disabled-icon { width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); display: flex; align-items: center; justify-content: center; }
  .disabled-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--color-text); }
  .disabled-desc { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); max-width: 480px; line-height: 1.6; }
  .disabled-hint { margin: 0; font-size: 0.8rem; color: var(--color-text-muted); opacity: 0.75; }
  .disabled-hint code { font-size: 0.78rem; background: var(--color-bg); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--color-border); }
  .health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .health-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; }
  .card-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 8px; }
  .card-value { font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .card-value.warn { color: var(--color-warning, #f59e0b); }
  .text-sm { font-size: 0.78rem; font-weight: 400; }
  .dim-badge { font-size: 0.7rem; background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); border-radius: 4px; padding: 2px 6px; font-weight: 700; }
  .warn-badge { font-size: 0.7rem; background: color-mix(in srgb, var(--color-danger), transparent 85%); color: var(--color-danger); border-radius: 4px; padding: 2px 6px; font-weight: 700; }
  .error-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; margin-bottom: 24px; }
  .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 8px; }
  .error-text { margin: 0; font-size: 0.8rem; font-family: var(--font-mono, monospace); color: var(--color-danger); white-space: pre-wrap; word-break: break-all; }
  .actions-section { display: flex; flex-direction: column; gap: 16px; }
  .action-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; }
  .action-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 6px; }
  .action-desc { margin: 0 0 14px; font-size: 0.85rem; color: var(--color-text-muted); }
  .action-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .project-key-input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; min-width: 180px; }
  .primary-btn { background: var(--color-accent); color: #fff; border: none; border-radius: var(--radius); padding: 8px 18px; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .primary-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
  .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .action-result { margin: 10px 0 0; font-size: 0.85rem; color: var(--color-text-muted); }
  .empty-state { color: var(--color-text-muted); text-align: center; padding: 40px; }

  /* Feature flags */
  .flags-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; }
  .flags-section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
  .flags-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 4px; }
  .flags-subtitle { margin: 0; font-size: 0.82rem; color: var(--color-text-muted); }
  .flags-saved-badge { flex-shrink: 0; font-size: 0.72rem; font-weight: 700; color: #16a34a; background: #dcfce7; border: 1px solid #86efac; border-radius: 4px; padding: 2px 8px; align-self: center; }
  .flags-grid { display: grid; gap: 12px; }
  .flag-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--color-border); }
  .flag-row:last-child { border-bottom: none; padding-bottom: 0; }
  .flag-row:first-child { padding-top: 0; }
  .flag-info { min-width: 0; }
  .flag-name { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 2px; }
  .flag-desc { display: block; font-size: 0.78rem; color: var(--color-text-muted); }
  .flags-error { margin: 10px 0 0; font-size: 0.82rem; color: var(--color-danger, #dc2626); }

  /* Toggle switch */
  .toggle-btn { position: relative; flex-shrink: 0; width: 44px; height: 24px; border-radius: 12px; border: none; background: var(--color-border); cursor: pointer; transition: background 0.2s; padding: 0; }
  .toggle-btn.toggle-on { background: var(--color-accent); }
  .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; display: block; }
  .toggle-btn.toggle-on .toggle-thumb { transform: translateX(20px); }
</style>

<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();
  let reindexProjectKey = $state('');
  let reindexBusy = $state(false);
  let reindexResult = $state('');
  let createIndexBusy = $state(false);
  let createIndexResult = $state('');

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
    <h1 class="page-title">Intelligence Health</h1>
    <p class="page-subtitle">Embedding pipeline, vector store, and pending jobs status</p>
  </div>

  {#if data.error}
    <div class="error-banner">{data.error}</div>
  {:else if data.health}
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

    <div class="actions-section">
      <div class="action-card">
        <h3 class="action-title">Reindex Project</h3>
        <p class="action-desc">Queue all active scenarios in a project for re-embedding.</p>
        <div class="action-row">
          <input class="project-key-input" bind:value={reindexProjectKey} placeholder="Project key (e.g. PROJ)" />
          <button class="primary-btn" onclick={triggerReindex} disabled={reindexBusy || !reindexProjectKey.trim()}>
            {reindexBusy ? 'Queuing…' : 'Reindex'}
          </button>
        </div>
        {#if reindexResult}<p class="action-result">{reindexResult}</p>{/if}
      </div>

      <div class="action-card">
        <h3 class="action-title">Create HNSW Index</h3>
        <p class="action-desc">Create a pgvector HNSW index on the embedding column using the active provider dimension. Requires embeddings to be indexed first.</p>
        <div class="action-row">
          <button class="primary-btn" onclick={createIndex} disabled={createIndexBusy}>
            {createIndexBusy ? 'Creating…' : 'Create Index'}
          </button>
        </div>
        {#if createIndexResult}<p class="action-result">{createIndexResult}</p>{/if}
      </div>
    </div>
  {:else}
    <p class="empty-state">No health data available.</p>
  {/if}
</div>

<style>
  .page { max-width: 900px; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { margin: 0; color: var(--color-text-muted); font-size: 0.875rem; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
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
</style>

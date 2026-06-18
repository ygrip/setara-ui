<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { isMockMode } from '$lib/mock/client';
  import { apiFetch } from '$lib/api/client';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();
  const isMock = isMockMode();

  // ── Feature flags ─────────────────────────────────────────────────────────
  interface AiFlags { smartSearch: boolean; smartSuggestion: boolean; duplicateAnalysis: boolean; smartReview: boolean; }
  const defaultFlags: AiFlags = { smartSearch: false, smartSuggestion: false, duplicateAnalysis: false, smartReview: false };
  let localFlags = $state<AiFlags>({ ...defaultFlags });
  let flagsBusy = $state(false);
  let flagsError = $state('');
  let flagsSaved = $state(false);

  $effect(() => { if (data.flags) localFlags = { ...data.flags }; });

  const flagDefs: { key: keyof AiFlags; label: string; desc: string }[] = [
    { key: 'smartSearch',      label: 'Smart Search',        desc: 'Semantic scenario search using AI embeddings' },
    { key: 'smartSuggestion',  label: 'Smart Suggestion',    desc: 'AI-powered scenario suggestions for builds' },
    { key: 'duplicateAnalysis',label: 'Duplicate Analysis',  desc: 'Detect near-duplicate scenarios in the repository' },
    { key: 'smartReview',      label: 'Smart Review',        desc: 'AI review summaries for builds, plans, and scenarios' }
  ];

  async function toggleFlag(key: keyof AiFlags, value: boolean) {
    const prev = localFlags[key];
    localFlags = { ...localFlags, [key]: value };
    flagsBusy = true; flagsError = ''; flagsSaved = false;
    try {
      const res = await apiFetch('/api/admin/intelligence/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        flagsError = (json as any).error ?? `Failed to update (HTTP ${res.status})`;
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

  // ── Actions ───────────────────────────────────────────────────────────────
  let reindexProjectKey = $state('');
  let reindexBusy = $state(false);
  let reindexResult = $state('');
  let createIndexBusy = $state(false);
  let createIndexResult = $state('');

  async function triggerReindex() {
    if (!reindexProjectKey.trim()) return;
    reindexBusy = true; reindexResult = '';
    try {
      const res = await apiFetch(`/api/admin/intelligence/reindex?projectKey=${encodeURIComponent(reindexProjectKey)}`, { method: 'POST' });
      const json = await res.json();
      reindexResult = res.ok
        ? `Queued ${json.queuedScenarios} scenarios for project ${json.projectKey}`
        : `Error: ${json.error ?? res.status}`;
    } catch (e: any) {
      reindexResult = `Error: ${e.message}`;
    } finally { reindexBusy = false; }
  }

  async function createIndex() {
    createIndexBusy = true; createIndexResult = '';
    try {
      const res = await apiFetch('/api/admin/intelligence/create-index', { method: 'POST' });
      const json = await res.json();
      createIndexResult = json.message ?? json.error ?? (res.ok ? 'Done' : `HTTP ${res.status}`);
      if (res.ok) invalidateAll();
    } catch (e: any) {
      createIndexResult = `Error: ${e.message}`;
    } finally { createIndexBusy = false; }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  function fmtDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }
</script>

<svelte:head><title>Intelligence — Admin — Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if isMock}
    <Card padding="md">
      <div class="disabled-state">
        <div class="disabled-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <h2 class="disabled-title">Not available in preview mode</h2>
        <p class="disabled-desc">Intelligence requires a live backend with an embedding provider configured.</p>
      </div>
    </Card>

  {:else}
    {#if data.error}
      <AppAlert tone="error">{data.error}</AppAlert>
    {/if}

    {#if data.health}
      {@const h = data.health}

      <!-- ── System status bar ────────────────────────────────────────────── -->
      <div class="status-bar" class:status-bar--on={h.intelligenceEnabled} class:status-bar--off={!h.intelligenceEnabled}>
        <span class="status-dot" class:on={h.intelligenceEnabled}></span>
        Intelligence is <strong>{h.intelligenceEnabled ? 'enabled' : 'disabled'}</strong>
        {#if !h.intelligenceEnabled}
          — set <code>SETARA_INTELLIGENCE_ENABLED=true</code> to activate
        {/if}
      </div>

      <!-- ── AI features table ────────────────────────────────────────────── -->
      <Card padding="md">
        <h2 class="panel-title">AI Features</h2>
        <p class="panel-desc">Provider and model configuration for each capability</p>
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Feature</th>
              <th>Status</th>
              <th>Provider</th>
              <th>Model</th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each h.features ?? [] as f}
              <tr>
                <td data-label="Feature"><span class="feature-name">{f.label}</span></td>
                <td data-label="Status">
                  {#if f.active}
                    <span class="badge badge--active">Active</span>
                  {:else if f.enabled}
                    <span class="badge badge--warn">Configured</span>
                  {:else}
                    <span class="badge badge--off">Off</span>
                  {/if}
                </td>
                <td data-label="Provider">
                  <div class="provider-cell">
                    <span class="provider-name">{f.provider}</span>
                    {#if f.url}
                      <span class="provider-url" title={f.url}>{f.url}</span>
                    {/if}
                  </div>
                </td>
                <td data-label="Model">
                  <code class="model-tag">{f.model}</code>
                  {#if f.key === 'embedding' && f.dimension}
                    <span class="dim-pill">{f.dimension}d</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      </Card>

      <!-- ── Vector store + pipeline ──────────────────────────────────────── -->
      <Card padding="md">
        <h2 class="panel-title">Vector Store &amp; Pipeline</h2>
        <div class="store-row">
          <div class="store-col">
            <span class="field-label">Store</span>
            <span class="store-value">
              <span class="status-dot sm" class:on={h.vectorStore?.active && h.vectorStore?.healthy} class:warn={h.vectorStore?.active && !h.vectorStore?.healthy}></span>
              {h.vectorStore?.displayName ?? '—'}
              {#if h.vectorStore?.active && !h.vectorStore?.healthy}
                <span class="badge badge--error">Unhealthy</span>
              {/if}
            </span>
          </div>
          <div class="store-col">
            <span class="field-label">Pending jobs</span>
            <span class="store-value" class:warn-text={h.pendingEmbeddingJobs > 50}>{h.pendingEmbeddingJobs ?? '—'}</span>
          </div>
          <div class="store-col">
            <span class="field-label">Last processed</span>
            <span class="store-value">{fmtDate(h.lastProcessedAt)}</span>
          </div>
        </div>
        {#if h.vectorStore?.lastError || h.recentErrorMessage}
          <div class="error-block">
            <span class="field-label">Recent error</span>
            <pre class="error-pre">{h.vectorStore?.lastError ?? h.recentErrorMessage}</pre>
          </div>
        {/if}
      </Card>

      <!-- ── Runtime feature flags ────────────────────────────────────────── -->
      {@const aiConfigured = h.intelligenceEnabled}
      <Card padding="md">
        <div class="card-head">
          <div>
            <h2 class="panel-title">Runtime Feature Flags</h2>
            <p class="panel-desc">Toggle capabilities without restarting the server</p>
          </div>
          {#if flagsSaved}<span class="saved-pill">Saved</span>{/if}
        </div>
        {#if !aiConfigured}
          <div class="unconfigured-note">Intelligence is not enabled — set <code>SETARA_INTELLIGENCE_ENABLED=true</code> to activate flags.</div>
        {/if}
        <div class="flags-list">
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
                disabled={flagsBusy || !aiConfigured}
                aria-pressed={localFlags[def.key]}
                aria-label="Toggle {def.label}"
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>
          {/each}
          {#if flagsError}<p class="flag-error">{flagsError}</p>{/if}
        </div>
      </Card>

      <!-- ── Actions ──────────────────────────────────────────────────────── -->
      <Card padding="md">
        <h2 class="panel-title">Actions</h2>
        <div class="actions-grid">
          <div class="action-block">
            <h3 class="action-title">Reindex Project</h3>
            <p class="action-desc">Queue all active scenarios in a project for AI embedding.</p>
            <div class="action-row">
              <input class="input" bind:value={reindexProjectKey} placeholder="Project key (e.g. PROJ)" />
              <Button variant="primary" size="sm" onclick={triggerReindex} disabled={reindexBusy || !reindexProjectKey.trim()}>
                {reindexBusy ? 'Queuing…' : 'Reindex'}
              </Button>
            </div>
            {#if reindexResult}<p class="action-result">{reindexResult}</p>{/if}
          </div>

          <div class="action-block">
            <h3 class="action-title">Create Search Index</h3>
            <p class="action-desc">Build the HNSW vector index after initial embedding is complete.</p>
            <div class="action-row">
              <Button variant="primary" size="sm" onclick={createIndex} disabled={createIndexBusy}>
                {createIndexBusy ? 'Creating…' : 'Create Index'}
              </Button>
            </div>
            {#if createIndexResult}<p class="action-result">{createIndexResult}</p>{/if}
          </div>
        </div>
      </Card>

    {:else if !data.error}
      <Card padding="md"><p class="empty-text">No health data available.</p></Card>
    {/if}
  {/if}
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .panel-title { font-size: 1rem; font-weight: 600; margin-bottom: 4px; color: var(--color-text); }
  .panel-desc { margin: 0 0 14px; font-size: 0.8rem; color: var(--color-text-muted); }
  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; text-align: center; padding: 20px; }

  .disabled-state { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 24px 16px; }
  .disabled-icon { width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); display: flex; align-items: center; justify-content: center; }
  .disabled-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
  .disabled-desc { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); max-width: 480px; line-height: 1.6; }

  /* Status bar */
  .status-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; border: 1px solid var(--color-border); }
  .status-bar--on { background: color-mix(in srgb, #16a34a, transparent 92%); border-color: color-mix(in srgb, #16a34a, transparent 75%); }
  .status-bar--off { background: var(--color-surface); }
  .status-bar code { font-size: 0.78rem; background: var(--color-bg); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--color-border); }

  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-text-muted); flex-shrink: 0; }
  .status-dot.on { background: #16a34a; box-shadow: 0 0 0 2px color-mix(in srgb, #16a34a, transparent 75%); }
  .status-dot.warn { background: var(--color-warning, #d97706); }
  .status-dot.sm { width: 7px; height: 7px; display: inline-block; }

  .feature-name { font-weight: 600; }

  .badge { font-size: 0.7rem; font-weight: 700; border-radius: 4px; padding: 2px 7px; white-space: nowrap; }
  .badge--active { background: color-mix(in srgb, #16a34a, transparent 88%); color: #16a34a; }
  .badge--warn   { background: color-mix(in srgb, #d97706, transparent 88%); color: #d97706; }
  .badge--off    { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .badge--error  { background: color-mix(in srgb, var(--color-danger), transparent 88%); color: var(--color-danger); }

  .provider-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .provider-name { font-weight: 500; color: var(--color-text); }
  .provider-url { font-size: 0.7rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .model-tag { font-size: 0.78rem; font-family: var(--font-mono, monospace); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; }
  .dim-pill { font-size: 0.7rem; font-weight: 700; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-radius: 4px; padding: 2px 6px; margin-left: 6px; }

  .store-row { display: flex; gap: 32px; flex-wrap: wrap; }
  .store-col { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .store-value { font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .warn-text { color: var(--color-warning, #d97706); }
  .error-block { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .error-pre { margin: 6px 0 0; font-size: 0.78rem; font-family: var(--font-mono, monospace); color: var(--color-danger); white-space: pre-wrap; word-break: break-all; }

  .card-head { margin-bottom: 14px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .saved-pill { font-size: 0.72rem; font-weight: 700; color: #16a34a; background: #dcfce7; border: 1px solid #86efac; border-radius: 4px; padding: 2px 8px; align-self: center; flex-shrink: 0; }
  .unconfigured-note { margin: 0 0 14px; font-size: 0.82rem; color: var(--color-text-muted); background: color-mix(in srgb, var(--color-warning, #d97706), transparent 90%); border: 1px solid color-mix(in srgb, var(--color-warning, #d97706), transparent 70%); border-radius: 6px; padding: 8px 12px; }
  .unconfigured-note code { font-size: 0.78rem; background: var(--color-bg); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--color-border); }

  .flags-list { display: grid; gap: 0; }
  .flag-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--color-border); }
  .flag-row:last-child { border-bottom: none; padding-bottom: 0; }
  .flag-row:first-child { padding-top: 0; }
  .flag-info { min-width: 0; }
  .flag-name { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 2px; }
  .flag-desc { display: block; font-size: 0.78rem; color: var(--color-text-muted); }
  .flag-error { margin: 10px 0 0; font-size: 0.82rem; color: var(--color-danger, #dc2626); }

  .toggle-btn { position: relative; flex-shrink: 0; width: 44px; height: 24px; border-radius: 12px; border: none; background: var(--color-border); cursor: pointer; transition: background 0.2s; padding: 0; }
  .toggle-btn.toggle-on { background: var(--color-accent); }
  .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; display: block; }
  .toggle-btn.toggle-on .toggle-thumb { transform: translateX(20px); }

  .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .action-block { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; }
  .action-title { font-size: 0.875rem; font-weight: 700; margin: 0 0 4px; }
  .action-desc { margin: 0 0 12px; font-size: 0.82rem; color: var(--color-text-muted); line-height: 1.5; }
  .action-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .action-result { margin: 10px 0 0; font-size: 0.82rem; color: var(--color-text-muted); }
  .input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; flex: 1; min-width: 120px; outline: none; transition: border-color 0.15s; }
  .input:focus { border-color: var(--color-accent); }

  @media (max-width: 640px) {
    .actions-grid { grid-template-columns: 1fr; }
    .store-row { gap: 16px; }
  }
</style>

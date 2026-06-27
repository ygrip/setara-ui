<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { isMockMode } from '$lib/mock/client';
  import { apiFetch } from '$lib/api/client';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();
  const isMock = isMockMode();

  interface AiFlags {
    smartSearch: boolean;
    smartSuggestion: boolean;
    duplicateAnalysis: boolean;
    smartReview: boolean;
    asa: boolean;
  }

  const defaultFlags: AiFlags = {
    smartSearch: false,
    smartSuggestion: false,
    duplicateAnalysis: false,
    smartReview: false,
    asa: false
  };

  const flagDefs: { key: keyof AiFlags; label: string; desc: string }[] = [
    { key: 'smartSearch', label: 'Smart Search', desc: 'Semantic scenario search using AI embeddings' },
    { key: 'smartSuggestion', label: 'Smart Suggestion', desc: 'AI-powered scenario suggestions for builds' },
    { key: 'duplicateAnalysis', label: 'Duplicate Analysis', desc: 'Detect near-duplicate scenarios in the repository' },
    { key: 'smartReview', label: 'Smart Review', desc: 'AI review summaries for builds, plans, and scenarios' },
    { key: 'asa', label: 'ASA', desc: 'Adaptive Setara Assistant runtime access' }
  ];

  let localFlags = $state<AiFlags>({ ...defaultFlags });
  let flagsBusy = $state(false);
  let flagsError = $state('');
  let flagsSaved = $state(false);

  let reindexProjectKey = $state('');
  let reindexBusy = $state(false);
  let reindexResult = $state('');
  let createIndexBusy = $state(false);
  let createIndexResult = $state('');

  $effect(() => {
    if (data.flags) localFlags = { ...defaultFlags, ...data.flags };
  });

  async function toggleFlag(key: keyof AiFlags, value: boolean) {
    const prev = localFlags[key];
    localFlags = { ...localFlags, [key]: value };
    flagsBusy = true;
    flagsError = '';
    flagsSaved = false;

    try {
      const res = await apiFetch('/api/admin/intelligence/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        flagsError = (json as { error?: string }).error ?? `Failed to update flag (HTTP ${res.status})`;
        localFlags = { ...localFlags, [key]: prev };
        return;
      }

      localFlags = { ...defaultFlags, ...(await res.json()) };
      flagsSaved = true;
      setTimeout(() => {
        flagsSaved = false;
      }, 2000);
    } catch (e) {
      flagsError = e instanceof Error ? e.message : 'Request failed';
      localFlags = { ...localFlags, [key]: prev };
    } finally {
      flagsBusy = false;
    }
  }

  async function triggerReindex() {
    const projectKey = reindexProjectKey.trim();
    if (!projectKey) return;

    reindexBusy = true;
    reindexResult = '';
    try {
      const res = await apiFetch(`/api/admin/intelligence/reindex?projectKey=${encodeURIComponent(projectKey)}`, {
        method: 'POST'
      });
      const json = await res.json().catch(() => ({}));
      reindexResult = res.ok
        ? `Queued ${json.queuedScenarios} scenarios for project ${json.projectKey}`
        : `Error: ${json.error ?? res.status}`;
    } catch (e) {
      reindexResult = `Error: ${e instanceof Error ? e.message : 'Request failed'}`;
    } finally {
      reindexBusy = false;
    }
  }

  async function createIndex() {
    createIndexBusy = true;
    createIndexResult = '';
    try {
      const res = await apiFetch('/api/admin/intelligence/create-index', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      createIndexResult = json.message ?? json.error ?? (res.ok ? 'Done' : `HTTP ${res.status}`);
      if (res.ok) invalidateAll();
    } catch (e) {
      createIndexResult = `Error: ${e instanceof Error ? e.message : 'Request failed'}`;
    } finally {
      createIndexBusy = false;
    }
  }

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString();
  }
</script>

<svelte:head>
  <title>Intelligence - Admin - Setara</title>
</svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if isMock}
    <Card padding="md">
      <div class="empty-state">
        <h2 class="panel-title">Not available in preview mode</h2>
        <p class="panel-desc">Intelligence requires a live backend with an embedding provider configured.</p>
      </div>
    </Card>
  {:else}
    {#if data.error}
      <AppAlert tone="error">{data.error}</AppAlert>
    {/if}

    {#if data.health}
      {@const h = data.health}
      {@const aiConfigured = h.intelligenceEnabled}

      <div class="status-bar" class:status-bar--on={h.intelligenceEnabled} class:status-bar--off={!h.intelligenceEnabled}>
        <span class="status-dot" class:on={h.intelligenceEnabled}></span>
        Intelligence is <strong>{h.intelligenceEnabled ? 'enabled' : 'disabled'}</strong>
        {#if !h.intelligenceEnabled}
          <span class="muted">set <code>SETARA_INTELLIGENCE_ENABLED=true</code> to activate</span>
        {/if}
      </div>

      <Card padding="md">
        <h2 class="panel-title">AI Features</h2>
        <p class="panel-desc">Provider and model configuration are supplied by environment variables.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {#each h.features ?? [] as f}
                <tr>
                  <td>{f.label}</td>
                  <td>
                    {#if f.active}
                      <span class="badge badge--active">Active</span>
                    {:else if f.enabled}
                      <span class="badge badge--warn">Configured</span>
                    {:else}
                      <span class="badge badge--off">Off</span>
                    {/if}
                  </td>
                  <td>{f.provider ?? '-'}</td>
                  <td><code>{f.model ?? '-'}</code></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="md">
        <h2 class="panel-title">Vector Store & Pipeline</h2>
        <div class="metrics-grid">
          <div>
            <span class="field-label">Store</span>
            <strong>{h.vectorStore?.displayName ?? '-'}</strong>
          </div>
          <div>
            <span class="field-label">Pending jobs</span>
            <strong>{h.pendingEmbeddingJobs ?? '-'}</strong>
          </div>
          <div>
            <span class="field-label">Last processed</span>
            <strong>{fmtDate(h.lastProcessedAt)}</strong>
          </div>
        </div>
        {#if h.vectorStore?.lastError || h.recentErrorMessage}
          <pre class="error-pre">{h.vectorStore?.lastError ?? h.recentErrorMessage}</pre>
        {/if}
      </Card>

      <Card padding="md">
        <div class="card-head">
          <div>
            <h2 class="panel-title">Runtime Feature Flags</h2>
            <p class="panel-desc">Toggle capabilities without restarting the server.</p>
          </div>
          {#if flagsSaved}<span class="saved-pill">Saved</span>{/if}
        </div>

        {#if !aiConfigured}
          <div class="unconfigured-note">Intelligence is not enabled. Set <code>SETARA_INTELLIGENCE_ENABLED=true</code> to activate flags.</div>
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

      <Card padding="md">
        <h2 class="panel-title">Actions</h2>
        <div class="actions-grid">
          <div class="action-block">
            <h3 class="action-title">Reindex Project</h3>
            <p class="action-desc">Queue all active scenarios in a project for AI embedding.</p>
            <div class="action-row">
              <input class="input" bind:value={reindexProjectKey} placeholder="Project key" />
              <Button variant="primary" size="sm" onclick={triggerReindex} disabled={reindexBusy || !reindexProjectKey.trim()}>
                {reindexBusy ? 'Queuing...' : 'Reindex'}
              </Button>
            </div>
            {#if reindexResult}<p class="action-result">{reindexResult}</p>{/if}
          </div>

          <div class="action-block">
            <h3 class="action-title">Create Search Index</h3>
            <p class="action-desc">Build the HNSW vector index after initial embedding is complete.</p>
            <Button variant="primary" size="sm" onclick={createIndex} disabled={createIndexBusy}>
              {createIndexBusy ? 'Creating...' : 'Create Index'}
            </Button>
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
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .panel-title { font-size: 1rem; font-weight: 700; margin: 0; }
  .panel-desc { margin: 4px 0 14px; color: var(--color-text-muted); font-size: 0.875rem; }
  .empty-state { display: grid; gap: 4px; }

  .status-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); font-size: 0.875rem; }
  .status-bar--on { border-color: color-mix(in srgb, #16a34a, transparent 65%); }
  .status-bar--off { border-color: color-mix(in srgb, #d97706, transparent 65%); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-text-muted); flex-shrink: 0; }
  .status-dot.on { background: #16a34a; box-shadow: 0 0 0 2px color-mix(in srgb, #16a34a, transparent 75%); }
  .muted { color: var(--color-text-muted); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--color-border); }
  th { color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; }

  .badge { font-size: 0.7rem; font-weight: 700; border-radius: 4px; padding: 2px 7px; white-space: nowrap; }
  .badge--active { background: color-mix(in srgb, #16a34a, transparent 88%); color: #16a34a; }
  .badge--warn { background: color-mix(in srgb, #d97706, transparent 88%); color: #d97706; }
  .badge--off { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

  .metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .metrics-grid > div { display: grid; gap: 4px; }
  .field-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); }
  .error-pre { margin: 14px 0 0; white-space: pre-wrap; word-break: break-word; color: var(--color-danger); font-size: 0.78rem; }

  .card-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .saved-pill { font-size: 0.72rem; font-weight: 700; color: #16a34a; background: #dcfce7; border: 1px solid #86efac; border-radius: 4px; padding: 2px 8px; align-self: start; }
  .unconfigured-note { margin-bottom: 14px; font-size: 0.82rem; color: var(--color-text-muted); background: color-mix(in srgb, #d97706, transparent 90%); border: 1px solid color-mix(in srgb, #d97706, transparent 70%); border-radius: 6px; padding: 8px 12px; }

  .flags-list { display: grid; }
  .flag-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--color-border); }
  .flag-row:last-child { border-bottom: none; padding-bottom: 0; }
  .flag-row:first-child { padding-top: 0; }
  .flag-name { display: block; font-size: 0.875rem; font-weight: 600; }
  .flag-desc { display: block; font-size: 0.78rem; color: var(--color-text-muted); }
  .flag-error { margin: 10px 0 0; font-size: 0.82rem; color: var(--color-danger, #dc2626); }
  .toggle-btn { position: relative; flex-shrink: 0; width: 44px; height: 24px; border-radius: 12px; border: none; background: var(--color-border); cursor: pointer; transition: background 0.2s; padding: 0; }
  .toggle-btn.toggle-on { background: var(--color-accent); }
  .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; display: block; }
  .toggle-btn.toggle-on .toggle-thumb { transform: translateX(20px); }

  .actions-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .action-block { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 14px; }
  .action-title { margin: 0 0 4px; font-size: 0.95rem; font-weight: 700; }
  .action-desc, .action-result, .empty-text { color: var(--color-text-muted); font-size: 0.85rem; }
  .action-row { display: flex; gap: 8px; align-items: center; }
  .input { min-width: 0; flex: 1; height: 34px; border: 1px solid var(--color-border); border-radius: 6px; padding: 0 10px; background: var(--color-surface); color: var(--color-text); }

  @media (max-width: 760px) {
    .metrics-grid, .actions-grid { grid-template-columns: 1fr; }
    .action-row { flex-direction: column; align-items: stretch; }
  }
</style>

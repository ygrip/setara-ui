<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { isMockMode } from '$lib/mock/client';
  import { apiFetch } from '$lib/api/client';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import DataTable from '$lib/components/DataTable.svelte';

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

  // ── ASA token budget admin ────────────────────────────────────────────────
  interface AsaSessionRow {
    sessionId: string;
    tokenBudget: number;
    tokensUsed: number;
    tokensReserved: number;
    tokensRemaining: number;
    resetAt: string;
    active: boolean;
  }
  interface AsaUser { id: string; email: string; displayName: string; }
  let asaUserId = $state('');
  let asaUserSearch = $state('');
  let asaSelectedLabel = $state('');
  let asaSessions = $state<AsaSessionRow[]>([]);
  let asaBusy = $state(false);
  let asaMsg = $state('');
  let asaError = $state('');
  let confirmReset = $state<{ kind: 'session' | 'user' | 'drop'; id: string; label: string } | null>(null);

  let filteredUsers = $derived.by<AsaUser[]>(() => {
    const list = (data.users ?? []) as AsaUser[];
    const q = asaUserSearch.trim().toLowerCase();
    const matches = q
      ? list.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : list;
    return matches.slice(0, 8);
  });

  function selectAsaUser(u: AsaUser) {
    asaUserId = u.id;
    asaSelectedLabel = `${u.displayName} (${u.email})`;
    asaUserSearch = '';
    void loadAsaSessions();
  }

  function clearAsaUser() {
    asaUserId = '';
    asaSelectedLabel = '';
    asaSessions = [];
    asaMsg = '';
    asaError = '';
  }

  async function doConfirmedReset() {
    if (!confirmReset) return;
    const c = confirmReset;
    confirmReset = null;
    if (c.kind === 'session') await resetAsaSession(c.id);
    else if (c.kind === 'drop') await dropAsaSession(c.id);
    else await resetAsaUser();
  }

  async function loadAsaSessions() {
    asaError = '';
    asaMsg = '';
    if (!asaUserId) { asaSessions = []; return; }
    asaBusy = true;
    try {
      const res = await apiFetch(`/api/admin/intelligence/asa/sessions?userId=${asaUserId}`);
      if (!res.ok) { asaError = `Failed to load sessions (HTTP ${res.status})`; asaSessions = []; return; }
      asaSessions = await res.json();
    } catch (e) {
      asaError = e instanceof Error ? e.message : 'Request failed';
    } finally {
      asaBusy = false;
    }
  }

  async function resetAsaSession(sessionId: string) {
    asaBusy = true; asaError = ''; asaMsg = '';
    try {
      const res = await apiFetch(`/api/admin/intelligence/asa/sessions/${sessionId}/reset`, { method: 'POST' });
      if (!res.ok) { asaError = await errText(res, 'Reset failed'); return; }
      asaMsg = 'Session budget reset.';
      await loadAsaSessions();
    } catch (e) {
      asaError = e instanceof Error ? e.message : 'Request failed';
    } finally {
      asaBusy = false;
    }
  }

  async function dropAsaSession(sessionId: string) {
    asaBusy = true; asaError = ''; asaMsg = '';
    try {
      const res = await apiFetch(`/api/admin/intelligence/asa/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) { asaError = await errText(res, 'Drop failed'); return; }
      asaMsg = 'Session dropped - all its messages and context were deleted.';
      await loadAsaSessions();
    } catch (e) {
      asaError = e instanceof Error ? e.message : 'Request failed';
    } finally {
      asaBusy = false;
    }
  }

  async function errText(res: Response, fallback: string): Promise<string> {
    const json = await res.json().catch(() => ({}));
    return (json as { error?: string }).error ?? `${fallback} (HTTP ${res.status})`;
  }

  async function resetAsaUser() {
    if (!asaUserId) return;
    asaBusy = true; asaError = ''; asaMsg = '';
    try {
      const res = await apiFetch(`/api/admin/intelligence/asa/users/${asaUserId}/reset`, { method: 'POST' });
      if (!res.ok) { asaError = await errText(res, 'Reset failed'); return; }
      const result = await res.json();
      asaMsg = result.sessionsReset > 0 ? 'Active session budget reset.' : 'No active session to reset.';
      await loadAsaSessions();
    } catch (e) {
      asaError = e instanceof Error ? e.message : 'Request failed';
    } finally {
      asaBusy = false;
    }
  }

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

  <div class="page-header">
    <div>
      <p class="page-subtitle">Configure AI capabilities, providers, and runtime features.</p>
    </div>
  </div>

  {#if isMock}
    <Card padding="md">
      <EmptyState
        title="Not available in preview mode"
        hint="Intelligence requires a live backend with an embedding provider configured."
        minHeight="260px"
      >
        <svg slot="icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </EmptyState>
    </Card>
  {:else}
    {#if data.error}
      <AppAlert tone="error">{data.error}</AppAlert>
    {/if}

    {#if data.health}
      {@const h = data.health}
      {@const aiConfigured = h.intelligenceEnabled}

      <div class="status-banner" class:status-banner--on={h.intelligenceEnabled} class:status-banner--off={!h.intelligenceEnabled}>
        <div class="status-banner__icon" aria-hidden="true">
          {#if h.intelligenceEnabled}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {/if}
        </div>
        <div class="status-banner__text">
          <strong>Intelligence is {h.intelligenceEnabled ? 'enabled' : 'disabled'}</strong>
          <span class="muted">
            {#if h.intelligenceEnabled}
              All configured features are ready to use.
            {:else}
              Set <code>SETARA_INTELLIGENCE_ENABLED=true</code> to activate.
            {/if}
          </span>
        </div>
      </div>

      <Card padding="md">
        <div class="panel-head">
          <span class="panel-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          </span>
          <h2 class="panel-title">AI Features</h2>
        </div>
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
        <div class="panel-head">
          <span class="panel-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14a8 3 0 0 0 16 0V5" /><path d="M4 12a8 3 0 0 0 16 0" /></svg>
          </span>
          <h2 class="panel-title">Vector Store & Pipeline</h2>
        </div>
        <p class="panel-desc">Current vector store and pipeline status.</p>
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
            <div class="panel-head">
              <span class="panel-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </span>
              <h2 class="panel-title">Runtime Feature Flags</h2>
            </div>
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
        <div class="panel-head">
          <span class="panel-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </span>
          <h2 class="panel-title">Actions</h2>
        </div>
        <div class="actions-grid">
          <div class="action-block">
            <h3 class="action-title">Reindex Project</h3>
            <p class="action-desc">Queue all active scenarios in a project for AI embedding.</p>
            <div class="action-row">
              <input class="input field-input" bind:value={reindexProjectKey} placeholder="Project key" />
              <Button variant="primary" size="sm" onclick={triggerReindex} disabled={reindexBusy || !reindexProjectKey.trim()}>
                {reindexBusy ? 'Queuing...' : 'Reindex'}
              </Button>
            </div>
            {#if reindexResult}<p class="action-result">{reindexResult}</p>{/if}
          </div>

          <div class="action-block">
            <h3 class="action-title">Create Search Index</h3>
            <p class="action-desc">Build the HNSW vector index after initial embedding is complete.</p>
            <div class="action-row">
            <Button variant="primary" size="sm" onclick={createIndex} disabled={createIndexBusy}>
              {createIndexBusy ? 'Creating...' : 'Create Index'}
            </Button>
            </div>
            {#if createIndexResult}<p class="action-result">{createIndexResult}</p>{/if}
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div class="panel-head">
          <span class="panel-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z" /></svg>
          </span>
          <h2 class="panel-title">ASA Token Budget</h2>
        </div>
        <p class="panel-desc">Reset the active ASA session's token budget, or drop a past session to permanently delete its messages and context. The active session can't be dropped.</p>

        {#if asaUserId}
          <div class="asa-selected">
            <span><strong>{asaSelectedLabel}</strong></span>
            <button type="button" class="link-btn" onclick={clearAsaUser}>Change user</button>
          </div>
        {:else}
          <div class="asa-picker">
            <input class="input field-input" placeholder="Search users by name or email…" bind:value={asaUserSearch} aria-label="Search users" />
            {#if asaUserSearch.trim()}
              <ul class="asa-results">
                {#each filteredUsers as u (u.id)}
                  <li>
                    <button type="button" class="asa-result" onclick={() => selectAsaUser(u)}>
                      {u.displayName} <span class="muted">{u.email}</span>
                    </button>
                  </li>
                {:else}
                  <li class="empty-text" style="padding:8px 10px">No matching users.</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        {#if asaError}<p class="flag-error">{asaError}</p>{/if}
        {#if asaMsg}<p class="action-result">{asaMsg}</p>{/if}

        {#if asaUserId}
          <div class="action-row">
            <Button variant="danger" size="sm" onclick={() => (confirmReset = { kind: 'user', id: asaUserId, label: asaSelectedLabel })} disabled={asaBusy}>
              Reset active session budget
            </Button>
          </div>
          {#if asaSessions.length === 0}
            {#if asaBusy}
              <p class="empty-text" style="margin-top:12px">Loading…</p>
            {:else}
              <EmptyState title="No ASA sessions" hint="This user has no active or past ASA sessions." minHeight="160px" />
            {/if}
          {:else}
            <div style="margin-top:12px">
              <DataTable>
                {#snippet head()}
                  <tr><th>Session</th><th>Status</th><th>Used / Budget</th><th>Reserved</th><th>Expires</th><th></th></tr>
                {/snippet}
                {#snippet body()}
                  {#each asaSessions as s (s.sessionId)}
                    <tr>
                      <td><code>{s.sessionId.slice(0, 8)}</code></td>
                      <td>{s.active ? 'Active' : 'Past'}</td>
                      <td>{s.tokensUsed} / {s.tokenBudget}</td>
                      <td>{s.tokensReserved}</td>
                      <td>{fmtDate(s.resetAt)}</td>
                      <td>
                        {#if s.active}
                          <Button variant="secondary" size="sm" onclick={() => (confirmReset = { kind: 'session', id: s.sessionId, label: s.sessionId.slice(0, 8) })} disabled={asaBusy}>
                            Reset
                          </Button>
                        {:else}
                          <Button variant="danger" size="sm" onclick={() => (confirmReset = { kind: 'drop', id: s.sessionId, label: s.sessionId.slice(0, 8) })} disabled={asaBusy}>
                            Drop
                          </Button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/snippet}
              </DataTable>
            </div>
          {/if}
        {/if}
      </Card>

      <Modal open={confirmReset !== null} title={confirmReset?.kind === 'drop' ? 'Drop ASA session' : 'Reset ASA token budget'} size="sm" onclose={() => (confirmReset = null)}>
        {#if confirmReset}
          <p class="confirm-text">
            {#if confirmReset.kind === 'user'}
              Reset the <strong>active</strong> ASA session budget for <strong>{confirmReset.label}</strong>? Consumed and reserved tokens return to zero. Past sessions are not affected.
            {:else if confirmReset.kind === 'drop'}
              Drop ASA session <code>{confirmReset.label}</code>? This <strong>permanently deletes</strong> the session and all its messages, reservations, and workflow context. This cannot be undone.
            {:else}
              Reset ASA session <code>{confirmReset.label}</code>? Its consumed and reserved tokens return to zero.
            {/if}
          </p>
          <div class="confirm-actions">
            <Button variant="secondary" size="sm" onclick={() => (confirmReset = null)}>Cancel</Button>
            <Button variant="danger" size="sm" onclick={doConfirmedReset} disabled={asaBusy}>{confirmReset.kind === 'drop' ? 'Drop' : 'Reset'}</Button>
          </div>
        {/if}
      </Modal>
    {:else if !data.error}
      <Card padding="md">
        <EmptyState title="No health data available" hint="Intelligence health metrics haven't loaded yet." minHeight="220px" />
      </Card>
    {/if}
  {/if}
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .page-subtitle { margin: 2px 0 0; color: var(--color-text-muted); font-size: 0.875rem; }
  .panel-title { font-size: 1rem; font-weight: 700; margin: 0; }
  .panel-desc { margin: 4px 0 14px; color: var(--color-text-muted); font-size: 0.875rem; }

  .page-header { display: flex; align-items: center; gap: 14px; }

  .panel-head { display: flex; align-items: center; gap: 8px; }
  .panel-icon {
    flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    color: var(--color-accent);
  }

  .status-banner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
  .status-banner--on { border-color: color-mix(in srgb, #16a34a, transparent 65%); background: color-mix(in srgb, #16a34a, transparent 94%); }
  .status-banner--off { border-color: color-mix(in srgb, #d97706, transparent 65%); background: color-mix(in srgb, #d97706, transparent 94%); }
  .status-banner__icon {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .status-banner--on .status-banner__icon { background: color-mix(in srgb, #16a34a, transparent 82%); color: #16a34a; }
  .status-banner--off .status-banner__icon { background: color-mix(in srgb, #d97706, transparent 82%); color: #d97706; }
  .status-banner__text { display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; }
  .status-banner__text strong { font-size: 0.95rem; }
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

  .actions-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 12px 4px; }
  .action-block { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 14px; }
  .action-title { margin: 0 0 4px; font-size: 0.95rem; font-weight: 700; }
  .action-desc, .action-result, .empty-text { color: var(--color-text-muted); font-size: 0.85rem; }
  .action-row { display: flex; gap: 8px; align-items: center; }
  .input { min-width: 0; flex: 1; height: 34px; border: 1px solid var(--color-border); border-radius: 6px; padding: 0 10px; background: var(--color-surface); color: var(--color-text); }

  .asa-picker { position: relative; }
  .asa-results { list-style: none; margin: 6px 0 0; padding: 4px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); max-height: 260px; overflow: auto; }
  .asa-result { width: 100%; text-align: left; background: none; border: none; border-radius: 4px; padding: 7px 10px; cursor: pointer; font-size: 0.85rem; color: var(--color-text); }
  .asa-result:hover { background: var(--color-accent-subtle); }
  .asa-result .muted { color: var(--color-text-muted); font-size: 0.78rem; }
  .asa-selected { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-size: 0.875rem; }
  .link-btn { background: none; border: none; color: var(--color-accent); cursor: pointer; font-size: 0.8rem; padding: 0; }
  .link-btn:hover { text-decoration: underline; }
  .confirm-text { margin: 0 0 16px; font-size: 0.9rem; line-height: 1.5; }
  .confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }

  .field-input { font: inherit; font-size: 0.875rem; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); width: 100%; box-sizing: border-box; }
  .field-input:focus { outline: none; border-color: var(--color-accent); }
  .action-row {
    display: flex; gap: 8px; align-items: center;
    flex-wrap: wrap;
    padding-top: 10px;
  }
  
  @media (max-width: 760px) {
    .metrics-grid, .actions-grid { grid-template-columns: 1fr; }
    .action-row { flex-direction: column; align-items: stretch; gap: 10px; }
  }

  @media (max-width: 600px) {
    .action-block { padding: 16px; }
    .asa-picker, .asa-selected { margin-bottom: 6px; }
    .asa-results { max-height: 200px; }
  }
</style>

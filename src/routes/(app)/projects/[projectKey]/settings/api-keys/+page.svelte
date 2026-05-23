<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createApiKey, revokeApiKey, rotateApiKey, type ApiKey } from '$lib/api/apikeys';

  let { data } = $props();

  let showModal = $state(false);
  let creating = $state(false);
  let keyError = $state('');
  let newKeyName = $state('');
  let newKeyScopes = $state('automation:write');
  let revealedKey = $state('');

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    creating = true;
    keyError = '';
    try {
      const result = await createApiKey(data.projectKey, {
        name: newKeyName.trim(),
        scopes: newKeyScopes.split(',').map((s: string) => s.trim()).filter(Boolean)
      });
      revealedKey = result.rawKey;
      newKeyName = '';
      await invalidateAll();
    } catch (err) {
      keyError = (err as Error).message;
    } finally {
      creating = false;
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await revokeApiKey(data.projectKey, keyId);
      await invalidateAll();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleRotate(keyId: string) {
    if (!confirm('Rotate this API key? The old key will stop working immediately.')) return;
    try {
      const result = await rotateApiKey(data.projectKey, keyId);
      revealedKey = result.rawKey;
      showModal = true;
      await invalidateAll();
    } catch (err) {
      alert((err as Error).message);
    }
  }
</script>

<svelte:head>
  <title>API Keys — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/settings">Settings</a>
    <span class="sep">›</span>
    <span>API Keys</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">API Keys</h1>
      <p class="page-sub">Keys used by automation runners to submit execution results</p>
    </div>
    <Button variant="primary" onclick={() => { showModal = true; revealedKey = ''; }}>+ New Key</Button>
  </div>

  <div class="security-note">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>Raw keys are shown <strong>once</strong> at creation. Store them securely in your CI secrets.</span>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load API keys — {data.error}</div>
  {:else if data.apiKeys.length === 0}
    <div class="empty-state">
      <p>No API keys yet. Create one to allow automation runners to submit results.</p>
    </div>
  {:else}
    <DataTable>
      {#snippet head()}
        <tr>
          <th>Name</th>
          <th>Prefix</th>
          <th>Scopes</th>
          <th>Status</th>
          <th>Created</th>
          <th>Last Used</th>
          <th>Actions</th>
        </tr>
      {/snippet}
      {#snippet body()}
        {#each data.apiKeys as key}
          <tr>
            <td class="bold">{key.name}</td>
            <td class="mono">{key.keyPrefix}…</td>
            <td class="scopes">{key.scopes}</td>
            <td>
              {#if key.revokedAt}
                <Badge text="Revoked" variant="danger" />
              {:else}
                <Badge text="Active" variant="success" />
              {/if}
            </td>
            <td>{formatDate(key.createdAt)}</td>
            <td>—</td>
            <td>
              {#if !key.revokedAt}
                <div class="row-actions">
                  <Button variant="secondary" size="sm" onclick={() => handleRotate(key.id)}>Rotate</Button>
                  <Button variant="danger" size="sm" onclick={() => handleRevoke(key.id)}>Revoke</Button>
                </div>
              {/if}
            </td>
          </tr>
        {/each}
      {/snippet}
    </DataTable>
  {/if}
</div>

<Modal
  open={showModal}
  title={revealedKey ? 'Key Created — Save It Now' : 'New API Key'}
  onclose={() => { showModal = false; revealedKey = ''; }}
>
  {#if revealedKey}
    <div class="key-reveal">
      <div class="key-warning">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
        </svg>
        This key will not be shown again. Copy it now.
      </div>
      <div class="key-box">{revealedKey}</div>
      <Button variant="secondary" onclick={() => navigator.clipboard.writeText(revealedKey)}>
        Copy to Clipboard
      </Button>
    </div>
  {:else}
    <form onsubmit={handleCreate} class="form">
      <label class="field">
        <span class="label">Name <span class="req">*</span></span>
        <input class="input" type="text" bind:value={newKeyName} required placeholder="e.g. CI Pipeline Key"/>
      </label>
      <label class="field">
        <span class="label">Scopes</span>
        <input class="input" type="text" bind:value={newKeyScopes} placeholder="automation:write"/>
        <span class="hint">Comma-separated. Default: automation:write</span>
      </label>
      {#if keyError}
        <div class="form-error">{keyError}</div>
      {/if}
      <div class="form-actions">
        <Button variant="secondary" onclick={() => showModal = false}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create Key'}
        </Button>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .page { max-width: 1000px; }

  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  .page-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 16px;
    margin-bottom: 20px; flex-wrap: wrap;
  }

  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-sub { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

  .security-note {
    display: flex; align-items: center; gap: 8px;
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 10px 14px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 24px;
  }

  .error-banner {
    background: #fee2e2; color: var(--color-danger);
    border: 1px solid #fecaca; border-radius: var(--radius);
    padding: 12px 16px; font-size: 0.875rem;
  }

  .empty-state {
    color: var(--color-text-muted); font-size: 0.875rem; padding: 20px 0;
  }

  .bold { font-weight: 500; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .scopes { font-size: 0.8rem; color: var(--color-text-muted); }
  .row-actions { display: flex; gap: 6px; }

  /* Form */
  .form { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }
  .req { color: var(--color-danger); }
  .hint { font-size: 0.72rem; color: var(--color-text-muted); }
  .input {
    padding: 8px 10px; border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-bg);
    color: var(--color-text); font-size: 0.875rem; outline: none;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: var(--color-accent); }
  .form-error {
    background: #fee2e2; color: var(--color-danger);
    border: 1px solid #fecaca; border-radius: 6px;
    padding: 8px 12px; font-size: 0.8rem;
  }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

  .key-reveal { display: flex; flex-direction: column; gap: 12px; }
  .key-warning {
    display: flex; align-items: center; gap: 8px;
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: var(--radius); padding: 10px 12px;
    font-size: 0.8rem; color: #92400e; font-weight: 500;
  }
  .key-box {
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: 6px; padding: 12px;
    font-family: ui-monospace, monospace; font-size: 0.8rem;
    word-break: break-all; color: var(--color-text);
    user-select: all;
  }
</style>

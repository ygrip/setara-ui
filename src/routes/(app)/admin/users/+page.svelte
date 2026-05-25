<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import { assignProjectRole } from '$lib/api/organization';

  let { data } = $props();
  let projectKey = $state('');
  let email = $state('');
  let role = $state<'QA' | 'VIEWER' | 'ADMIN'>('VIEWER');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  async function submitRole(e: SubmitEvent) {
    e.preventDefault();
    if (!projectKey.trim() || !email.trim()) return;
    busy = true;
    error = '';
    message = '';
    try {
      await assignProjectRole(projectKey.trim().toUpperCase(), { email: email.trim(), role });
      message = `${role} role assigned to ${email.trim()} for ${projectKey.trim().toUpperCase()}.`;
      email = '';
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Users — Admin — Setara</title>
</svelte:head>

<div class="section-wrap">
  {#if data.error}
    <div class="error-banner">Could not connect to backend — {data.error}</div>
  {/if}
  {#if error}<div class="error-banner">{error}</div>{/if}
  {#if message}<div class="success-banner">{message}</div>{/if}

  <form class="panel role-panel" onsubmit={submitRole}>
    <div>
      <h2 class="panel-title">Assign Project Role</h2>
      <p class="panel-subtitle">New sign-ins start as guests. Admins grant project access here.</p>
    </div>
    <label>
      <span>Project key</span>
      <input bind:value={projectKey} placeholder="PAYMENT" required />
    </label>
    <label>
      <span>User email</span>
      <input type="email" bind:value={email} placeholder="qa@example.com" required />
    </label>
    <label>
      <span>Role</span>
      <select bind:value={role}>
        <option value="VIEWER">Viewer</option>
        <option value="QA">QA</option>
        <option value="ADMIN">Admin</option>
      </select>
    </label>
    <button class="primary-btn" type="submit" disabled={busy || !projectKey.trim() || !email.trim()}>
      {busy ? 'Assigning...' : 'Assign Role'}
    </button>
  </form>

  <div class="panel">
    <h2 class="panel-title">Users</h2>
    {#if data.users.length === 0}
      <p class="empty-text">No users yet.</p>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Email</th>
            <th>Display Name</th>
            <th>Created</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each data.users as user}
            <tr>
              <td>{user.email}</td>
              <td class="bold">{user.displayName}</td>
              <td>{formatDate(user.createdAt)}</td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </div>
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
  }

  .success-banner {
    background: color-mix(in srgb, var(--color-success), transparent 90%);
    color: var(--color-success);
    border: 1px solid color-mix(in srgb, var(--color-success), transparent 70%);
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
  }

  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }

  .panel-subtitle {
    margin: -8px 0 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .role-panel {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(130px, 0.55fr) minmax(220px, 0.9fr) minmax(120px, 0.45fr) auto;
    align-items: end;
    gap: 12px;
  }

  label {
    display: grid;
    gap: 5px;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  input,
  select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 9px 10px;
    font: inherit;
  }

  button {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    padding: 9px 12px;
    font: inherit;
    cursor: pointer;
  }

  .primary-btn {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @media (max-width: 980px) {
    .role-panel {
      grid-template-columns: 1fr;
    }
  }

  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; }
  .bold { font-weight: 500; }
</style>

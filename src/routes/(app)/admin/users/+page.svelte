<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { createUser } from '$lib/api/organization';

  let { data } = $props();

  let newUserEmail = $state('');
  let newUserDisplay = $state('');
  let creatingUser = $state(false);
  let userError = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  async function handleCreateUser(e: SubmitEvent) {
    e.preventDefault();
    creatingUser = true;
    userError = '';
    try {
      await createUser({ email: newUserEmail.trim(), displayName: newUserDisplay.trim() });
      newUserEmail = '';
      newUserDisplay = '';
      await invalidateAll();
    } catch (err) {
      userError = (err as Error).message;
    } finally {
      creatingUser = false;
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

  <div class="panel">
    <h2 class="panel-title">New User</h2>
    <form onsubmit={handleCreateUser} class="form">
      <label class="field">
        <span class="label">Email <span class="req">*</span></span>
        <input class="input" type="email" bind:value={newUserEmail} required placeholder="user@example.com"/>
      </label>
      <label class="field">
        <span class="label">Display Name <span class="req">*</span></span>
        <input class="input" type="text" bind:value={newUserDisplay} required placeholder="Jane Smith"/>
      </label>
      {#if userError}
        <div class="form-error">{userError}</div>
      {/if}
      <div>
        <Button variant="primary" type="submit" disabled={creatingUser}>
          {creatingUser ? 'Creating…' : 'Create User'}
        </Button>
      </div>
    </form>
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

  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; }

  .form { display: flex; flex-direction: column; gap: 14px; max-width: 360px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }
  .req { color: var(--color-danger); }

  .input {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .input:focus { border-color: var(--color-accent); }

  .form-error {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.8rem;
  }

  .bold { font-weight: 500; }
</style>

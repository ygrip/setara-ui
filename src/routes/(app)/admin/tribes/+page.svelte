<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { createTribe } from '$lib/api/organization';

  let { data } = $props();

  let newTribeName = $state('');
  let creatingTribe = $state(false);
  let tribeError = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  async function handleCreateTribe(e: SubmitEvent) {
    e.preventDefault();
    creatingTribe = true;
    tribeError = '';
    try {
      await createTribe({ name: newTribeName.trim() });
      newTribeName = '';
      await invalidateAll();
    } catch (err) {
      tribeError = (err as Error).message;
    } finally {
      creatingTribe = false;
    }
  }
</script>

<svelte:head>
  <title>Tribes — Admin — Setara</title>
</svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Administration</h1>

  {#if data.error}
    <div class="error-banner">Could not connect to backend — {data.error}</div>
  {/if}

  <div class="panel">
    <h2 class="panel-title">Tribes</h2>
    {#if data.tribes.length === 0}
      <p class="empty-text">No tribes yet.</p>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th>Created</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each data.tribes as tribe}
            <tr>
              <td class="bold">{tribe.name}</td>
              <td class="mono muted">{tribe.id.slice(0, 8)}…</td>
              <td>{formatDate(tribe.createdAt)}</td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </div>

  <div class="panel">
    <h2 class="panel-title">New Tribe</h2>
    <form onsubmit={handleCreateTribe} class="inline-form">
      <input class="input" type="text" bind:value={newTribeName} required placeholder="Tribe name" />
      <Button variant="primary" type="submit" disabled={creatingTribe}>
        {creatingTribe ? 'Creating…' : 'Create'}
      </Button>
    </form>
    {#if tribeError}
      <div class="form-error">{tribeError}</div>
    {/if}
  </div>
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }

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

  .inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .inline-form .input { flex: 1; min-width: 200px; }

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
    margin-top: 8px;
  }

  .bold { font-weight: 500; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .muted { color: var(--color-text-muted); }
</style>

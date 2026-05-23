<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { listSquads, createSquad, type Squad } from '$lib/api/organization';

  let { data } = $props();

  let selectedTribeId = $state('');
  let squads = $state<Squad[]>([]);
  let loadingSquads = $state(false);
  let squadSortBy = $state('name');
  let squadSortDir = $state('asc');
  let newSquadName = $state('');
  let creatingSquad = $state(false);
  let squadError = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  async function loadSquadList() {
    if (!selectedTribeId) { squads = []; return; }
    loadingSquads = true;
    try {
      const result = await listSquads(selectedTribeId, undefined, undefined, squadSortBy, squadSortDir);
      squads = result.items;
    } catch {
      squads = [];
    } finally {
      loadingSquads = false;
    }
  }

  async function sortSquads(field: string) {
    squadSortDir = squadSortBy === field && squadSortDir === 'asc' ? 'desc' : 'asc';
    squadSortBy = field;
    await loadSquadList();
  }

  function indicator(field: string): string {
    if (squadSortBy !== field) return '';
    return squadSortDir === 'asc' ? '↑' : '↓';
  }

  async function handleCreateSquad(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedTribeId) return;
    creatingSquad = true;
    squadError = '';
    try {
      await createSquad(selectedTribeId, { name: newSquadName.trim() });
      newSquadName = '';
      await loadSquadList();
    } catch (err) {
      squadError = (err as Error).message;
    } finally {
      creatingSquad = false;
    }
  }
</script>

<svelte:head>
  <title>Squads — Admin — Setara</title>
</svelte:head>

<div class="section-wrap">
  {#if data.error}
    <div class="error-banner">Could not connect to backend — {data.error}</div>
  {/if}

  <div class="panel">
    <h2 class="panel-title">Squads</h2>

    <div class="tribe-selector">
      <label class="label" for="tribe-select">Select Tribe</label>
      <select id="tribe-select" class="input select"
        bind:value={selectedTribeId}
        onchange={loadSquadList}
      >
        <option value="">— Choose a tribe —</option>
        {#each data.tribes as tribe}
          <option value={tribe.id}>{tribe.name}</option>
        {/each}
      </select>
    </div>

    {#if selectedTribeId}
      {#if loadingSquads}
        <p class="muted-text">Loading squads…</p>
      {:else if squads.length === 0}
        <p class="empty-text">No squads in this tribe yet.</p>
      {:else}
        <DataTable>
          {#snippet head()}
            <tr>
              <th><button class="sort-button" onclick={() => sortSquads('name')}>Name <span class="sort-indicator">{indicator('name')}</span></button></th>
              <th>ID</th>
              <th><button class="sort-button" onclick={() => sortSquads('createdAt')}>Created <span class="sort-indicator">{indicator('createdAt')}</span></button></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each squads as squad}
              <tr>
                <td class="bold">{squad.name}</td>
                <td class="mono muted">{squad.id.slice(0, 8)}…</td>
                <td>{formatDate(squad.createdAt)}</td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      {/if}

      <div class="panel panel--sub">
        <h3 class="panel-subtitle">New Squad</h3>
        <form onsubmit={handleCreateSquad} class="inline-form">
          <input class="input" type="text" bind:value={newSquadName} required placeholder="Squad name" />
          <Button variant="primary" type="submit" disabled={creatingSquad}>
            {creatingSquad ? 'Creating…' : 'Create'}
          </Button>
        </form>
        {#if squadError}
          <div class="form-error">{squadError}</div>
        {/if}
      </div>
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

  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .panel--sub {
    margin-top: 16px;
    background: var(--color-bg);
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }

  .panel-subtitle {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--color-text);
  }

  .tribe-selector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
    max-width: 320px;
  }

  .label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }

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
  .select { cursor: pointer; }

  .inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .inline-form .input { flex: 1; min-width: 200px; }

  .form-error {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.8rem;
    margin-top: 8px;
  }

  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; }
  .muted-text { color: var(--color-text-muted); font-size: 0.875rem; }
  .bold { font-weight: 500; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .muted { color: var(--color-text-muted); }
</style>

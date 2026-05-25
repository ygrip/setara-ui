<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';

  let { data } = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
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
  .bold { font-weight: 500; }
</style>

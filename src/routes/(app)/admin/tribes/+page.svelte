<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createTribe, updateTribe, deleteTribe, getTribe, searchUsers, type Tribe, type TribeDetail, type UserDetail } from '$lib/api/organization';

  let { data } = $props();

  let newTribeName = $state('');
  let creatingTribe = $state(false);
  let error = $state('');

  // Edit modal
  let editOpen = $state(false);
  let editingTribe = $state<TribeDetail | null>(null);
  let editName = $state('');
  let editDesc = $state('');
  let editLeadId = $state<string | null>(null);
  let userSearch = $state('');
  let userResults = $state<UserDetail[]>([]);
  let saving = $state(false);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleCreateTribe(e: SubmitEvent) {
    e.preventDefault();
    creatingTribe = true; error = '';
    try { await createTribe({ name: newTribeName.trim() }); newTribeName = ''; await invalidateAll(); }
    catch (err) { error = (err as Error).message; }
    finally { creatingTribe = false; }
  }

  async function openEdit(tribe: Tribe) {
    try {
      const detail = await getTribe(tribe.id);
      editingTribe = detail;
    } catch {
      editingTribe = { ...tribe, description: null, leadId: null, leadName: null, updatedAt: tribe.createdAt };
    }
    editName = editingTribe!.name;
    editDesc = editingTribe!.description ?? '';
    editLeadId = editingTribe!.leadId;
    userSearch = '';
    userResults = [];
    editOpen = true;
  }

  async function searchUsersForLead(q: string) {
    userSearch = q;
    if (q.length < 2) { userResults = []; return; }
    try { const page = await searchUsers(q); userResults = page.items; }
    catch { userResults = []; }
  }

  async function handleSaveEdit() {
    if (!editingTribe || saving) return;
    saving = true; error = '';
    try {
      await updateTribe(editingTribe.id, { name: editName, description: editDesc || null, leadId: editingTribe.leadId });
      editOpen = false;
      await invalidateAll();
    } catch (err) { error = (err as Error).message; }
    finally { saving = false; }
  }

  async function handleDelete(tribe: Tribe) {
    if (!confirm(`Delete tribe "${tribe.name}"? Squads under it will have no tribe.`)) return;
    try { await deleteTribe(tribe.id); await invalidateAll(); }
    catch (err) { error = (err as Error).message; }
  }
</script>

<svelte:head><title>Tribes — Admin — Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if data.error}<div class="error-banner">Could not connect to backend — {data.error}</div>{/if}
  {#if error}<div class="error-banner">{error}</div>{/if}

  <div class="panel">
    <h2 class="panel-title">Tribes</h2>
    {#if data.tribes.length === 0}
      <p class="empty-text">No tribes yet.</p>
    {:else}
      <DataTable mobileCards>
        {#snippet head()}
          <tr><th>Name</th><th>Created</th><th></th></tr>
        {/snippet}
        {#snippet body()}
          {#each data.tribes as tribe}
            <tr>
              <td data-label="Name" class="bold">{tribe.name}</td>
              <td data-label="Created">{formatDate(tribe.createdAt)}</td>
              <td data-label="">
                <button class="action-btn" onclick={() => openEdit(tribe)} title="Edit">✎</button>
                <button class="action-btn danger" onclick={() => handleDelete(tribe)} title="Delete">✕</button>
              </td>
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
      <Button variant="primary" type="submit" disabled={creatingTribe}>{creatingTribe ? 'Creating…' : 'Create'}</Button>
    </form>
  </div>
</div>

<Modal open={editOpen} title="Edit Tribe" size="md" onclose={() => editOpen = false}>
  <div class="modal-body">
    <label class="field"><span>Name</span><input class="input" bind:value={editName} /></label>
    <label class="field"><span>Description</span><textarea class="input" bind:value={editDesc} rows={2}></textarea></label>
    <label class="field">
      <span>Lead — {editingTribe?.leadName ?? 'None'}</span>
      <input class="input" placeholder="Search user…" value={userSearch} oninput={(e) => searchUsersForLead((e.target as HTMLInputElement).value)} />
      {#if userResults.length > 0}
        <div class="user-pick-list">
          {#each userResults as u}
            <button class="user-pick" class:selected={editingTribe?.leadId === u.id} onclick={() => { if (editingTribe) editingTribe.leadId = u.id; editingTribe!.leadName = u.displayName; userResults = []; userSearch = u.displayName; }}>
              <strong>{u.displayName}</strong> <span class="muted">{u.email}</span>
            </button>
          {/each}
        </div>
      {/if}
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick={() => editOpen = false}>Cancel</button>
      <button class="btn-submit" onclick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
</Modal>

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

  .bold { font-weight: 500; }
  .muted { color: var(--color-text-muted); }

  .action-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 4px;
    border: 1px solid var(--color-border); background: var(--color-bg);
    color: var(--color-text-muted); cursor: pointer; font-size: 0.8rem;
    transition: border-color 0.15s, color 0.15s;
  }
  .action-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .action-btn.danger:hover { border-color: var(--color-danger); color: var(--color-danger); }

  .modal-body { display: flex; flex-direction: column; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
  .field .input, .field textarea { font-weight: 400; }
  .user-pick-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px; }
  .user-pick { display: flex; gap: 8px; padding: 6px 10px; border: none; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 0.82rem; text-align: left; }
  .user-pick:hover { background: var(--color-accent-subtle); }
  .user-pick.selected { background: var(--color-accent-subtle); color: var(--color-accent); font-weight: 600; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; }
  .btn-cancel { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.82rem; cursor: pointer; }
  .btn-submit { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--color-accent); background: var(--color-accent); color: #fff; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
  .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

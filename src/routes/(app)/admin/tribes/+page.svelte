<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createTribe, updateTribe, deleteTribe, getTribe, listTribes, searchUsers, type Tribe, type TribeDetail, type UserDetail } from '$lib/api/organization';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data } = $props();

  let tribes = $state<Tribe[]>([]);
  let newTribeName = $state('');
  let creatingTribe = $state(false);
  let error = $state('');
  let searchQ = $state('');
  let searching = $state(false);
  let sortBy = $state<'name' | 'createdAt'>('name');
  let sortDir = $state<'asc' | 'desc'>('asc');

  let sortedTribes = $derived([...tribes].sort((a, b) => {
    const v = sortBy === 'name' ? a.name.localeCompare(b.name) : a.createdAt.localeCompare(b.createdAt);
    return sortDir === 'asc' ? v : -v;
  }));

  function toggleSort(field: 'name' | 'createdAt') {
    if (sortBy === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = field; sortDir = 'asc'; }
  }

  $effect(() => {
    tribes = data.tribes ?? [];
  });

  let createOpen = $state(false);
  let createDesc = $state('');
  let creatingTribeDetail = $state<TribeDetail | null>(null);
  let createUserSearch = $state('');
  let createUserResults = $state<UserDetail[]>([]);

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

  async function refreshTribes() {
    const result = await listTribes(undefined, undefined, data.sortBy, data.sortDir, searchQ.trim() || undefined);
    tribes = result.items;
  }

  async function handleSearch() {
    searching = true; error = '';
    try { await refreshTribes(); }
    catch (err) { error = (err as Error).message; }
    finally { searching = false; }
  }

  async function handleCreateTribe() {
    creatingTribe = true; error = '';
    try {
      await createTribe({
        name: newTribeName.trim(),
        description: createDesc.trim() || undefined,
        leadId: creatingTribeDetail?.leadId?.trim() || undefined
      });
      await refreshTribes();
      createOpen = false;
      newTribeName = '';
      createDesc = '';
      creatingTribeDetail = null;
      createUserSearch = '';
      createUserResults = [];
      await invalidateAll();
    }
    catch (err) { error = (err as Error).message; }
    finally { creatingTribe = false; }
  }

  async function openCreate() {
    createOpen = true;
    creatingTribeDetail = { id: '', name: '', description: null, leadId: null, leadName: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    createDesc = '';
    createUserSearch = '';
    createUserResults = [];
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

  async function searchUsersForCreateLead(q: string) {
    createUserSearch = q;
    if (q.length < 2) { createUserResults = []; return; }
    try { const page = await searchUsers(q); createUserResults = page.items; }
    catch { createUserResults = []; }
  }

  async function handleSaveEdit() {
    if (!editingTribe || saving) return;
    saving = true; error = '';
    try {
      await updateTribe(editingTribe.id, { name: editName, description: editDesc || null, leadId: editLeadId });
      await refreshTribes();
      editOpen = false;
      await invalidateAll();
    } catch (err) { error = (err as Error).message; }
    finally { saving = false; }
  }

  // Delete confirmation modal
  let deleteOpen = $state(false);
  let deletingTribe = $state<Tribe | null>(null);
  let deleting = $state(false);

  function openDelete(tribe: Tribe) {
    deletingTribe = tribe;
    deleteOpen = true;
  }

  async function handleConfirmDelete() {
    if (!deletingTribe || deleting) return;
    deleting = true; error = '';
    try { await deleteTribe(deletingTribe.id); await refreshTribes(); deleteOpen = false; await invalidateAll(); }
    catch (err) { error = (err as Error).message; }
    finally { deleting = false; }
  }
</script>

<svelte:head><title>Tribes - Admin - Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if data.error}<AppAlert tone="error" title="Could not connect to backend">{data.error}</AppAlert>{/if}
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}

  <div class="page-header">
    <div>
      <p class="page-sub">Manage tribes - assign tribe lead.</p>
    </div>
    <Button variant="primary" size="sm" onclick={() => openCreate()}>Create Tribe</Button>
  </div>

  <div class="search-bar">
    <div class="search-wrap">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input
        class="search-input"
        type="search"
        bind:value={searchQ}
        placeholder="Search by name…"
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
    </div>
    <Button variant="primary" size="sm" onclick={handleSearch} disabled={searching}>{searching ? 'Searching…' : 'Search'}</Button>
    {#if searchQ}
      <Button variant="secondary" size="sm" onclick={() => { searchQ = ''; handleSearch(); }}>Clear</Button>
    {/if}
  </div>

  <Card padding="md">
    <h2 class="panel-title">Tribes</h2>
    {#if tribes.length === 0}
      <EmptyState title="No tribes yet" hint="Tribes you create will show up here." minHeight="240px">
        <svg slot="icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
          <path d="M3.5 8 6 3h12l2.5 5" />
          <path d="M3 8h5.5l1 2h5l1-2H21" />
        </svg>
      </EmptyState>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th><button class="sort-btn" onclick={() => toggleSort('name')}>Name {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▽') : '⇅'}</button></th>
            <th><button class="sort-btn" onclick={() => toggleSort('createdAt')}>Created {sortBy === 'createdAt' ? (sortDir === 'asc' ? '▲' : '▽') : '⇅'}</button></th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each sortedTribes as tribe}
            <tr>
              <td data-label="Name" class="bold">{tribe.name}</td>
              <td data-label="Created">{formatDate(tribe.createdAt)}</td>
              <td data-label="">
                <Button variant="ghost" iconOnly onclick={() => openEdit(tribe)} title="Edit" ariaLabel="Edit tribe">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L5.333 13.333 2 14l.667-3.333L11.333 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </Button>
                <Button variant="danger" iconOnly onclick={() => openDelete(tribe)} title="Delete" ariaLabel="Delete tribe">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333A1.333 1.333 0 0 1 11.333 14.667H4.667A1.333 1.333 0 0 1 3.333 13.333V4h9.334z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </Button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </Card>
</div>

<Modal open={createOpen} title="Create Tribe" size="sm" onclose={() => createOpen = false}>
  <div class="modal-body">
    {#if error}<div class="toast toast--error">{error}</div>{/if}
    <label class="field" for="ct-name"><span>Tribe Name</span>
      <input id="ct-name" class="input" type="text" bind:value={newTribeName} placeholder="Tribe name" required />
    </label>
    <label class="field"><span>Description</span>
      <textarea class="input" bind:value={createDesc} rows={2}></textarea>
    </label>
    <label class="field">
      <span>Lead - {creatingTribeDetail?.leadName ?? 'None'}</span>
      <input class="input" placeholder="Search user…" value={createUserSearch} oninput={(e) => searchUsersForCreateLead((e.target as HTMLInputElement).value)} />
      {#if createUserResults.length > 0}
        <div class="user-pick-list">
          {#each createUserResults as u}
            <button class="user-pick" class:selected={creatingTribeDetail?.leadId === u.id} onclick={() => { if (creatingTribeDetail) creatingTribeDetail.leadId = u.id; creatingTribeDetail!.leadName = u.displayName; createUserResults = []; createUserSearch = u.displayName; }}>
              <strong>{u.displayName}</strong> <span class="muted">{u.email}</span>
            </button>
          {/each}
        </div>
      {/if}
    </label>
    <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
      <Button variant="secondary" size="sm" onclick={() => createOpen = false}>Cancel</Button>
      <Button variant="primary" type="submit" size="sm" onclick={handleCreateTribe} disabled={creatingTribe || !newTribeName.trim()}>{creatingTribe ? 'Creating…' : 'Create'}</Button>
    </div>
  </div>
</Modal>

<Modal open={deleteOpen} title="Delete Tribe" size="sm" onclose={() => deleteOpen = false}>
  <div class="modal-body">
    <p class="delete-warning">Delete tribe <strong>"{deletingTribe?.name}"</strong>? Squads under it will have no tribe.</p>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => deleteOpen = false}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
    </div>
  </div>
</Modal>

<Modal open={editOpen} title="Edit Tribe" size="md" onclose={() => editOpen = false}>
  <div class="modal-body">
    <label class="field"><span>Name</span><input class="input" bind:value={editName} /></label>
    <label class="field"><span>Description</span><textarea class="input" bind:value={editDesc} rows={2}></textarea></label>
    <label class="field">
      <span>Lead - {editingTribe?.leadName ?? 'None'}</span>
      <input class="input" placeholder="Search user…" value={userSearch} oninput={(e) => searchUsersForLead((e.target as HTMLInputElement).value)} />
      {#if userResults.length > 0}
        <div class="user-pick-list">
          {#each userResults as u}
            <button class="user-pick" class:selected={editLeadId === u.id} onclick={() => { editLeadId = u.id; if (editingTribe) editingTribe.leadName = u.displayName; userResults = []; userSearch = u.displayName; }}>
              <strong>{u.displayName}</strong> <span class="muted">{u.email}</span>
            </button>
          {/each}
        </div>
      {/if}
    </label>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => editOpen = false}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  </div>
</Modal>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text); margin-bottom: 4px; }
  .page-sub { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }


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

  .modal-body { display: flex; flex-direction: column; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
  .field .input, .field textarea { font-weight: 400; }
  .user-pick-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px; }
  .user-pick { display: flex; gap: 8px; padding: 6px 10px; border: none; background: var(--color-surface); cursor: pointer; font: inherit; font-size: 0.82rem; text-align: left; }
  .user-pick:hover { background: var(--color-accent-subtle); }
  .user-pick.selected { background: var(--color-accent-subtle); color: var(--color-accent); font-weight: 600; }
  .delete-warning { color: var(--color-text); font-size: 0.9rem; line-height: 1.5; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; }

  .search-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
  .search-wrap { position: relative; flex: 1; min-width: 180px; max-width: 360px; }
  .search-input { width: 100%; box-sizing: border-box; padding: 8px 12px 8px 34px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); font-size: 0.875rem; outline: none; transition: border-color 0.15s; }
  .search-input:focus { border-color: var(--color-accent); }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
  .sort-btn { background: none; border: none; cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); padding: 0; white-space: nowrap; }
  .sort-btn:hover { color: var(--color-text); }

  @media (max-width: 560px) {
    .search-bar { flex-direction: column; align-items: stretch; }
    .search-wrap { max-width: none; }
    .modal-actions { flex-wrap: wrap; }
  }
</style>

<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { listAllSquads, createSquad, updateSquad, deleteSquad, getSquadDetail, addSquadMember, removeSquadMember, searchUsers, type Squad, type SquadMember, type UserDetail } from '$lib/api/organization';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let { data } = $props();

  let squads = $state<Squad[]>([]);
  let error = $state('');
  let searchQ = $state('');
  let filterTribeId = $state('');
  let searching = $state(false);
  let sortBy = $state<'name' | 'tribe'>('name');
  let sortDir = $state<'asc' | 'desc'>('asc');
  $effect(() => { squads = data.squads ?? []; });

  let sortedSquads = $derived([...squads].sort((a, b) => {
    const av = sortBy === 'tribe' ? (a.tribeName ?? '') : a.name;
    const bv = sortBy === 'tribe' ? (b.tribeName ?? '') : b.name;
    const v = av.localeCompare(bv);
    return sortDir === 'asc' ? v : -v;
  }));

  function toggleSort(field: 'name' | 'tribe') {
    if (sortBy === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = field; sortDir = 'asc'; }
  }

  let createName = $state('');
  let createIssueTrackerProjectKey = $state('');
  let createTribeId = $state('');
  let createOpen = $state(false);
  let creating = $state(false);

  let editOpen = $state(false);
  let editing = $state(false);
  let editName = $state('');
  let editDesc = $state('');
  let editIssueTrackerProjectKey = $state('');
  let editTribeId = $state<string | null>(null);
  let editLeadId = $state<string | null>(null);
  let editingSquadId = $state('');
  let members = $state<SquadMember[]>([]);
  let userSearch = $state('');
  let userResults = $state<UserDetail[]>([]);
  let detailLoading = $state(false);

  let memberEmail = $state('');
  let memberRole = $state('VIEWER');
  let addingMember = $state(false);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function refreshSquads() {
    try {
      squads = (await listAllSquads(undefined, undefined, undefined, undefined, filterTribeId || undefined, searchQ.trim() || undefined)).items;
    } catch (err) {
      error = (err as Error).message;
    }
  }

  async function handleSearch() {
    searching = true; error = '';
    try { await refreshSquads(); }
    catch (err) { error = (err as Error).message; }
    finally { searching = false; }
  }

  function openCreate() {
    createName = '';
    createIssueTrackerProjectKey = '';
    createTribeId = data.tribes[0]?.id ?? '';
    error = '';
    createOpen = true;
  }

  async function handleCreate() {
    if (!createTribeId) { error = 'Select a tribe'; return; }
    creating = true; error = '';
    try {
      await createSquad(createTribeId, {
        name: createName.trim(),
        issueTrackerProjectKey: createIssueTrackerProjectKey.trim() || null
      });
      await refreshSquads();
      createOpen = false;
      createName = '';
      createIssueTrackerProjectKey = '';
      createTribeId = '';
    }
    catch (err) { error = (err as Error).message; } finally { creating = false; }
  }

  async function openEdit(squad: Squad) {
    editingSquadId = squad.id; editName = squad.name; editDesc = '';
    editTribeId = squad.tribeId; editLeadId = null; members = [];
    userSearch = ''; userResults = []; editOpen = true; detailLoading = true;
    try {
      const d = await getSquadDetail(squad.id);
      editDesc = d.description ?? '';
      editIssueTrackerProjectKey = d.issueTrackerProjectKey ?? '';
      editLeadId = d.leadId;
      members = d.members;
    }
    catch {} finally { detailLoading = false; }
  }

  async function searchUsersForLead(q: string) {
    userSearch = q; if (q.length < 2) { userResults = []; return; }
    try { userResults = (await searchUsers(q)).items; } catch { userResults = []; }
  }

  async function handleSaveEdit() {
    if (editing || !editingSquadId) return; editing = true; error = '';
    try {
      await updateSquad(editingSquadId, {
        name: editName,
        description: editDesc || null,
        tribeId: editTribeId,
        leadId: editLeadId,
        issueTrackerProjectKey: editIssueTrackerProjectKey.trim() || null
      });
      await refreshSquads();
      editOpen = false;
    }
    catch (err) { error = (err as Error).message; } finally { editing = false; }
  }

  // Delete confirmation modal
  let deleteOpen = $state(false);
  let deletingSquad = $state<Squad | null>(null);
  let deleting = $state(false);

  function openDelete(squad: Squad) {
    deletingSquad = squad;
    deleteOpen = true;
  }

  async function handleConfirmDelete() {
    if (!deletingSquad || deleting) return;
    deleting = true; error = '';
    try { await deleteSquad(deletingSquad.id); deleteOpen = false; await refreshSquads(); }
    catch (err) { error = (err as Error).message; }
    finally { deleting = false; }
  }

  async function handleAddMember() {
    if (!memberEmail.trim()) return; addingMember = true; error = '';
    try { await addSquadMember(editingSquadId, { email: memberEmail.trim(), role: memberRole }); memberEmail = ''; const d = await getSquadDetail(editingSquadId); members = d.members; }
    catch (err) { error = (err as Error).message; } finally { addingMember = false; }
  }

  async function handleRemoveMember(userId: string) {
    try { await removeSquadMember(editingSquadId, userId); members = members.filter(m => m.userId !== userId); }
    catch (err) { error = (err as Error).message; }
  }
</script>

<svelte:head><title>Squads - Admin - Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>
  {#if data.error}<AppAlert tone="error" title="Could not connect">{data.error}</AppAlert>{/if}
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}

  <div class="page-header">
    <div>
      <p class="page-sub">Manage squads and their tribe ownership.</p>
    </div>
    <Button variant="primary" size="sm" onclick={openCreate}>Create Squad</Button>
  </div>

  <Card padding="md">
    <h2 class="panel-title">Squads</h2>
    <div class="filter-bar">
      <select class="input filter-select" bind:value={filterTribeId} onchange={handleSearch}>
        <option value="">All Tribes</option>
        {#each data.tribes as t}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
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
      {#if searchQ || filterTribeId}
        <Button variant="secondary" size="sm" onclick={() => { searchQ = ''; filterTribeId = ''; handleSearch(); }}>Clear</Button>
      {/if}
    </div>
    {#if squads.length === 0}
      <EmptyState title="No squads yet" hint="Squads you create will show up here." minHeight="240px">
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
            <th><button class="sort-btn" onclick={() => toggleSort('tribe')}>Tribe {sortBy === 'tribe' ? (sortDir === 'asc' ? '▲' : '▽') : '⇅'}</button></th>
            <th>Project key</th>
            <th>Created</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each sortedSquads as squad}
            <tr>
              <td data-label="Name" class="bold">{squad.name}</td>
              <td data-label="Tribe" class="muted">{squad.tribeName ?? '-'}</td>
              <td data-label="Project key" class="muted">{squad.issueTrackerProjectKey ?? 'Global default'}</td>
              <td data-label="Created">{formatDate(squad.createdAt)}</td>
              <td data-label="">
                <Button variant="ghost" iconOnly onclick={() => openEdit(squad)} title="Edit" ariaLabel="Edit squad">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L5.333 13.333 2 14l.667-3.333L11.333 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </Button>
                <Button variant="danger" iconOnly onclick={() => openDelete(squad)} title="Delete" ariaLabel="Delete squad">
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

<Modal open={createOpen} title="Create Squad" size="sm" onclose={() => createOpen = false}>
  <div class="modal-body">
    <label class="field" for="cs-tribe">
      <span>Tribe</span>
      <select id="cs-tribe" class="input" bind:value={createTribeId}>
        <option value="">Select tribe</option>
        {#each data.tribes as t}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
    </label>
    <label class="field" for="cs-name">
      <span>Squad Name</span>
      <input id="cs-name" class="input" bind:value={createName} required placeholder="Squad name" />
    </label>
    <label class="field" for="cs-issue-tracker-project-key">
      <span>Issue tracker project key</span>
      <input
        id="cs-issue-tracker-project-key"
        class="input"
        bind:value={createIssueTrackerProjectKey}
        placeholder="For example, PAY"
      />
      <small>Leave blank to use the global issue-tracker project key.</small>
    </label>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => createOpen = false}>Cancel</Button>
      <Button
        variant="primary"
        size="sm"
        onclick={handleCreate}
        disabled={creating || !createName.trim() || !createTribeId}
      >
        {creating ? 'Creating…' : 'Create'}
      </Button>
    </div>
  </div>
</Modal>

<Modal open={deleteOpen} title="Delete Squad" size="sm" onclose={() => deleteOpen = false}>
  <div class="modal-body">
    <p class="delete-warning">Delete squad <strong>"{deletingSquad?.name}"</strong>?</p>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => deleteOpen = false}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
    </div>
  </div>
</Modal>

<Modal open={editOpen} title="Edit Squad" size="lg" onclose={() => editOpen = false}>
  {#if detailLoading}<p class="muted p-4">Loading…</p>
  {:else}
  <div class="modal-body">
    <div class="edit-grid">
      <label class="field"><span>Name</span><input class="input" bind:value={editName} /></label>
      <label class="field"><span>Tribe</span><select class="input" bind:value={editTribeId}><option value={null}>None</option>{#each data.tribes as t}<option value={t.id}>{t.name}</option>{/each}</select></label>
      <label class="field full"><span>Description</span><textarea class="input" bind:value={editDesc} rows={2}></textarea></label>
      <label class="field full" for="es-issue-tracker-project-key">
        <span>Issue tracker project key</span>
        <input
          id="es-issue-tracker-project-key"
          class="input"
          bind:value={editIssueTrackerProjectKey}
          placeholder="For example, PAY"
        />
        <small>Leave blank to use the global issue-tracker project key.</small>
      </label>
      <label class="field full"><span>Lead</span>
        <input class="input" placeholder="Search user…" value={userSearch} oninput={(e) => searchUsersForLead((e.target as HTMLInputElement).value)} />
        {#if userResults.length > 0}
          <div class="user-pick-list">
            {#each userResults as u}
              <button class="user-pick" class:selected={editLeadId === u.id} onclick={() => { editLeadId = u.id; userSearch = u.displayName; userResults = []; }}>
                <strong>{u.displayName}</strong> <span class="muted">{u.email}</span>
              </button>
            {/each}
          </div>
        {/if}
      </label>
    </div>

    <h3 class="section-title">Members ({members.length})</h3>
    {#if members.length > 0}
      <div class="member-list">
        {#each members as m}
          <div class="member-row"><span><strong>{m.displayName}</strong> <span class="muted">{m.email}</span></span><span class="role-chip">{m.role}</span><Button variant="danger" size="sm" iconOnly onclick={() => handleRemoveMember(m.userId)} title="Remove" ariaLabel="Remove member">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </Button></div>
        {/each}
      </div>
    {:else}<p class="muted">No members.</p>{/if}

    <div class="add-member-row">
      <input class="input" type="email" bind:value={memberEmail} placeholder="User email" />
      <select class="input" bind:value={memberRole} style="width:auto"><option value="VIEWER">Viewer</option><option value="QA">QA Engineer</option><option value="QA_LEAD">QA Lead</option><option value="DEVELOPER">Developer</option><option value="ADMIN">Admin</option></select>
      <Button variant="primary" size="sm" onclick={handleAddMember} disabled={addingMember || !memberEmail.trim()}>{addingMember ? 'Adding…' : 'Add'}</Button>
    </div>

    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => editOpen = false}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={handleSaveEdit} disabled={editing}>{editing ? 'Saving…' : 'Save Squad'}</Button>
    </div>
  </div>
  {/if}
</Modal>

<style>
  .section-wrap{display:flex;flex-direction:column;gap:20px}.page-title{font-size:1.5rem;font-weight:700;margin-bottom:4px}
  .page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .page-sub{color:var(--color-text-muted);margin:0;font-size:.875rem}
  .panel-title{font-size:1rem;font-weight:600;margin-bottom:14px;color:var(--color-text)}
  .section-title{font-size:.9rem;font-weight:600;margin:16px 0 8px;color:var(--color-text)}
  .muted{color:var(--color-text-muted)}.bold{font-weight:500}.p-4{padding:16px}
  .input{padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text);font-size:.875rem;outline:none;transition:border-color .15s;font-family:inherit}.input:focus{border-color:var(--color-accent)}
  textarea.input{resize:vertical}
  .modal-body{display:flex;flex-direction:column;gap:12px}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.edit-grid .full{grid-column:1/-1}
  .field{display:flex;flex-direction:column;gap:4px;font-size:.8rem;font-weight:600;color:var(--color-text-muted)}.field .input,.field textarea{font-weight:400}
  .user-pick-list{display:flex;flex-direction:column;gap:4px;max-height:140px;overflow-y:auto;border:1px solid var(--color-border);border-radius:6px}
  .user-pick{display:flex;gap:8px;padding:6px 10px;border:none;background:var(--color-surface);cursor:pointer;font:inherit;font-size:.82rem;text-align:left}.user-pick:hover{background:var(--color-accent-subtle)}.user-pick.selected{background:var(--color-accent-subtle);color:var(--color-accent);font-weight:600}
  .member-list{display:flex;flex-direction:column;gap:6px}
  .member-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);font-size:.85rem}
  .role-chip{display:inline-flex;padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;background:var(--color-accent-subtle);color:var(--color-accent)}
  .add-member-row{display:flex;gap:8px;align-items:center}.add-member-row .input{flex:1}
  .delete-warning{color:var(--color-text);font-size:0.9rem;line-height:1.5}
  .modal-actions{display:flex;gap:8px;justify-content:flex-end;padding-top:8px}
  @media(max-width:600px){.edit-grid{grid-template-columns:1fr}.add-member-row{flex-direction:column;align-items:stretch}.add-member-row .input,.add-member-row select{width:100%}}
  .filter-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
  .filter-select { flex: 0 0 auto; min-width: 160px; }
  .search-wrap { position: relative; flex: 1; min-width: 180px; max-width: 320px; }
  .search-input { width: 100%; padding: 8px 12px 8px 34px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); font-size: 0.875rem; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .search-input:focus { border-color: var(--color-accent); }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
  .sort-btn { background: none; border: none; cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); padding: 0; white-space: nowrap; }
  .sort-btn:hover { color: var(--color-text); }

  @media (max-width: 560px) {
    .filter-bar { flex-direction: column; align-items: stretch; }
    .filter-select, .search-wrap { max-width: none; min-width: 0; width: 100%; }
    .modal-actions { flex-wrap: wrap; }
  }
</style>

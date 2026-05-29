<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { listAllSquads, createSquad, updateSquad, deleteSquad, getSquadDetail, addSquadMember, removeSquadMember, searchUsers, type Squad, type SquadMember, type UserDetail } from '$lib/api/organization';

  let { data } = $props();

  let squads = $state<Squad[]>([]);
  let error = $state('');
  $effect(() => { squads = data.squads ?? []; });

  let createName = $state('');
  let createTribeId = $state('');
  let creating = $state(false);

  let editOpen = $state(false);
  let editing = $state(false);
  let editName = $state('');
  let editDesc = $state('');
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

  async function refreshSquads() { try { squads = (await listAllSquads()).items; } catch {} }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault(); if (!createTribeId) { error = 'Select a tribe'; return; }
    creating = true; error = '';
    try { await createSquad(createTribeId, { name: createName.trim() }); createName = ''; await refreshSquads(); }
    catch (err) { error = (err as Error).message; } finally { creating = false; }
  }

  async function openEdit(squad: Squad) {
    editingSquadId = squad.id; editName = squad.name; editDesc = '';
    editTribeId = squad.tribeId; editLeadId = null; members = [];
    userSearch = ''; userResults = []; editOpen = true; detailLoading = true;
    try { const d = await getSquadDetail(squad.id); editDesc = d.description ?? ''; editLeadId = d.leadId; members = d.members; }
    catch {} finally { detailLoading = false; }
  }

  async function searchUsersForLead(q: string) {
    userSearch = q; if (q.length < 2) { userResults = []; return; }
    try { userResults = (await searchUsers(q)).items; } catch { userResults = []; }
  }

  async function handleSaveEdit() {
    if (editing || !editingSquadId) return; editing = true; error = '';
    try { await updateSquad(editingSquadId, { name: editName, description: editDesc || null, tribeId: editTribeId, leadId: editLeadId }); editOpen = false; await refreshSquads(); }
    catch (err) { error = (err as Error).message; } finally { editing = false; }
  }

  async function handleDelete(squad: Squad) {
    if (!confirm(`Delete squad "${squad.name}"?`)) return;
    try { await deleteSquad(squad.id); await refreshSquads(); } catch (err) { error = (err as Error).message; }
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

<svelte:head><title>Squads — Admin — Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>
  {#if data.error}<div class="error-banner">Could not connect — {data.error}</div>{/if}
  {#if error}<div class="error-banner">{error}</div>{/if}

  <div class="panel">
    <h2 class="panel-title">Squads</h2>
    {#if squads.length === 0}
      <p class="empty-text">No squads yet.</p>
    {:else}
      <DataTable>
        {#snippet head()}<tr><th>Name</th><th>Tribe</th><th>Created</th><th></th></tr>{/snippet}
        {#snippet body()}
          {#each squads as squad}
            <tr>
              <td data-label="Name" class="bold">{squad.name}</td>
              <td data-label="Tribe" class="muted">{squad.tribeName ?? '—'}</td>
              <td data-label="Created">{formatDate(squad.createdAt)}</td>
              <td data-label="">
                <button class="action-btn" onclick={() => openEdit(squad)} title="Edit">✎</button>
                <button class="action-btn danger" onclick={() => handleDelete(squad)} title="Delete">✕</button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </div>

  <div class="panel">
    <h2 class="panel-title">New Squad</h2>
    <form onsubmit={handleCreate} class="inline-form">
      <select class="input" bind:value={createTribeId}><option value="">— Tribe —</option>{#each data.tribes as t}<option value={t.id}>{t.name}</option>{/each}</select>
      <input class="input" bind:value={createName} required placeholder="Squad name" />
      <Button variant="primary" type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
    </form>
  </div>
</div>

<Modal open={editOpen} title="Edit Squad" size="lg" onclose={() => editOpen = false}>
  {#if detailLoading}<p class="muted p-4">Loading…</p>
  {:else}
  <div class="modal-body">
    <div class="edit-grid">
      <label class="field"><span>Name</span><input class="input" bind:value={editName} /></label>
      <label class="field"><span>Tribe</span><select class="input" bind:value={editTribeId}><option value={null}>— None —</option>{#each data.tribes as t}<option value={t.id}>{t.name}</option>{/each}</select></label>
      <label class="field full"><span>Description</span><textarea class="input" bind:value={editDesc} rows={2}></textarea></label>
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
          <div class="member-row"><span><strong>{m.displayName}</strong> <span class="muted">{m.email}</span></span><span class="role-chip">{m.role}</span><button class="action-btn danger small" onclick={() => handleRemoveMember(m.userId)} title="Remove">✕</button></div>
        {/each}
      </div>
    {:else}<p class="muted">No members.</p>{/if}

    <div class="add-member-row">
      <input class="input" type="email" bind:value={memberEmail} placeholder="User email" />
      <select class="input" bind:value={memberRole} style="width:auto"><option value="VIEWER">Viewer</option><option value="QA">QA Engineer</option><option value="QA_LEAD">QA Lead</option><option value="DEVELOPER">Developer</option><option value="ADMIN">Admin</option></select>
      <button class="btn-submit" onclick={handleAddMember} disabled={addingMember || !memberEmail.trim()}>{addingMember ? 'Adding…' : 'Add'}</button>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick={() => editOpen = false}>Cancel</button>
      <button class="btn-submit" onclick={handleSaveEdit} disabled={editing}>{editing ? 'Saving…' : 'Save Squad'}</button>
    </div>
  </div>
  {/if}
</Modal>

<style>
  .section-wrap{display:flex;flex-direction:column;gap:20px}.page-title{font-size:1.5rem;font-weight:700;margin-bottom:4px}
  .error-banner{background:#fee2e2;color:var(--color-danger);border:1px solid #fecaca;border-radius:var(--radius);padding:12px 16px;font-size:.875rem}
  .panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:20px}
  .panel-title{font-size:1rem;font-weight:600;margin-bottom:14px;color:var(--color-text)}
  .section-title{font-size:.9rem;font-weight:600;margin:16px 0 8px;color:var(--color-text)}
  .empty-text{color:var(--color-text-muted);font-size:.875rem}.muted{color:var(--color-text-muted)}.bold{font-weight:500}.p-4{padding:16px}
  .inline-form{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.inline-form .input{flex:1;min-width:140px}
  .input{padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text);font-size:.875rem;outline:none;transition:border-color .15s;font-family:inherit}.input:focus{border-color:var(--color-accent)}
  textarea.input{resize:vertical}
  .action-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text-muted);cursor:pointer;font-size:.8rem;transition:border-color .15s,color .15s}.action-btn:hover{border-color:var(--color-accent);color:var(--color-accent)}.action-btn.danger:hover{border-color:var(--color-danger);color:var(--color-danger)}.action-btn.small{width:22px;height:22px;font-size:.7rem}
  .modal-body{display:flex;flex-direction:column;gap:12px}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.edit-grid .full{grid-column:1/-1}
  .field{display:flex;flex-direction:column;gap:4px;font-size:.8rem;font-weight:600;color:var(--color-text-muted)}.field .input,.field textarea{font-weight:400}
  .user-pick-list{display:flex;flex-direction:column;gap:4px;max-height:140px;overflow-y:auto;border:1px solid var(--color-border);border-radius:6px}
  .user-pick{display:flex;gap:8px;padding:6px 10px;border:none;background:var(--color-surface);cursor:pointer;font:inherit;font-size:.82rem;text-align:left}.user-pick:hover{background:var(--color-accent-subtle)}.user-pick.selected{background:var(--color-accent-subtle);color:var(--color-accent);font-weight:600}
  .member-list{display:flex;flex-direction:column;gap:6px}
  .member-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);font-size:.85rem}
  .role-chip{display:inline-flex;padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;background:var(--color-accent-subtle);color:var(--color-accent)}
  .add-member-row{display:flex;gap:8px;align-items:center}.add-member-row .input{flex:1}
  .modal-actions{display:flex;gap:8px;justify-content:flex-end;padding-top:8px}
  .btn-cancel{padding:7px 14px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text);font:inherit;font-size:.82rem;cursor:pointer}
  .btn-submit{padding:7px 14px;border-radius:6px;border:1px solid var(--color-accent);background:var(--color-accent);color:#fff;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;white-space:nowrap}.btn-submit:disabled{opacity:.5;cursor:not-allowed}
  @media(max-width:600px){.edit-grid{grid-template-columns:1fr}.add-member-row{flex-wrap:wrap}}
</style>

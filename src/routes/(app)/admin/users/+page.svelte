<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { listUsers, searchUsers, addSquadMember, removeSquadMember, getSquadDetail, assignProjectRole, type User, type UserDetail, type Squad, type SquadDetail, type SquadMember } from '$lib/api/organization';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();
  let users = $state<User[]>([]);
  let squads = $state<Squad[]>([]);
  let error = $state('');
  $effect(() => { users = data.users; squads = data.squads ?? []; });
  let message = $state('');
  let searchQ = $state('');
  let searching = $state(false);

  // Assign project role
  let projectKey = $state('');
  let email = $state('');
  let role = $state<'QA' | 'VIEWER' | 'ADMIN' | 'QA_LEAD' | 'DEVELOPER'>('VIEWER');
  let busy = $state(false);

  // Squad assignment modal
  let squadOpen = $state(false);
  let squadUser = $state<User | null>(null);
  let squadUserDetail = $state<UserDetail | null>(null);
  let selectedSquadId = $state('');
  let squadRole = $state('VIEWER');
  let squadBusy = $state(false);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleSearch() {
    searching = true; error = '';
    try {
      if (searchQ.trim()) {
        const page = await searchUsers(searchQ.trim());
        users = page.items as unknown as User[];
      } else {
        const page = await listUsers();
        users = page.items;
      }
    } catch (err) { error = (err as Error).message; }
    finally { searching = false; }
  }

  async function submitRole(e: SubmitEvent) {
    e.preventDefault(); if (!projectKey.trim() || !email.trim()) return;
    busy = true; error = ''; message = '';
    try { await assignProjectRole(projectKey.trim().toUpperCase(), { email: email.trim(), role }); message = `${role} assigned to ${email.trim()} for ${projectKey.trim().toUpperCase()}.`; email = ''; }
    catch (err) { error = (err as Error).message; } finally { busy = false; }
  }

  async function openSquadModal(user: User) {
    squadUser = user; squadUserDetail = null; selectedSquadId = ''; squadRole = 'VIEWER'; squadOpen = true;
    try { squadUserDetail = (await searchUsers(user.email)).items[0] ?? null; } catch {}
  }

  async function handleAssignSquad() {
    if (!selectedSquadId || !squadUser) return;
    squadBusy = true; error = '';
    try {
      await addSquadMember(selectedSquadId, { email: squadUser.email, role: squadRole });
      message = `Added ${squadUser.displayName} to squad.`;
      squadOpen = false;
    } catch (err) { error = (err as Error).message; } finally { squadBusy = false; }
  }

  async function handleRemoveFromSquad(squadId: string, userId: string) {
    try { await removeSquadMember(squadId, userId); message = 'Removed from squad.'; if (squadUser) { const d = (await searchUsers(squadUser.email)).items[0]; squadUserDetail = d ?? null; } }
    catch (err) { error = (err as Error).message; }
  }
</script>

<svelte:head><title>Users — Admin — Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>
  {#if data.error}<AppAlert tone="error" title="Could not connect">{data.error}</AppAlert>{/if}
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}
  {#if message}<div class="success-banner">{message}</div>{/if}

  <form class="panel role-panel" onsubmit={submitRole}>
    <div><h2 class="panel-title">Assign Project Role</h2><p class="panel-subtitle">New sign-ins start as guests. Admins grant project access here.</p></div>
    <label><span>Project key</span><input bind:value={projectKey} placeholder="PAYMENT" required /></label>
    <label><span>User email</span><input type="email" bind:value={email} placeholder="qa@example.com" required /></label>
    <label><span>Role</span><select bind:value={role}><option value="VIEWER">Viewer</option><option value="QA">QA Engineer</option><option value="QA_LEAD">QA Lead</option><option value="DEVELOPER">Developer</option><option value="ADMIN">Admin</option></select></label>
    <Button variant="primary" type="submit" disabled={busy || !projectKey.trim() || !email.trim()}>{busy ? 'Assigning…' : 'Assign Role'}</Button>
  </form>

  <Card padding="md">
    <h2 class="panel-title">Users</h2>
    <div class="search-bar">
      <input class="input" type="search" bind:value={searchQ} placeholder="Search by name or email…" onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
      <Button variant="primary" size="sm" onclick={handleSearch} disabled={searching}>{searching ? 'Searching…' : 'Search'}</Button>
      <Button variant="secondary" size="sm" onclick={() => { searchQ = ''; handleSearch(); }}>Clear</Button>
    </div>
    {#if users.length === 0}
      <p class="empty-text">No users found.</p>
    {:else}
      <DataTable mobileCards={true}>
        {#snippet head()}<tr><th>Email</th><th>Display Name</th><th>Created</th><th></th></tr>{/snippet}
        {#snippet body()}
          {#each users as user}
            <tr>
              <td data-label="Email">{user.email}</td>
              <td data-label="Name" class="bold">{user.displayName}</td>
              <td data-label="Created">{formatDate(user.createdAt)}</td>
              <td data-label="">
                <Button variant="ghost" size="sm" iconOnly onclick={() => openSquadModal(user)} title="Manage squads" ariaLabel="Manage squads">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.86.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.86l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.24.6.83 1 1.55 1H21a2 2 0 0 1 0 4h-.05c-.72 0-1.31.4-1.55 1Z"/>
                  </svg>
                </Button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </Card>
</div>

<Modal open={squadOpen} title="Squad Membership — {squadUser?.displayName}" size="md" onclose={() => squadOpen = false}>
  <div class="modal-body">
    <p class="muted">{squadUser?.email}</p>
    {#if squadUserDetail && squadUserDetail.squads.length > 0}
      <h3 class="section-title">Current Squads</h3>
      <div class="member-list">
        {#each squadUserDetail.squads as m}
          <div class="member-row"><span><strong>{m.displayName}</strong> — {m.email}</span><span class="role-chip">{m.role}</span><Button variant="danger" size="sm" iconOnly onclick={() => handleRemoveFromSquad(m.id, squadUserDetail!.id)} title="Remove" ariaLabel="Remove from squad">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </Button></div>
        {/each}
      </div>
    {/if}
    <h3 class="section-title">Add to Squad</h3>
    <div class="add-member-row">
      <select class="input" bind:value={selectedSquadId}><option value="">— Select squad —</option>{#each squads as s}<option value={s.id}>{s.name}</option>{/each}</select>
      <select class="input" bind:value={squadRole} style="width:auto"><option value="VIEWER">Viewer</option><option value="QA">QA Engineer</option><option value="QA_LEAD">QA Lead</option><option value="DEVELOPER">Developer</option><option value="ADMIN">Admin</option></select>
      <Button variant="primary" size="sm" onclick={handleAssignSquad} disabled={squadBusy || !selectedSquadId}>{squadBusy ? 'Adding…' : 'Add'}</Button>
    </div>
  </div>
</Modal>

<style>
  .section-wrap{display:flex;flex-direction:column;gap:20px}.page-title{font-size:1.5rem;font-weight:700;margin-bottom:4px}
  .success-banner{background:color-mix(in srgb,var(--color-success),transparent 90%);color:var(--color-success);border:1px solid color-mix(in srgb,var(--color-success),transparent 70%);border-radius:var(--radius);padding:12px 16px;font-size:.875rem}
  .panel-title{font-size:1rem;font-weight:600;margin-bottom:14px;color:var(--color-text)}.panel-subtitle{margin:-8px 0 0;color:var(--color-text-muted);font-size:.82rem}
  .role-panel{display:grid;grid-template-columns:minmax(220px,1fr) minmax(130px,.55fr) minmax(220px,.9fr) minmax(120px,.45fr) auto;align-items:end;gap:12px}
  label{display:grid;gap:5px;color:var(--color-text-muted);font-size:.76rem}
  input,select{width:100%;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text);padding:9px 10px;font:inherit}
  .empty-text{color:var(--color-text-muted);font-size:.875rem}.bold{font-weight:500}.muted{color:var(--color-text-muted)}
  .search-bar{display:flex;gap:8px;margin-bottom:14px;align-items:center}.search-bar .input{flex:1;max-width:400px}
  .modal-body{display:flex;flex-direction:column;gap:12px}
  .section-title{font-size:.9rem;font-weight:600;margin:0;color:var(--color-text)}
  .member-list{display:flex;flex-direction:column;gap:6px}
  .member-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);font-size:.85rem}
  .role-chip{display:inline-flex;padding:2px 8px;border-radius:10px;font-size:.68rem;font-weight:700;background:var(--color-accent-subtle);color:var(--color-accent)}
  .add-member-row{display:flex;gap:8px;align-items:center}.add-member-row .input{flex:1}
  @media(max-width:980px){.role-panel{grid-template-columns:1fr}}
</style>

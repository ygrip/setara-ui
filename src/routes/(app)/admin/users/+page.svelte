<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { listUsers, searchUsers, addSquadMember, removeSquadMember, getSquadDetail, assignProjectRole, suspendUser, deleteUser, type User, type UserDetail, type Squad, type SquadDetail, type SquadMember } from '$lib/api/organization';
  import { getValidSession } from '$lib/auth';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();
  let users = $state<User[]>([]);
  let squads = $state<Squad[]>([]);
  let error = $state('');
  $effect(() => { users = data.users; squads = data.squads ?? []; });
  let message = $state('');
  let searchQ = $state('');
  let searching = $state(false);

  const currentSession = getValidSession();
  const currentEmail = currentSession?.email ?? '';

  // Delete confirmation
  let deleteTarget = $state<User | null>(null);
  let deleteOpen = $state(false);
  let deleteBusy = $state(false);

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

  async function handleSuspend(user: User) {
    error = '';
    try {
      const updated = await suspendUser(user.id, !user.disabledAt);
      users = users.map(u => u.id === updated.id ? updated : u);
      message = updated.disabledAt ? `${user.displayName} suspended.` : `${user.displayName} reactivated.`;
    } catch (err) { error = (err as Error).message; }
  }

  function openDeleteModal(user: User) {
    deleteTarget = user; deleteOpen = true;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    deleteBusy = true; error = '';
    try {
      await deleteUser(deleteTarget.id);
      users = users.filter(u => u.id !== deleteTarget!.id);
      message = `${deleteTarget.displayName} deleted.`;
      deleteOpen = false; deleteTarget = null;
    } catch (err) { error = (err as Error).message; } finally { deleteBusy = false; }
  }

  async function handleRemoveFromSquad(squadId: string, userId: string) {
    try { await removeSquadMember(squadId, userId); message = 'Removed from squad.'; if (squadUser) { const d = (await searchUsers(squadUser.email)).items[0]; squadUserDetail = d ?? null; } }
    catch (err) { error = (err as Error).message; }
  }
</script>

<svelte:head><title>Users — Admin — Setara</title></svelte:head>

<div class="section-wrap">
  <div class="page-header">
    <div>
      <h1 class="page-title">Users</h1>
      <p class="page-sub">Manage user access — assign project roles and squad membership.</p>
    </div>
  </div>

  {#if data.error}<AppAlert tone="error" title="Could not connect">{data.error}</AppAlert>{/if}
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}
  {#if message}<div class="success-banner">{message}</div>{/if}

  <Card padding="md">
    <h2 class="panel-title">Assign Project Role</h2>
    <p class="panel-subtitle">New sign-ins start as guests. Admins grant project access here.</p>
    <form class="inline-form" onsubmit={submitRole}>
      <input class="input" bind:value={projectKey} placeholder="Project key (e.g. PAYMENT)" required />
      <input class="input" type="email" bind:value={email} placeholder="User email" required />
      <select class="input" bind:value={role}>
        <option value="VIEWER">Viewer</option>
        <option value="QA">QA Engineer</option>
        <option value="QA_LEAD">QA Lead</option>
        <option value="DEVELOPER">Developer</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Button variant="primary" type="submit" disabled={busy || !projectKey.trim() || !email.trim()}>
        {busy ? 'Assigning…' : 'Assign Role'}
      </Button>
    </form>
  </Card>

  <Card padding="md">
    <h2 class="panel-title">All Users</h2>
    <div class="search-bar">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        class="search-input"
        type="search"
        bind:value={searchQ}
        placeholder="Search by name or email…"
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button variant="primary" size="sm" onclick={handleSearch} disabled={searching}>{searching ? 'Searching…' : 'Search'}</Button>
      {#if searchQ}
        <Button variant="secondary" size="sm" onclick={() => { searchQ = ''; handleSearch(); }}>Clear</Button>
      {/if}
    </div>
    {#if users.length === 0}
      <p class="empty-text">No users found.</p>
    {:else}
      <DataTable mobileCards={true}>
        {#snippet head()}<tr><th>Email</th><th>Display Name</th><th>Status</th><th>Created</th><th></th></tr>{/snippet}
        {#snippet body()}
          {#each users as user}
            {@const isSelf = user.email === currentEmail}
            {@const isSuspended = !!user.disabledAt}
            <tr class:row-suspended={isSuspended}>
              <td data-label="Email">{user.email}</td>
              <td data-label="Name" class="bold">{user.displayName}</td>
              <td data-label="Status">
                {#if isSuspended}
                  <span class="status-chip status-suspended">Suspended</span>
                {:else}
                  <span class="status-chip status-active">Active</span>
                {/if}
              </td>
              <td data-label="Created">{formatDate(user.createdAt)}</td>
              <td data-label="" class="actions-cell">
                <Button variant="ghost" size="sm" iconOnly onclick={() => openSquadModal(user)} title="Manage squads" ariaLabel="Manage squads">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.86.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.86l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.24.6.83 1 1.55 1H21a2 2 0 0 1 0 4h-.05c-.72 0-1.31.4-1.55 1Z"/>
                  </svg>
                </Button>
                {#if !isSelf}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onclick={() => handleSuspend(user)}
                    title={isSuspended ? 'Reactivate user' : 'Suspend user'}
                    ariaLabel={isSuspended ? 'Reactivate' : 'Suspend'}
                  >
                    {#if isSuspended}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                    {:else}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
                    {/if}
                  </Button>
                  <Button variant="danger" size="sm" iconOnly onclick={() => openDeleteModal(user)} title="Delete user" ariaLabel="Delete user">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </Button>
                {/if}
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </Card>
</div>

<Modal open={deleteOpen} title="Delete User" size="sm" onclose={() => { deleteOpen = false; deleteTarget = null; }}>
  <div class="modal-body">
    <p>Permanently delete <strong>{deleteTarget?.displayName}</strong> ({deleteTarget?.email})?</p>
    <p class="muted" style="font-size:0.82rem">This removes all project and squad memberships. This cannot be undone.</p>
    {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <Button variant="secondary" size="sm" onclick={() => { deleteOpen = false; deleteTarget = null; }}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={handleDelete} disabled={deleteBusy}>{deleteBusy ? 'Deleting…' : 'Delete'}</Button>
    </div>
  </div>
</Modal>

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

  .success-banner {
    background: color-mix(in srgb, var(--color-success), transparent 90%);
    color: var(--color-success);
    border: 1px solid color-mix(in srgb, var(--color-success), transparent 70%);
    border-radius: var(--radius);
    padding: 12px 16px;
    font-size: 0.875rem;
  }

  .panel-title { font-size: 1rem; font-weight: 600; margin: 0 0 4px; color: var(--color-text); }
  .panel-subtitle { margin: 0 0 14px; color: var(--color-text-muted); font-size: 0.82rem; }

  .inline-form { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
  .inline-form .input { flex: 1; min-width: 160px; }
  .inline-form select.input { flex: 0 0 auto; min-width: 140px; }
  .inline-form :global(.btn) { flex-shrink: 0; }

  .input {
    padding: 8px 10px; border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-bg);
    color: var(--color-text); font-size: 0.875rem; outline: none;
    transition: border-color 0.15s; font-family: inherit;
  }
  .input:focus { border-color: var(--color-accent); }

  .search-bar {
    display: flex; gap: 8px; margin-bottom: 14px; align-items: center;
    position: relative;
  }
  .search-bar .search-input {
    flex: 1; max-width: 400px;
    padding: 8px 12px 8px 34px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem; outline: none;
    transition: border-color 0.15s;
  }
  .search-bar .search-input:focus { border-color: var(--color-accent); }
  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; }
  .bold { font-weight: 500; }
  .muted { color: var(--color-text-muted); }

  .actions-cell { display: flex; gap: 4px; align-items: center; }

  :global(tr.row-suspended td) { opacity: 0.6; }

  .status-chip {
    display: inline-flex; padding: 2px 8px; border-radius: 10px;
    font-size: 0.68rem; font-weight: 700; white-space: nowrap;
  }
  .status-active {
    background: color-mix(in srgb, var(--color-success, #22c55e), transparent 85%);
    color: var(--color-success, #16a34a);
  }
  .status-suspended {
    background: color-mix(in srgb, var(--color-warning, #f59e0b), transparent 85%);
    color: color-mix(in srgb, var(--color-warning, #f59e0b), #000 30%);
  }

  /* Modal styles */
  .modal-body { display: flex; flex-direction: column; gap: 12px; }
  .section-title { font-size: 0.9rem; font-weight: 600; margin: 0; color: var(--color-text); }
  .member-list { display: flex; flex-direction: column; gap: 6px; }
  .member-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-bg); font-size: 0.85rem;
  }
  .role-chip {
    display: inline-flex; padding: 2px 8px; border-radius: 10px;
    font-size: 0.68rem; font-weight: 700;
    background: var(--color-accent-subtle); color: var(--color-accent);
  }
  .add-member-row { display: flex; gap: 8px; align-items: center; }
  .add-member-row .input { flex: 1; }

  @media (max-width: 640px) {
    .inline-form { flex-direction: column; }
    .inline-form .input, .inline-form select.input { min-width: 0; width: 100%; }
    .inline-form :global(.btn) { width: 100%; justify-content: center; }
  }
</style>

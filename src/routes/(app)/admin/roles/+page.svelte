<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { listConfigRoles, getRolePermissions, listAvailablePermissions, createConfigRole, deleteConfigRole, updateConfigRole, setRolePermissions, mockRolePermissions, type ConfigRole, type AvailablePermission, mockConfigRoles, mockPermissions } from '$lib/api/roles';
  import { isMockMode } from '$lib/mock/client';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import AppSkeleton from '$lib/ui/display/AppSkeleton.svelte';

  let roles = $state<ConfigRole[]>([]);
  let permissions = $state<AvailablePermission[]>([]);
  let rolePermissions = $state<Map<string, Set<string>>>(new Map());
  let loading = $state(true);
  let error = $state('');

  // Create modal
  let showCreate = $state(false);
  let createForm = $state({ key: '', label: '', description: '', color: 'info' });
  let createBusy = $state(false);
  let createError = $state('');

  // Edit permission modal
  let showPermModal = $state(false);
  let editingRole = $state<ConfigRole | null>(null);
  let editingPerms = $state<Set<string>>(new Set());
  let permBusy = $state(false);

  onMount(async () => {
    try {
      roles = await listConfigRoles();
      permissions = await listAvailablePermissions();
      for (const role of roles) {
        const perms = await getRolePermissions(role.id);
        rolePermissions.set(role.id, new Set(perms));
      }
      rolePermissions = new Map(rolePermissions); // trigger reactivity
    } catch (e) {
      if (isMockMode()) {
        roles = mockConfigRoles;
        permissions = mockPermissions;
        for (const role of roles) {
          rolePermissions.set(role.id, new Set(mockRolePermissions[role.key] ?? []));
        }
        rolePermissions = new Map(rolePermissions);
      } else {
        error = (e as Error).message;
      }
    } finally {
      loading = false;
    }
  });

  function hasPerm(roleId: string, area: string, key: string): boolean {
    return rolePermissions.get(roleId)?.has(`${area}:${key}`) ?? false;
  }

  function permKey(area: string, key: string): string { return `${area}:${key}`; }

  async function handleCreate() {
    if (!createForm.key.trim() || !createForm.label.trim()) { createError = 'Key and label required'; return; }
    createBusy = true; createError = '';
    try {
      const created = await createConfigRole(createForm);
      roles = [...roles, created];
      showCreate = false;
      createForm = { key: '', label: '', description: '', color: 'info' };
    } catch (e) { createError = (e as Error).message; }
    finally { createBusy = false; }
  }

  async function handleDelete(role: ConfigRole) {
    if (!confirm(`Delete role "${role.label}"?`)) return;
    try {
      await deleteConfigRole(role.id);
      roles = roles.filter(r => r.id !== role.id);
    } catch (e) { error = (e as Error).message; }
  }

  function openPermEditor(role: ConfigRole) {
    editingRole = role;
    editingPerms = new Set(rolePermissions.get(role.id) ?? new Set());
    showPermModal = true;
  }

  async function savePermissions() {
    if (!editingRole) return;
    permBusy = true;
    try {
      const entries: { area: string; permissionKey: string }[] = [];
      for (const p of permissions) {
        if (editingPerms.has(permKey(p.area, p.key))) {
          entries.push({ area: p.area, permissionKey: p.key });
        }
      }
      const saved = await setRolePermissions(editingRole.id, entries);
      rolePermissions.set(editingRole.id, new Set(saved));
      rolePermissions = new Map(rolePermissions);
      showPermModal = false;
    } catch (e) { error = (e as Error).message; }
    finally { permBusy = false; }
  }

  function togglePerm(area: string, key: string) {
    const pk = permKey(area, key);
    const next = new Set(editingPerms);
    if (next.has(pk)) next.delete(pk); else next.add(pk);
    editingPerms = next;
  }

  // Group permissions by area
  const permAreas = $derived.by(() => {
    const areas = new Map<string, AvailablePermission[]>();
    for (const p of permissions) {
      if (!areas.has(p.area)) areas.set(p.area, []);
      areas.get(p.area)!.push(p);
    }
    return areas;
  });

  function badgeColor(color: string): string {
    return color || 'neutral';
  }
</script>

<svelte:head>
  <title>Roles — Admin — Setara</title>
</svelte:head>

<div class="section-wrap">
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}
  {#if loading}
    <div class="section-header">
      <AppSkeleton width="60px" height="1.25rem" radius="6px" />
    </div>
    <div class="roles-grid">
      {#each Array(5) as _}
        <div class="sk-card">
          <AppSkeleton width="80px" height="20px" radius="4px" />
          <AppSkeleton width="120px" height="1rem" />
          <AppSkeleton lines={2} height="0.8rem" />
          <AppSkeleton width="100px" height="28px" radius="4px" />
        </div>
      {/each}
    </div>
  {:else}
    <!-- Role cards -->
    <div class="section-header">
      <h2 class="section-title">Roles</h2>
      <Button variant="primary" size="sm" onclick={() => { showCreate = true; createError = ''; createForm = { key: '', label: '', description: '', color: 'info' }; }}>New Role</Button>
    </div>
    <div class="roles-grid">
      {#each roles as role (role.id)}
        <Card padding="md">
          <div class="role-card-content">
          <div class="role-card-head">
            <span class="role-badge role-badge-{badgeColor(role.color)}">{role.key}</span>
            {#if role.system}<span class="system-tag">system</span>{/if}
          </div>
          <span class="role-display">{role.label}</span>
          <p class="role-desc">{role.description ?? ''}</p>
          <div class="role-card-actions">
            <Button variant="ghost" size="sm" onclick={() => openPermEditor(role)} title="Edit permissions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Permissions
            </Button>
            {#if !role.system}
              <Button variant="danger" iconOnly onclick={() => handleDelete(role)} title="Delete role" ariaLabel="Delete role">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333A1.333 1.333 0 0 1 11.333 14.667H4.667A1.333 1.333 0 0 1 3.333 13.333V4h9.334z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </Button>
            {/if}
          </div>
          </div>
        </Card>
      {/each}
    </div>

    <!-- Permission matrix -->
    <Card padding="md">
      <h2 class="panel-title">Permission Matrix</h2>
      <div class="matrix-wrap">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="area-col">Permission</th>
              {#each roles as role}
                <th class="role-col"><span class="role-badge role-badge-{badgeColor(role.color)}">{role.key}</span></th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each [...permAreas.entries()] as [area, perms]}
              <tr class="area-header-row">
                <td colspan={roles.length + 1} class="area-header">{area}</td>
              </tr>
              {#each perms as perm}
                <tr>
                  <td class="perm-label">{perm.label}</td>
                  {#each roles as role}
                    <td class="perm-cell">
                      {#if hasPerm(role.id, perm.area, perm.key)}
                        <span class="check" title="Has permission" aria-label="Allowed">✓</span>
                      {:else}
                        <span class="cross" aria-label="Denied">—</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}

  <p class="note">System roles (ADMIN, VIEWER) cannot be modified or deleted. Role assignments are managed via <strong>Admin → Users</strong>.</p>
</div>

<!-- Create role modal -->
<Modal open={showCreate} title="Create Role" size="sm" onclose={() => showCreate = false}>
  <div class="modal-body">
    {#if createError}<AppAlert tone="error">{createError}</AppAlert>{/if}
    <label class="field">
      <span>Key <span class="req">*</span></span>
      <input bind:value={createForm.key} placeholder="QA_LEAD" />
    </label>
    <label class="field">
      <span>Label <span class="req">*</span></span>
      <input bind:value={createForm.label} placeholder="QA Lead" />
    </label>
    <label class="field">
      <span>Description</span>
      <textarea bind:value={createForm.description} rows={2} placeholder="Role description…"></textarea>
    </label>
    <label class="field">
      <span>Color</span>
      <select bind:value={createForm.color}>
        <option value="info">Blue</option>
        <option value="success">Green</option>
        <option value="warning">Amber</option>
        <option value="danger">Red</option>
        <option value="neutral">Gray</option>
      </select>
    </label>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => showCreate = false}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={handleCreate} disabled={createBusy}>{createBusy ? 'Creating…' : 'Create'}</Button>
    </div>
  </div>
</Modal>

<!-- Permission editor modal -->
<Modal open={showPermModal} title="Edit Permissions — {editingRole?.label}" size="lg" onclose={() => showPermModal = false}>
  <div class="modal-body perm-editor">
    {#each [...permAreas.entries()] as [area, perms]}
      <div class="perm-area-group">
        <h3 class="perm-area-title">{area}</h3>
        <div class="perm-checks">
          {#each perms as perm}
            <label class="perm-check">
              <input type="checkbox" checked={editingPerms.has(permKey(perm.area, perm.key))} onchange={() => togglePerm(perm.area, perm.key)} />
              <span>{perm.label}</span>
            </label>
          {/each}
        </div>
      </div>
    {/each}
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => showPermModal = false}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={savePermissions} disabled={permBusy}>{permBusy ? 'Saving…' : 'Save'}</Button>
    </div>
  </div>
</Modal>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  .sk-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius, 8px);
    background: var(--color-surface);
    min-height: 154px;
  }

  /* Role cards */
  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  @media (max-width: 640px) {
    .roles-grid {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      gap: 12px;
      padding-bottom: 8px;
      grid-template-columns: none;
    }

    .roles-grid :global(.card) {
      flex: 0 0 85vw;
      max-width: 320px;
      scroll-snap-align: start;
    }
  }

  .role-card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 154px;
  }

  .role-card-head { margin-bottom: 2px; }

  .role-display {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .role-desc {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
    flex: 1;
  }

  .role-card-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .system-tag {
    display: inline-flex;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .field input, .field select, .field textarea {
    font: inherit;
    font-size: 0.875rem;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-weight: 400;
  }

  .req { color: var(--color-danger); }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
  }

  .perm-editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .perm-area-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .perm-area-title {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin: 0 0 2px;
  }

  .perm-checks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 4px;
  }

  .perm-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .muted { color: var(--color-text-muted); }

  /* Badges */
  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .role-badge-danger  { background: color-mix(in srgb, var(--color-danger), transparent 84%); color: var(--color-danger); }
  .role-badge-warning { background: color-mix(in srgb, #f59e0b, transparent 84%); color: #b45309; }
  .role-badge-info    { background: #dbeafe; color: #1d4ed8; }
  .role-badge-success { background: #dcfce7; color: #15803d; }
  .role-badge-neutral { background: var(--color-accent-subtle); color: var(--color-text-muted); }

  .panel-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 16px;
    color: var(--color-text);
  }

  .matrix-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .matrix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    min-width: 560px;
  }

  .matrix-table thead tr {
    border-bottom: 2px solid var(--color-border);
  }

  .matrix-table th {
    padding: 10px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    text-align: left;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .area-col { min-width: 260px; }
  .role-col { text-align: center; min-width: 88px; }
  .role-col .role-badge { font-size: 0.62rem; }

  .area-header-row { background: transparent; }
  .area-header {
    padding: 14px 12px 6px;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 95%);
    border-top: 1px solid var(--color-border);
  }

  .matrix-table tbody tr:hover { background: color-mix(in srgb, var(--color-accent), transparent 95%); }
  .matrix-table tbody tr:not(.area-header-row) { border-bottom: 1px solid var(--color-border); }

  .perm-label {
    padding: 10px 12px;
    color: var(--color-text);
    line-height: 1.4;
  }

  .perm-cell {
    text-align: center;
    padding: 10px 12px;
  }

  .check {
    color: var(--color-success, #0d9488);
    font-size: 0.9rem;
    font-weight: 800;
  }

  .cross {
    color: var(--color-border);
    font-size: 0.85rem;
  }

  .note {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
    margin: 0;
    padding: 0 4px;
  }

  .note strong { color: var(--color-text); font-style: normal; }

  @media (max-width: 640px) {
    .roles-grid { grid-template-columns: 1fr; }
  }
</style>

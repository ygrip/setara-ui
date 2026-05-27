<svelte:head>
  <title>Roles — Admin — Setara</title>
</svelte:head>

<script lang="ts">
  const ROLES = [
    {
      key: 'ADMIN',
      color: 'danger',
      label: 'Admin',
      desc: 'Full platform access — organization settings, user management, API keys, and all project operations.'
    },
    {
      key: 'QA_LEAD',
      color: 'warning',
      label: 'QA Lead',
      desc: 'Manages test repository, release plans, evidence sign-off, and can approve draft scenarios.'
    },
    {
      key: 'QA',
      color: 'info',
      label: 'QA Engineer',
      desc: 'Full access to executions, test cases, coverage, and release plans. Cannot approve drafts or modify org settings.'
    },
    {
      key: 'DEVELOPER',
      color: 'success',
      label: 'Developer',
      desc: 'Read access to executions and coverage. Can trigger manual runs via API key.'
    },
    {
      key: 'VIEWER',
      color: 'neutral',
      label: 'Viewer',
      desc: 'Read-only access to dashboards, execution results, and coverage views.'
    }
  ] as const;

  type RoleKey = typeof ROLES[number]['key'];

  // Permission matrix: area → permission → which roles have it
  type Permission = { label: string; roles: RoleKey[] };
  type Area = { area: string; permissions: Permission[] };

  const MATRIX: Area[] = [
    {
      area: 'Organization',
      permissions: [
        { label: 'View tribes & squads', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] },
        { label: 'Create / edit tribes & squads', roles: ['ADMIN'] },
        { label: 'Manage users & assignments', roles: ['ADMIN'] },
        { label: 'Manage project API keys', roles: ['ADMIN'] },
        { label: 'View admin panel', roles: ['ADMIN'] }
      ]
    },
    {
      area: 'Projects',
      permissions: [
        { label: 'View project dashboard', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] },
        { label: 'Create new projects', roles: ['ADMIN'] },
        { label: 'Edit project settings', roles: ['ADMIN', 'QA_LEAD'] },
        { label: 'View coverage metrics', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] }
      ]
    },
    {
      area: 'Test Repository',
      permissions: [
        { label: 'View scenarios & directories', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] },
        { label: 'Create / edit scenarios', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'Approve / reject draft scenarios', roles: ['ADMIN', 'QA_LEAD'] },
        { label: 'Archive scenarios', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'Create / rename / delete directories', roles: ['ADMIN', 'QA_LEAD'] },
        { label: 'Bulk import scenarios (Excel)', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'View quality / coverage maps', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] }
      ]
    },
    {
      area: 'Executions',
      permissions: [
        { label: 'View execution list & detail', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] },
        { label: 'Trigger manual run', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER'] },
        { label: 'Ingest via API key', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER'] }
      ]
    },
    {
      area: 'Release Plans',
      permissions: [
        { label: 'View release plans', roles: ['ADMIN', 'QA_LEAD', 'QA', 'DEVELOPER', 'VIEWER'] },
        { label: 'Create / edit plans', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'Add / remove scenario scope', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'Select execution evidence', roles: ['ADMIN', 'QA_LEAD', 'QA'] },
        { label: 'Sign off (close) plan', roles: ['ADMIN', 'QA_LEAD'] },
        { label: 'Archive plan', roles: ['ADMIN', 'QA_LEAD'] }
      ]
    }
  ];

  function hasPermission(roles: readonly RoleKey[], roleKey: string): boolean {
    return (roles as string[]).includes(roleKey);
  }

  let activeRoleTab = $state<RoleKey>('ADMIN');
</script>

<div class="section-wrap">
  <!-- Role tabs -->
  <div class="role-tabs" role="tablist">
    {#each ROLES as role}
      <button
        class="role-tab"
        class:role-tab--active={activeRoleTab === role.key}
        class:role-tab--danger={role.color === 'danger'}
        class:role-tab--warning={role.color === 'warning'}
        class:role-tab--info={role.color === 'info'}
        class:role-tab--success={role.color === 'success'}
        class:role-tab--neutral={role.color === 'neutral'}
        role="tab"
        aria-selected={activeRoleTab === role.key}
        onclick={() => activeRoleTab = role.key}
      >
        <span class="role-tab-key">{role.key.replace('_', ' ')}</span>
        <span class="role-tab-label">{role.label}</span>
      </button>
    {/each}
  </div>

  <!-- Active role detail -->
  {#each ROLES.filter(r => r.key === activeRoleTab) as role}
    <div class="role-detail-card">
      <h2 class="role-detail-title">{role.label}</h2>
      <p class="role-detail-desc">{role.desc}</p>
    </div>
  {/each}

  <!-- Permission matrix -->
  <div class="panel">
    <h2 class="panel-title">Permission Matrix</h2>
    <div class="matrix-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="area-col">Permission</th>
            {#each ROLES as role}
              <th class="role-col">
                <span class="role-badge role-badge-{role.color}">{role.key}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each MATRIX as section}
            <tr class="area-header-row">
              <td colspan={ROLES.length + 1} class="area-header">{section.area}</td>
            </tr>
            {#each section.permissions as perm}
              <tr>
                <td class="perm-label">{perm.label}</td>
                {#each ROLES as role}
                  <td class="perm-cell">
                    {#if hasPermission(perm.roles, role.key)}
                      <span class="check" title="{role.key} has this permission" aria-label="Allowed">✓</span>
                    {:else}
                      <span class="cross" title="{role.key} does not have this permission" aria-label="Denied">—</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Note -->
  <p class="note">
    Role assignments are managed per-project via the <strong>Admin → Users</strong> panel.
    Global system roles (ADMIN) apply across all projects.
  </p>
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  /* Role tabs */
  .role-tabs {
    display: flex;
    gap: 2px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 4px;
    overflow-x: auto;
  }

  .role-tab {
    flex: 1;
    min-width: 100px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: calc(var(--radius) - 2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: background 0.15s, color 0.15s;
  }

  .role-tab-key {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    opacity: 0.6;
  }

  .role-tab-label { font-weight: 600; }

  .role-tab--active {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow);
  }

  .role-tab--active .role-tab-key { opacity: 1; }

  .role-tab--active.role-tab--danger  { color: var(--color-danger); }
  .role-tab--active.role-tab--warning { color: #b45309; }
  .role-tab--active.role-tab--info    { color: #1d4ed8; }
  .role-tab--active.role-tab--success { color: #15803d; }
  .role-tab--active.role-tab--neutral { color: var(--color-text); }

  /* Role detail card */
  .role-detail-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .role-detail-title { font-size: 1rem; font-weight: 700; margin: 0 0 8px; color: var(--color-text); }

  .role-detail-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  /* Matrix */
  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

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

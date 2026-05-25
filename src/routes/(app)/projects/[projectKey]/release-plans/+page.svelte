<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { archivePlan, createPlan, type ReleasePlan } from '$lib/api/plans';

  let { data } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let showCreate = $state(false);
  let filterText = $state('');
  let sortBy = $state<'name' | 'date'>('date');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let showLegend = $state(false);

  let name = $state('');
  let releaseVersion = $state('');
  let description = $state('');
  let passThreshold = $state(95);
  let coverageThreshold = $state(90);

  const plans = $derived(
    data.plans
      .filter((plan: ReleasePlan) => {
        const text = `${plan.name} ${plan.releaseVersion ?? ''} ${plan.status}`.toLowerCase();
        return text.includes(filterText.toLowerCase());
      })
      .sort((a: ReleasePlan, b: ReleasePlan) => {
        const result = sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : a.createdAt.localeCompare(b.createdAt);
        return sortDir === 'asc' ? result : -result;
      })
  );

  const statusDefs = [
    { status: 'OPEN', color: 'neutral', desc: 'Plan created but no scenario scope assigned yet.' },
    { status: 'ACTIVE', color: 'info', desc: 'Scenarios are scoped and execution evidence is being collected.' },
    { status: 'IN_PROGRESS', color: 'info', desc: 'Scenarios are scoped and execution evidence is being collected.' },
    { status: 'AT_RISK', color: 'warning', desc: 'Plan is at risk — some quality gates may not be met.' },
    { status: 'CLOSED', color: 'success', desc: 'Plan has been signed off. Every scenario has evidence.' },
    { status: 'ARCHIVED', color: 'muted', desc: 'Plan has been archived and is no longer active.' }
  ];

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'CLOSED':
        return 'success';
      case 'ACTIVE':
      case 'IN_PROGRESS':
        return 'info';
      case 'AT_RISK':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function sortPlans(field: 'name' | 'date') {
    sortDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc';
    sortBy = field;
  }

  function sortIndicator(field: 'name' | 'date'): string {
    if (sortBy !== field) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  function resetForm() {
    name = '';
    releaseVersion = '';
    description = '';
    passThreshold = 95;
    coverageThreshold = 90;
  }

  async function runAction(work: () => Promise<void>) {
    busy = true;
    actionError = '';
    try {
      await work();
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await runAction(async () => {
      const plan = await createPlan(data.projectKey, {
        name: name.trim(),
        releaseVersion: releaseVersion.trim() || undefined,
        description: description.trim() || undefined,
        passThreshold,
        coverageThreshold
      });
      showCreate = false;
      resetForm();
      await goto(`/projects/${data.projectKey}/release-plans/${plan.id}`);
    });
  }

  async function handleArchive(plan: ReleasePlan, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Archive ${plan.name}?`)) return;
    await runAction(async () => archivePlan(data.projectKey, plan.id));
  }
</script>

<svelte:head>
  <title>Release Plans — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Release Plans</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Release Plans</h1>
      <p class="page-subtitle">Track release readiness, scope, evidence, and quality gates.</p>
    </div>
    <button class="primary-btn" onclick={() => showCreate = true}>+ New Plan</button>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load release plans — {data.error}</div>
  {/if}
  {#if actionError}
    <div class="error-banner">{actionError}</div>
  {/if}

  <section class="section">
    <div class="toolbar">
      <div>
        <h2>Plans</h2>
        <p>{plans.length} visible of {data.plans.length} plans</p>
      </div>
      <input bind:value={filterText} placeholder="Filter plans" />
    </div>

    {#if data.plans.length === 0}
      <div class="empty-state">No release plans yet.</div>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th><button class="sort-button" onclick={() => sortPlans('name')}>Name <span class="sort-indicator">{sortIndicator('name')}</span></button></th>
            <th>Version</th>
            <th>Status</th>
            <th>Pass Gate</th>
            <th>Coverage Gate</th>
            <th><button class="sort-button" onclick={() => sortPlans('date')}>Created <span class="sort-indicator">{sortIndicator('date')}</span></button></th>
            <th>Updated</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each plans as plan}
            <tr class="click-row" onclick={() => goto(`/projects/${data.projectKey}/release-plans/${plan.id}`)}>
              <td class="bold">{plan.name}</td>
              <td>{plan.releaseVersion ?? '—'}</td>
              <td><Badge text={plan.status} variant={statusVariant(plan.status)} /></td>
              <td>{plan.passThreshold}%</td>
              <td>{plan.coverageThreshold}%</td>
              <td class="muted">{formatDate(plan.createdAt)}</td>
              <td class="muted">{formatDate(plan.updatedAt)}</td>
              <td>
                <button class="danger-btn" onclick={(e) => handleArchive(plan, e)} disabled={busy}>Archive</button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </section>

  <details class="legend" bind:open={showLegend}>
    <summary>Plan Status Reference</summary>
    <div class="status-grid">
      {#each statusDefs as def}
        <div class="status-item">
          <span class="status-badge status-badge--{def.color}">{def.status}</span>
          <span class="status-desc">{def.desc}</span>
        </div>
      {/each}
    </div>
  </details>
</div>

<Modal
  open={showCreate}
  title="Create Release Plan"
  onclose={() => { showCreate = false; resetForm(); }}
>
  <form class="create-form" onsubmit={handleCreate}>
    <label>
      <span>Name</span>
      <input bind:value={name} placeholder="2026.05 Regression" disabled={busy} required />
    </label>
    <label>
      <span>Release Version</span>
      <input bind:value={releaseVersion} placeholder="2026.05" disabled={busy} />
    </label>
    <div class="form-grid">
      <label>
        <span>Pass Threshold</span>
        <input type="number" min="0" max="100" bind:value={passThreshold} disabled={busy} />
      </label>
      <label>
        <span>Coverage Threshold</span>
        <input type="number" min="0" max="100" bind:value={coverageThreshold} disabled={busy} />
      </label>
    </div>
    <label>
      <span>Description</span>
      <textarea bind:value={description} placeholder="Release scope and notes" disabled={busy}></textarea>
    </label>
    <div class="form-actions">
      <button type="button" onclick={() => { showCreate = false; resetForm(); }} disabled={busy}>Cancel</button>
      <button type="submit" class="primary-btn" disabled={busy || !name.trim()}>Create Plan</button>
    </div>
  </form>
</Modal>

<style>
  .page { max-width: min(1520px, 100%); }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .section { margin-bottom: 28px; }
  .section-title, .toolbar h2 { font-size: 1rem; font-weight: 600; margin: 0 0 4px; }

  button, input, textarea { font: inherit; }
  button { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 12px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .primary-btn { background: var(--color-accent); color: white; border-color: var(--color-accent); }
  .primary-btn:hover:not(:disabled) { color: white; }
  .danger-btn { color: var(--color-danger); padding: 6px 10px; }
  input, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 9px 10px; }
  textarea { min-height: 82px; resize: vertical; }
  label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }

  .toolbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .toolbar p { color: var(--color-text-muted); margin: 0; font-size: 0.8rem; }
  .toolbar input { width: min(280px, 100%); }
  .click-row { cursor: pointer; }
  .bold { font-weight: 600; }
  .muted { color: var(--color-text-muted); font-size: 0.82rem; }
  .empty-state { color: var(--color-text-muted); font-size: 0.875rem; padding: 42px 20px; text-align: center; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }
  .legend { margin-top: 8px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); box-shadow: var(--shadow); }
  .legend summary { cursor: pointer; padding: 12px 16px; font-weight: 700; font-size: 0.86rem; color: var(--color-text-muted); }
  .status-grid { display: flex; flex-direction: column; gap: 8px; padding: 0 16px 16px; }
  .status-item { display: flex; align-items: center; gap: 12px; }
  .status-badge { display: inline-flex; align-items: center; justify-content: center; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; min-width: 80px; }
  .status-badge--neutral { background: var(--color-accent-subtle); color: var(--color-text-muted); }
  .status-badge--muted { background: color-mix(in srgb, var(--color-border), transparent 20%); color: var(--color-text-muted); }
  .status-badge--info { background: #dbeafe; color: #1d4ed8; }
  .status-badge--success { background: #dcfce7; color: #15803d; }
  .status-badge--warning { background: #fef9c3; color: #92400e; }
  .status-desc { font-size: 0.8rem; color: var(--color-text-muted); }
  .create-form { display: grid; gap: 14px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

  @media (max-width: 700px) {
    .form-grid { grid-template-columns: 1fr; }
  }
</style>

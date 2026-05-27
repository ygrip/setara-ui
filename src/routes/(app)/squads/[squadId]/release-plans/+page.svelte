<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createSquadPlan, type ReleasePlan } from '$lib/api/squadPlans';

  let { data } = $props();

  let showCreate = $state(false);
  let busy = $state(false);
  let actionError = $state('');
  let filterText = $state('');

  // Create form
  let name = $state('');
  let releaseVersion = $state('');
  let releaseDate = $state('');
  let description = $state('');

  let statusFilter = $state('');
  let sortBy = $state<'name' | 'releaseDate' | 'createdAt'>('createdAt');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = col;
      sortDir = col === 'createdAt' ? 'desc' : 'asc';
    }
  }

  function sortIndicator(col: string): string {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const plans = $derived.by(() => {
    const source = data.plans as ReleasePlan[];
    const q = filterText.toLowerCase();
    let result = source.filter((p) => {
      const text = `${p.name} ${p.releaseVersion ?? ''} ${p.status}`.toLowerCase();
      return text.includes(q) && (!statusFilter || p.status === statusFilter);
    });
    return [...result].sort((a, b) => {
      const va = (sortBy === 'name' ? a.name : sortBy === 'releaseDate' ? a.releaseDate : a.createdAt) ?? '';
      const vb = (sortBy === 'name' ? b.name : sortBy === 'releaseDate' ? b.releaseDate : b.createdAt) ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'CLOSED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'OPEN': return 'neutral';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function resetCreate() {
    name = '';
    releaseVersion = '';
    releaseDate = '';
    description = '';
    actionError = '';
  }

  async function handleCreate() {
    if (!name.trim()) { actionError = 'Name is required.'; return; }
    busy = true;
    actionError = '';
    try {
      await createSquadPlan(data.squadId, {
        name: name.trim(),
        releaseVersion: releaseVersion.trim() || null,
        releaseDate: releaseDate || null,
        description: description.trim() || null
      });
      showCreate = false;
      resetCreate();
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Release Plans — {data.squad?.name ?? data.squadId} — Setara</title>
</svelte:head>

<div class="page">
  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/coverage-overview">Squads</a>
    <span class="sep">›</span>
    <span>{data.squad?.name ?? data.squadId}</span>
    <span class="sep">›</span>
    <span>Release Plans</span>
  </nav>

  <!-- Header -->
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Release Plans</h1>
      {#if data.squad?.tribeName}
        <span class="squad-meta">{data.squad.tribeName} › {data.squad.name}</span>
      {/if}
    </div>
    <Button variant="primary" size="sm" onclick={() => { showCreate = true; resetCreate(); }}>
      + New Plan
    </Button>
  </div>

  {#if data.error}
    <div class="error-banner" role="alert">{data.error}</div>
  {/if}

  <!-- Filter -->
  <div class="filter-bar">
    <input
      class="filter-input"
      type="search"
      placeholder="Filter plans…"
      bind:value={filterText}
      aria-label="Filter release plans"
    />
    <select class="filter-select" bind:value={statusFilter} aria-label="Filter by status">
      <option value="">All statuses</option>
      <option value="OPEN">Open</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="CLOSED">Closed</option>
    </select>
    <span class="filter-count">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
  </div>

  <!-- Table -->
  {#if plans.length === 0}
    <div class="empty-state">
      <p class="empty-title">No release plans yet</p>
      <p class="empty-sub">Create a release plan to coordinate builds across projects and squads.</p>
    </div>
  {:else}
    <div class="table-wrap">
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Status</th>
            <th class="th-sort" onclick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
            <th class="th-sort" onclick={() => toggleSort('releaseDate')}>Release date{sortIndicator('releaseDate')}</th>
            <th>Builds</th>
            <th>Projects</th>
            <th class="th-sort" onclick={() => toggleSort('createdAt')}>Created{sortIndicator('createdAt')}</th>
            <th>Closed</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each plans as plan (plan.id)}
            <tr
              class="plan-row"
              onclick={() => window.location.href = `/squads/${data.squadId}/release-plans/${plan.id}`}
            >
              <td><Badge text={plan.status} variant={statusVariant(plan.status)} /></td>
              <td class="plan-name-cell">
                <span class="plan-name">{plan.name}</span>
                {#if plan.releaseVersion}
                  <span class="plan-version">{plan.releaseVersion}</span>
                {/if}
              </td>
              <td class="nowrap muted">{plan.releaseDate ? formatDate(plan.releaseDate as string) : '—'}</td>
              <td>
                {#if (plan.totalBuilds ?? 0) > 0}
                  <div class="builds-cell">
                    <span class="builds-text">{plan.verifiedBuilds ?? 0} / {plan.totalBuilds}</span>
                    <div class="builds-bar">
                      <div
                        class="builds-bar-fill"
                        class:all-verified={(plan.verifiedBuilds ?? 0) === plan.totalBuilds}
                        style="width:{Math.round(((plan.verifiedBuilds ?? 0) / (plan.totalBuilds ?? 1)) * 100)}%"
                      ></div>
                    </div>
                  </div>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="muted">{(plan.totalProjects ?? 0) > 0 ? plan.totalProjects : '—'}</td>
              <td class="nowrap muted">{formatDate(plan.createdAt)}</td>
              <td class="nowrap muted">{formatDate(plan.closedAt)}</td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    </div>
  {/if}
</div>

<!-- Create plan modal -->
<Modal open={showCreate} title="New Release Plan" size="md" onclose={() => { showCreate = false; resetCreate(); }}>
  <div class="form-fields">
    <div class="field">
      <label class="field-label" for="plan-name">Name <span class="required">*</span></label>
      <input id="plan-name" class="field-input" type="text" bind:value={name} placeholder="Sprint 24.06 Release" />
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label" for="plan-version">Release Version</label>
        <input id="plan-version" class="field-input" type="text" bind:value={releaseVersion} placeholder="24.06" />
      </div>
      <div class="field">
        <label class="field-label" for="plan-date">Release Date</label>
        <input id="plan-date" class="field-input" type="date" bind:value={releaseDate} />
      </div>
    </div>
    <div class="field">
      <label class="field-label" for="plan-desc">Description</label>
      <textarea id="plan-desc" class="field-textarea" bind:value={description} placeholder="Optional description…" rows={3}></textarea>
    </div>
    {#if actionError}<p class="form-error">{actionError}</p>{/if}
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => { showCreate = false; resetCreate(); }}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={handleCreate} disabled={busy}>
        {busy ? 'Creating…' : 'Create Plan'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .page { max-width: min(1200px, 100%); display: flex; flex-direction: column; gap: 0; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .page-header-left { display: flex; flex-direction: column; gap: 2px; }
  .page-title { font-size: clamp(1.25rem, 4vw, 1.5rem); font-weight: 700; margin: 0; }
  .squad-meta { font-size: 0.8rem; color: var(--color-text-muted); }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 20px; }
  .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-input { flex: 1; max-width: 260px; font: inherit; font-size: 0.875rem; padding: 7px 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
  .filter-input:focus { outline: none; border-color: var(--color-accent); }
  .filter-select { font: inherit; font-size: 0.875rem; padding: 7px 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
  .filter-count { font-size: 0.8rem; color: var(--color-text-muted); margin-left: auto; }
  .table-wrap { overflow-x: auto; border-radius: var(--radius); margin-bottom: 24px; }
  .th-sort { cursor: pointer; user-select: none; }
  .th-sort:hover { color: var(--color-accent); }
  .plan-row { cursor: pointer; }
  .plan-row:hover td { background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .plan-name-cell { display: flex; flex-direction: column; gap: 2px; }
  .plan-name { font-weight: 600; }
  .plan-version { font-size: 0.72rem; color: var(--color-accent); font-family: var(--font-mono, monospace); }
  .muted { color: var(--color-text-muted); font-size: 0.875rem; }
  .nowrap { white-space: nowrap; }
  .builds-cell { display: flex; flex-direction: column; gap: 3px; min-width: 80px; }
  .builds-text { font-size: 0.8rem; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .builds-bar { height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
  .builds-bar-fill { height: 100%; background: var(--color-accent); border-radius: 2px; }
  .builds-bar-fill.all-verified { background: #15803d; }
  .empty-state { text-align: center; padding: 64px 24px; color: var(--color-text-muted); }
  .empty-title { font-size: 0.925rem; margin: 0 0 8px; color: var(--color-text); }
  .empty-sub { font-size: 0.8rem; opacity: 0.7; margin: 0; }
  .form-fields { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
  .required { color: var(--color-danger); }
  .field-input, .field-textarea { font: inherit; font-size: 0.875rem; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); width: 100%; box-sizing: border-box; }
  .field-input:focus, .field-textarea:focus { outline: none; border-color: var(--color-accent); }
  .field-textarea { resize: vertical; }
  .form-error { font-size: 0.8rem; color: var(--color-danger); margin: 0; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
</style>

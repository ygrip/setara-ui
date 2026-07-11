<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createSquadPlan, type ReleasePlan } from '$lib/api/squadPlans';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

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

  $effect(() => {
    sortBy = (data.sortBy as 'name' | 'releaseDate' | 'createdAt') ?? 'createdAt';
    sortDir = (data.sortDir as 'asc' | 'desc') ?? 'desc';
  });

  function toggleSort(col: typeof sortBy) {
    const nextDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : (col === 'createdAt' ? 'desc' : 'asc');
    const params = new URLSearchParams(window.location.search);
    params.set('sort_by', col);
    params.set('sort_dir', nextDir);
    goto(`?${params.toString()}`);
  }

  function sortIndicator(col: string): string {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // Client-side text/status filter only; order is backend-owned
  const plans = $derived.by(() => {
    const source = data.plans as ReleasePlan[];
    const q = filterText.toLowerCase();
    return source.filter((p) => {
      const text = `${p.name} ${p.releaseVersion ?? ''} ${p.status}`.toLowerCase();
      return text.includes(q) && (!statusFilter || p.status === statusFilter);
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
    <Button variant="primary" onclick={() => { showCreate = true; resetCreate(); }}
      icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    >
      New Plan
    </Button>
  </div>

  {#if data.error}
    <AppAlert tone="error">{data.error}</AppAlert>
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
    <EmptyState
      title="No release plans yet"
      hint="Create a release plan to coordinate builds across projects and squads."
      minHeight="320px"
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </svelte:fragment>
    </EmptyState>
  {:else}
    <DataTable>
      {#snippet head()}
          <tr>
            <th>Status</th>
            <th class="th-sort" onclick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
            <th class="th-sort" onclick={() => toggleSort('releaseDate')}>Release Date{sortIndicator('releaseDate')}</th>
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
              <td data-label="Status"><Badge text={plan.status} variant={statusVariant(plan.status)} /></td>
              <td data-label="Name" class="plan-name-cell">
                <span class="plan-name">{plan.name}</span>
                {#if plan.releaseVersion}
                  <span class="plan-version">{plan.releaseVersion}</span>
                {/if}
              </td>
              <td data-label="Release Date" class="nowrap muted">{plan.releaseDate ? formatDate(plan.releaseDate as string) : '—'}</td>
              <td data-label="Builds">
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
              <td data-label="Projects" class="muted">{(plan.totalProjects ?? 0) > 0 ? plan.totalProjects : '—'}</td>
              <td data-label="Created" class="nowrap muted">{formatDate(plan.createdAt)}</td>
              <td data-label="Closed" class="nowrap muted">{formatDate(plan.closedAt)}</td>
            </tr>
          {/each}
        {/snippet}
    </DataTable>
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
  .page { max-width: min(100%); display: flex; flex-direction: column; gap: 0; min-height: calc(100vh - 80px); }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .page-header-left { display: flex; flex-direction: column; gap: 2px; }
  .page-title { font-size: clamp(1.25rem, 4vw, 1.5rem); font-weight: 700; margin: 0; }
  .squad-meta { font-size: 0.8rem; color: var(--color-text-muted); }
  :global(.page > .app-alert) { margin-bottom: 20px; }
  .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-input { flex: 1; max-width: 260px; font: inherit; font-size: 0.875rem; padding: 7px 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
  .filter-input:focus { outline: none; border-color: var(--color-accent); }
  .filter-select { font: inherit; font-size: 0.875rem; padding: 7px 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
  .filter-count { font-size: 0.8rem; color: var(--color-text-muted); margin-left: auto; }
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

  @media (max-width: 700px) {
    .page-header { flex-direction: column; gap: 12px; }
    .filter-bar { flex-direction: column; align-items: stretch; }
    .filter-input { max-width: none; }
    .field-row { grid-template-columns: 1fr; }
  }
</style>

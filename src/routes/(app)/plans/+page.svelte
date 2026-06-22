<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import AppSkeleton from '$lib/ui/display/AppSkeleton.svelte';
  import { listAllPlans, type ReleasePlan } from '$lib/api/plans';
  import { listAllSquads, type Squad } from '$lib/api/organization';
  import { createSquadPlan } from '$lib/api/squadPlans';

  let plans = $state<ReleasePlan[]>([]);
  let squads = $state<Squad[]>([]);
  let selectedSquad = $state('');
  let selectedStatus = $state('');
  let nameFilter = $state('');
  let sortBy = $state<'name' | 'squadName' | 'releaseDate' | 'createdAt'>('createdAt');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let loading = $state(true);
  let error = $state('');
  let showCreate = $state(false);
  let createBusy = $state(false);
  let createError = $state('');
  let createForm = $state({ squadId: '', name: '', releaseDate: '', description: '' });

  async function loadPlans() {
    loading = true;
    error = '';
    try {
      const page = await listAllPlans(
        selectedSquad || undefined,
        undefined, 200,
        sortBy, sortDir,
        selectedStatus || undefined
      );
      plans = page.items;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load plans';
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    try {
      const page = await listAllSquads(undefined, 100);
      squads = page.items ?? [];
    } catch { /* ignore */ }
  });

  // Re-fetch when status or squad filter changes (also fires on initial mount)
  $effect(() => {
    void selectedStatus;
    void selectedSquad;
    loadPlans();
  });

  async function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = col;
      sortDir = col === 'createdAt' ? 'desc' : 'asc';
    }
    await loadPlans();
  }

  function sortIndicator(col: string): string {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // Name filter stays client-side (200-record cap already loaded from backend)
  const filtered = $derived.by(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(p => p.name.toLowerCase().includes(q) || (p.releaseVersion ?? '').toLowerCase().includes(q));
  });

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    if (status === 'CLOSED') return 'success';
    if (status === 'IN_PROGRESS') return 'info';
    return 'neutral';
  }

  const totalPlans = $derived(plans.length);
  const openPlans = $derived(plans.filter(p => p.status === 'OPEN').length);
  const inProgressPlans = $derived(plans.filter(p => p.status === 'IN_PROGRESS').length);
  const closedPlans = $derived(plans.filter(p => p.status === 'CLOSED').length);

  function formatDate(d: string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function buildProgress(plan: ReleasePlan): string {
    const total = plan.totalBuilds ?? 0;
    const verified = plan.verifiedBuilds ?? 0;
    if (total === 0) return '—';
    return `${verified} / ${total}`;
  }

  function buildProgressPct(plan: ReleasePlan): number {
    const total = plan.totalBuilds ?? 0;
    const verified = plan.verifiedBuilds ?? 0;
    if (total === 0) return 0;
    return Math.round((verified / total) * 100);
  }

  async function handleCreate() {
    if (!createForm.squadId || !createForm.name.trim()) {
      createError = 'Squad and plan name are required.';
      return;
    }
    createBusy = true;
    createError = '';
    try {
      const plan = await createSquadPlan(createForm.squadId, {
        name: createForm.name.trim(),
        releaseDate: createForm.releaseDate || null,
        description: createForm.description.trim() || null
      });
      plans = [plan, ...plans];
      showCreate = false;
    } catch (e) {
      createError = e instanceof Error ? e.message : 'Failed to create plan';
    } finally {
      createBusy = false;
    }
  }
</script>

<svelte:head><title>Release Plans — Setara</title></svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Release Plans</h1>
      <p class="subtitle">Track test readiness and quality gates for each release, across your squads.</p>
    </div>
    <Button variant="primary" onclick={() => { showCreate = true; createError = ''; createForm = { squadId: '', name: '', releaseDate: '', description: '' }; }}
      icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    >
      New Plan
    </Button>
  </div>

  <div class="filters-bar">
    <div class="search-wrap">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        class="search-input"
        type="search"
        placeholder="Search plans…"
        bind:value={nameFilter}
        aria-label="Search plans by name"
      />
    </div>

    <select bind:value={selectedSquad} onchange={loadPlans} aria-label="Filter by squad">
      <option value="">All squads</option>
      {#each squads as squad}
        <option value={squad.id}>{squad.name}</option>
      {/each}
    </select>

    <select bind:value={selectedStatus} aria-label="Filter by status">
      <option value="">All statuses</option>
      <option value="OPEN">Open</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="CLOSED">Closed</option>
    </select>

    <span class="count">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</span>
  </div>

  {#if error}
    <AppAlert tone="error">{error}</AppAlert>
  {/if}

  {#if !loading && totalPlans > 0}
    <div class="metrics-row">
      <MetricCard label="Total Plans" value={totalPlans} variant="default" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <MetricCard label="Open" value={openPlans} variant="default" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      <MetricCard label="In Progress" value={inProgressPlans} variant="info" icon="M13 10V3L4 14h7v7l9-11h-7z" />
      <MetricCard label="Closed" value={closedPlans} variant="success" icon="M5 13l4 4L19 7" />
    </div>
  {/if}

  {#if !loading && filtered.length === 0}
    <div class="empty">No release plans found.</div>
  {:else}
    <div class="table-wrap">
      <table class="plans-table">
        <thead>
          <tr>
            <th>Status</th>
            <th class="th-sort" onclick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
            <th class="th-sort" onclick={() => toggleSort('squadName')}>Squad{sortIndicator('squadName')}</th>
            <th class="th-sort" onclick={() => toggleSort('releaseDate')}>Release date{sortIndicator('releaseDate')}</th>
            <th>Builds (verified / total)</th>
            <th>Projects</th>
            <th class="th-sort" onclick={() => toggleSort('createdAt')}>Created{sortIndicator('createdAt')}</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            {#each Array(5) as _, i}
              <tr class="skeleton-row">
                <td><AppSkeleton width="64px" height="20px" radius="4px" /></td>
                <td><AppSkeleton width="180px" /></td>
                <td><AppSkeleton width="100px" /></td>
                <td><AppSkeleton width="80px" /></td>
                <td><AppSkeleton width="90px" /></td>
                <td><AppSkeleton width="32px" /></td>
                <td><AppSkeleton width="80px" /></td>
                <td><AppSkeleton width="80px" /></td>
              </tr>
            {/each}
          {:else}
          {#each filtered as plan (plan.id)}
            <tr
              class="plan-row"
              onclick={() => goto(`/squads/${plan.squadId}/release-plans/${plan.id}`)}
            >
              <td><Badge text={plan.status.replace('_', ' ')} variant={statusVariant(plan.status)} /></td>
              <td class="plan-name-cell">
                <span class="plan-name">{plan.name}</span>
                {#if plan.releaseVersion}
                  <span class="plan-version">{plan.releaseVersion}</span>
                {/if}
                {#if plan.description}
                  <span class="plan-desc">{plan.description}</span>
                {/if}
              </td>
              <td class="muted">{plan.squadName ?? '—'}</td>
              <td class="nowrap muted">{formatDate(plan.releaseDate)}</td>
              <td>
                {#if (plan.totalBuilds ?? 0) > 0}
                  <div class="builds-cell">
                    <span class="builds-text">{buildProgress(plan)}</span>
                    <div class="builds-bar">
                      <div class="builds-bar-fill" style="width:{buildProgressPct(plan)}%"
                        class:all-verified={plan.verifiedBuilds === plan.totalBuilds}></div>
                    </div>
                  </div>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="muted">{plan.totalProjects != null && plan.totalProjects > 0 ? plan.totalProjects : '—'}</td>
              <td class="nowrap muted">{formatDate(plan.createdAt)}</td>
              <td class="nowrap muted">{formatDate(plan.closedAt)}</td>
            </tr>
          {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<Modal open={showCreate} title="New Release Plan" size="md" onclose={() => showCreate = false}>
  <div class="create-form">
    <div class="cf-field">
      <label class="cf-label" for="cf-squad">Squad <span class="cf-required">*</span></label>
      <select id="cf-squad" class="cf-input" bind:value={createForm.squadId}>
        <option value="">Select squad…</option>
        {#each squads as squad}
          <option value={squad.id}>{squad.name}{squad.tribeName ? ` · ${squad.tribeName}` : ''}</option>
        {/each}
      </select>
    </div>
    <div class="cf-field">
      <label class="cf-label" for="cf-name">Plan name <span class="cf-required">*</span></label>
      <input id="cf-name" class="cf-input" type="text" bind:value={createForm.name} placeholder="May Release Sprint" />
    </div>
    <div class="cf-field">
      <label class="cf-label" for="cf-date">Target release date <span class="cf-optional">(optional)</span></label>
      <input id="cf-date" class="cf-input" type="date" bind:value={createForm.releaseDate} />
    </div>
    <div class="cf-field">
      <label class="cf-label" for="cf-desc">Description <span class="cf-optional">(optional)</span></label>
      <textarea id="cf-desc" class="cf-input" bind:value={createForm.description} rows={3} placeholder="Describe the scope of this release plan…"></textarea>
    </div>
    {#if createError}<p class="cf-error">{createError}</p>{/if}
    <div class="cf-actions">
      <button class="cf-btn-cancel" onclick={() => showCreate = false} type="button">Cancel</button>
      <button class="cf-btn-submit" onclick={handleCreate} disabled={createBusy} type="button">
        {createBusy ? 'Creating…' : 'Create Plan'}
      </button>
    </div>
  </div>
</Modal>

<style>
  .page { max-width: min(1400px, 100%); }
  .page-header { margin-bottom: 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
  .subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .filters-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .filters-bar select { padding: 7px 11px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.85rem; cursor: pointer; }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-icon { position: absolute; left: 10px; color: var(--color-text-muted); pointer-events: none; }
  .search-input { padding: 7px 11px 7px 30px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.85rem; min-width: 200px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.1); }
  .count { font-size: 0.8rem; color: var(--color-text-muted); margin-left: auto; }
  .metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .th-sort { cursor: pointer; user-select: none; }
  .th-sort:hover { color: var(--color-accent); }
  :global(.page > .app-alert) { margin-bottom: 16px; }
  .empty { color: var(--color-text-muted); padding: 48px; text-align: center; font-size: 0.875rem; }
  .table-wrap { border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  thead { background: var(--color-surface); }
  th { padding: 10px 14px; text-align: left; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
  td { padding: 12px 14px; border-bottom: 1px solid var(--color-border); vertical-align: middle; background: var(--color-surface); }
  .plan-row:last-child td { border-bottom: none; }
  .plan-row { cursor: pointer; }
  .skeleton-row td { vertical-align: middle; padding: 14px; }
  .plan-row:hover td { background: var(--color-accent-subtle, color-mix(in srgb, var(--color-accent), transparent 94%)); }
  .plan-name-cell { display: flex; flex-direction: column; gap: 2px; }
  .plan-name { font-weight: 600; color: var(--color-text); }
  .plan-version { font-size: 0.75rem; color: var(--color-accent); font-family: var(--font-mono, monospace); }
  .plan-desc { font-size: 0.76rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
  .muted { color: var(--color-text-muted); }
  .nowrap { white-space: nowrap; }
  .builds-cell { display: flex; flex-direction: column; gap: 4px; min-width: 100px; }
  .builds-text { font-size: 0.8rem; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .builds-bar { height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
  .builds-bar-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
  .builds-bar-fill.all-verified { background: #15803d; }
  .create-form { display: flex; flex-direction: column; gap: 14px; }
  .cf-field { display: flex; flex-direction: column; gap: 5px; }
  .cf-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }
  .cf-required { color: var(--color-danger); }
  .cf-optional { font-weight: 400; color: var(--color-text-muted); }
  .cf-input { font: inherit; font-size: 0.875rem; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); width: 100%; box-sizing: border-box; }
  .cf-input:focus { outline: none; border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(0,175,165,0.1); }
  textarea.cf-input { resize: vertical; }
  .cf-error { color: var(--color-danger); font-size: 0.8rem; margin: 0; }
  .cf-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
  .cf-btn-cancel { padding: 8px 14px; background: none; border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; font: inherit; color: var(--color-text); }
  .cf-btn-submit { padding: 8px 16px; background: var(--color-accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600; }
  .cf-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 800px) {
    .page-header { flex-direction: column; gap: 12px; }
    .page-header :global(.btn) { width: 100%; justify-content: center; }
    .filters-bar { flex-direction: column; align-items: stretch; }
    .filters-bar select { width: 100%; }
    .search-wrap { width: 100%; }
    .search-input { width: 100%; }
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>

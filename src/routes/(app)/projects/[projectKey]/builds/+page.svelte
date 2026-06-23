<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createBuild, listBuilds, type ProjectBuild } from '$lib/api/builds';

  let { data } = $props();

  let builds = $state<ProjectBuild[]>([]);
  let nextCursor = $state<string | null>(null);
  let loadingMore = $state(false);
  let hasMore = $derived(nextCursor !== null);

  let showCreate = $state(false);
  let creating = $state(false);
  let createError = $state('');
  let form = $state({ name: '', buildKey: '', version: '', description: '', requirements: '' });
  let statusFilter = $state('');
  let nameFilter = $state('');
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  let sentinel = $state<HTMLElement | null>(null);

  // Sync from SSR / SvelteKit route reloads
  $effect(() => {
    builds = data.buildsPage.items;
    nextCursor = data.buildsPage.nextCursor;
  });

  // Combined filter effect — single effect, skip initial mount (SSR already loaded)
  let filterMounted = false;
  $effect(() => {
    const status = statusFilter;
    const q = nameFilter;
    if (!filterMounted) { filterMounted = true; return; }
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      listBuilds(data.projectKey, status || undefined, undefined, undefined, q.trim() || undefined)
        .then(page => { builds = page.items; nextCursor = page.nextCursor; });
    }, 300);
  });

  // Infinite scroll — $effect tracks nextCursor so observer is re-created on each new page
  $effect(() => {
    const el = sentinel;
    const cursor = nextCursor; // tracked dependency — effect re-runs when cursor changes
    if (!el || !cursor) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  });

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    try {
      const page = await listBuilds(data.projectKey, statusFilter || undefined, nextCursor, undefined, nameFilter.trim() || undefined);
      builds = [...builds, ...page.items];
      nextCursor = page.nextCursor;
    } finally {
      loadingMore = false;
    }
  }

  // No client-side filtering — results come from backend
  const filtered = $derived(builds);

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'VERIFIED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'INITIATED': return 'warning';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function pct(value: number): string {
    return `${Number(value || 0).toFixed(0)}%`;
  }

  async function submitCreate() {
    if (!form.name.trim()) return;
    creating = true;
    createError = '';
    try {
      const created = await createBuild(data.projectKey, {
        name: form.name.trim(),
        buildKey: form.buildKey.trim() || undefined,
        version: form.version.trim() || undefined,
        description: form.description.trim() || undefined,
        requirements: form.requirements.trim() || undefined
      });
      builds = [created, ...builds];
      showCreate = false;
      form = { name: '', buildKey: '', version: '', description: '', requirements: '' };
    } catch (error) {
      createError = error instanceof Error ? error.message : 'Unable to create build';
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Builds - {data.project?.name ?? data.projectKey} - Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>›</span>
    <span>Builds</span>
  </nav>

  <header class="page-header">
    <div>
      <h1>Builds</h1>
      <p>Project verification units for automation and manual execution evidence.</p>
    </div>
    <Button variant="primary" onclick={() => showCreate = true}
      icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    >Build</Button>
  </header>

  <div class="filters-bar">
    <div class="search-wrap">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input class="search-input" type="search" placeholder="Search builds…" bind:value={nameFilter} aria-label="Search builds" />
    </div>
    <select bind:value={statusFilter}>
      <option value="">All statuses</option>
      <option value="INITIATED">Initiated</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="VERIFIED">Verified</option>
    </select>
    <span class="count">{filtered.length}{hasMore ? '+' : ''} build{filtered.length !== 1 ? 's' : ''}</span>
  </div>

  <section class="section">
    <div class="table-wrap">
      <table class="builds-table">
        <thead>
          <tr>
            <th>Build</th>
            <th>Status</th>
            <th class="col-hide-sm">Version</th>
            <th>Scenarios</th>
            <th>Pass</th>
            <th class="col-hide-sm">Execution</th>
            <th class="col-hide-xs">Created</th>
            <th class="col-hide-sm">Verified</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as build (build.id)}
            <tr class="build-row" onclick={() => goto(`/projects/${data.projectKey}/builds/${build.id}`)}>
              <td class="name-cell">
                <span class="build-name">{build.name}</span>
                <span class="build-key">{build.buildKey}</span>
              </td>
              <td><Badge text={build.status} variant={statusVariant(build.status)} /></td>
              <td class="col-hide-sm">
                {#if build.version}
                  <span class="version-chip">{build.version}</span>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="num">{build.metrics.totalScenarios}</td>
              <td class="num">{pct(build.metrics.passPercentage)}</td>
              <td class="num col-hide-sm">{pct(build.metrics.executionCoverage)}</td>
              <td class="nowrap muted col-hide-xs">{formatDate(build.createdAt)}</td>
              <td class="nowrap muted col-hide-sm">{formatDate(build.verifiedAt)}</td>
            </tr>
          {/each}
          {#if filtered.length === 0 && !loadingMore}
            <tr><td colspan="8" class="empty-cell">No builds found.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
    <div bind:this={sentinel} class="sentinel">
      {#if loadingMore}<span class="loading-more">Loading…</span>{/if}
    </div>
  </section>
</div>

<Modal open={showCreate} title="Create Build" onclose={() => showCreate = false}>
  <form class="form" onsubmit={(event) => { event.preventDefault(); submitCreate(); }}>
    {#if createError}<div class="error">{createError}</div>{/if}
    <label>Name <span class="req">*</span><input bind:value={form.name} placeholder="Payment May RC2" /></label>
    <label>Build key <span class="opt">(optional)</span><input bind:value={form.buildKey} placeholder="payment-rc2" /></label>
    <label>Version <span class="opt">(optional)</span><input bind:value={form.version} placeholder="2026.05.2" /></label>
    <label>Description <span class="opt">(optional)</span><textarea bind:value={form.description} rows="2"></textarea></label>
    <label>Build Requirements <span class="opt">(optional)</span><textarea bind:value={form.requirements} rows="4" placeholder="Describe what this build must verify — used by AI scenario suggestions"></textarea></label>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => showCreate = false}>Cancel</Button>
      <Button variant="primary" size="sm" type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
    </div>
  </form>
</Modal>

<style>
  .page { max-width: min(1560px, 100%); }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
  .page-header h1 { font-size: 1.6rem; margin: 0 0 4px; }
  .page-header p, .muted { color: var(--color-text-muted); margin: 0; font-size: 0.84rem; }
  .filters-bar { display: flex; gap: .75rem; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
  .filters-bar select { padding: .4rem .75rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font-size: .875rem; cursor: pointer; font: inherit; }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-icon { position: absolute; left: 10px; color: var(--color-text-muted); pointer-events: none; }
  .search-input { padding: 7px 11px 7px 30px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.875rem; min-width: 200px; outline: none; }
  .search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(0,175,165,0.1); }
  .count { font-size: 0.8rem; color: var(--color-text-muted); margin-left: auto; }
  .section { margin-top: 0; }
  .table-wrap { border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; overflow-x: auto; }
  .builds-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .builds-table thead { background: var(--color-surface); }
  .builds-table th { padding: 10px 14px; text-align: left; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
  .builds-table td { padding: 12px 14px; border-bottom: 1px solid var(--color-border); vertical-align: middle; background: var(--color-surface); }
  .build-row:last-child td { border-bottom: none; }
  .build-row { cursor: pointer; }
  .build-row:hover td { background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .name-cell { display: flex; flex-direction: column; gap: 2px; }
  .build-name { font-weight: 600; color: var(--color-text); }
  .build-key { font-size: 0.72rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); }
  .version-chip { display: inline-block; font-family: var(--font-mono, monospace); font-size: 0.72rem; background: var(--color-accent-subtle); color: var(--color-accent); border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%); border-radius: 4px; padding: 1px 6px; }
  .num { font-variant-numeric: tabular-nums; color: var(--color-text-muted); }
  .nowrap { white-space: nowrap; }
  .empty-cell { text-align: center; padding: 48px; color: var(--color-text-muted); font-size: 0.875rem; }
  .sentinel { height: 1px; }
  .loading-more { display: block; text-align: center; padding: 16px; color: var(--color-text-muted); font-size: 0.82rem; }
  .form { display: grid; gap: 14px; }
  .form label { display: grid; gap: 6px; color: var(--color-text-muted); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
  .form input, .form textarea { width: 100%; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); border-radius: 6px; padding: 10px 12px; font: inherit; text-transform: none; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .error { color: var(--color-danger); font-weight: 700; }
  .req { color: var(--color-danger); }
  .opt { font-size: 0.7em; font-weight: 400; text-transform: none; color: var(--color-text-muted); }
  /* Column visibility on smaller viewports */
  @media (max-width: 720px) {
    .page-header { flex-direction: column; }
    .page-header :global(.btn) { width: 100%; justify-content: center; }
    .filters-bar { flex-direction: column; align-items: stretch; }
    .search-wrap { width: 100%; }
    .search-input { min-width: 0; width: 100%; }
    .filters-bar select { width: 100%; }
    .count { margin-left: 0; }
    .col-hide-sm { display: none; }
  }
  @media (max-width: 480px) {
    .col-hide-xs { display: none; }
    .builds-table th, .builds-table td { padding: 10px 10px; }
  }
</style>

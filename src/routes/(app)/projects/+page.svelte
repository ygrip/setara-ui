<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import ProjectGrid from '$lib/components/projects/ProjectGrid.svelte';
  import ProjectListingSkeleton from '$lib/components/projects/ProjectListingSkeleton.svelte';
  import ProjectListTable from '$lib/components/projects/ProjectListTable.svelte';
  import ProjectSummaryRow from '$lib/components/projects/ProjectSummaryRow.svelte';
  import ProjectToolbar from '$lib/components/projects/ProjectToolbar.svelte';
  import {
    createProject,
    getProjectOverview,
    type ProjectHealthStatus,
    type ProjectOverviewOrder,
    type ProjectOverviewResponse,
    type ProjectOverviewSort
  } from '$lib/api/projects';
  import { getValidSession, hasPermission } from '$lib/auth';

  const VIEW_MODE_KEY = 'setara.projects.viewMode';
  type ViewMode = 'grid' | 'list';

  let { data } = $props();
  let overview = $state<ProjectOverviewResponse | null>(null);
  let error = $state<string | null>(null);
  let initialized = $state(false);
  let loading = $state(false);
  let canWrite = $state(false);
  let viewMode = $state<ViewMode>('grid');
  let search = $state('');
  let status = $state<ProjectHealthStatus | ''>('');
  let domain = $state('');
  let sort = $state<ProjectOverviewSort>('lastActivity');
  let order = $state<ProjectOverviewOrder>('desc');
  let showModal = $state(false);
  let creating = $state(false);
  let createError = $state('');
  let formName = $state('');
  let formDescription = $state('');
  let requestSequence = 0;
  let filterReady = false;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let sentinel = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!initialized) {
      overview = data.overview;
      error = data.error;
      initialized = true;
    }
  });

  $effect(() => {
    const node = sentinel;
    const current = overview;
    const busy = loading;
    if (!node || !current || busy || typeof IntersectionObserver === 'undefined') return;
    if (current.page.number + 1 >= current.page.totalPages) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) refresh(current.page.number + 1, true);
    }, { rootMargin: '320px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  });

  onMount(() => {
    canWrite = hasPermission(getValidSession(), 'project:write');
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'list') viewMode = saved;
  });

  $effect(() => {
    const request = { search, status, domain, sort, order };
    if (!filterReady) {
      filterReady = true;
      return;
    }
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refresh(0, false, request), 250);
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
    };
  });

  function setViewMode(value: ViewMode) {
    viewMode = value;
    localStorage.setItem(VIEW_MODE_KEY, value);
  }

  async function refresh(
    page = 0,
    append = false,
    filters = { search, status, domain, sort, order }
  ) {
    const requestId = ++requestSequence;
    loading = true;
    error = null;
    try {
      const next = await getProjectOverview({
        search: filters.search || undefined,
        status: filters.status || undefined,
        domain: filters.domain || undefined,
        sort: filters.sort,
        order: filters.order,
        page
      });
      if (requestId !== requestSequence) return;
      if (append && overview) {
        overview = { ...next, items: [...overview.items, ...next.items] };
      } else {
        overview = next;
      }
    } catch (caught) {
      if (requestId === requestSequence) error = (caught as Error).message;
    } finally {
      if (requestId === requestSequence) loading = false;
    }
  }

  function clearFilters() {
    search = '';
    status = '';
    domain = '';
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    creating = true;
    createError = '';
    try {
      await createProject({ name: formName.trim(), description: formDescription.trim() || undefined });
      formName = '';
      formDescription = '';
      showModal = false;
      await invalidateAll();
      await refresh();
    } catch (caught) {
      createError = (caught as Error).message;
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head><title>Projects - Setara</title></svelte:head>

<div class="page">
  <header class="page-header">
    <div>
      <h1>Projects</h1>
      <p>See project health, recent activity, and where to focus next.</p>
    </div>
    {#if canWrite}<Button variant="primary" onclick={() => showModal = true}>+ New project</Button>{/if}
  </header>

  {#if !overview && loading}
    <ProjectListingSkeleton />
  {:else if !overview && error}
    <section class="error-state" role="alert">
      <h2>Could not load projects</h2>
      <p>The project overview is unavailable. {error}</p>
      <Button onclick={() => refresh()}>Try again</Button>
    </section>
  {:else if overview}
    <ProjectSummaryRow summary={overview.summary} />

    <div class="toolbar-wrap">
      <ProjectToolbar
        {search}
        {status}
        {domain}
        {sort}
        {order}
        view={viewMode}
        domains={overview.filters.domains}
        onSearch={(value) => search = value}
        onStatus={(value) => status = value}
        onDomain={(value) => domain = value}
        onSort={(nextSort, nextOrder) => { sort = nextSort; order = nextOrder; }}
        onView={setViewMode}
      />
    </div>

    {#if error}
      <div class="refresh-error" role="status">
        <span>Projects could not be refreshed. Showing the latest available data.</span>
        <Button variant="secondary" onclick={() => refresh()}>Retry</Button>
      </div>
    {/if}

    {#if overview.items.length === 0}
      <EmptyState
        title={overview.summary.totalProjects === 0 ? 'No projects yet' : 'No projects found'}
        hint={overview.summary.totalProjects === 0
          ? 'Create a project to start tracking quality and test activity.'
          : 'Try changing your search or clearing the selected filters.'}
      >
        <svelte:fragment slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h7M7 16h4"/>
          </svg>
        </svelte:fragment>
        <div slot="actions" class="empty-actions">
          {#if overview.summary.totalProjects > 0}<Button onclick={clearFilters}>Clear filters</Button>{/if}
          {#if canWrite}<Button variant="primary" onclick={() => showModal = true}>Create project</Button>{/if}
        </div>
      </EmptyState>
    {:else}
      <div class:refreshing={loading} aria-busy={loading}>
        {#if viewMode === 'grid'}
          <ProjectGrid projects={overview.items} />
        {:else}
          <ProjectListTable projects={overview.items} />
        {/if}
      </div>

      <div bind:this={sentinel} class="scroll-sentinel" aria-hidden="true"></div>
      {#if loading}<p class="paging-status" role="status">Loading more projects...</p>{/if}
      {#if overview.page.number + 1 >= overview.page.totalPages}
        <p class="paging-status">All matching projects are shown.</p>
      {/if}
    {/if}
  {/if}
</div>

<Modal open={showModal} title="New project" onclose={() => showModal = false}>
  <form onsubmit={handleCreate} class="form">
    <label><span>Project name <b>*</b></span><input bind:value={formName} required placeholder="Payment service" /></label>
    <label><span>Description</span><textarea bind:value={formDescription} placeholder="Optional description" rows="3"></textarea></label>
    {#if createError}<p class="form-error" role="alert">{createError}</p>{/if}
    <div class="form-actions">
      <Button variant="secondary" onclick={() => showModal = false}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create project'}</Button>
    </div>
  </form>
</Modal>

<style>
  .page { max-width: 96rem; min-height: calc(100vh - 5rem); }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
  h1 { margin: 0 0 0.25rem; color: var(--color-text); font-size: 1.5rem; }
  .page-header p { margin: 0; color: var(--color-text-muted); font-size: 0.875rem; }
  .toolbar-wrap { margin: 1rem 0; }
  .refreshing { opacity: 0.68; transition: opacity 120ms ease; }
  .refresh-error, .error-state { border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border)); border-radius: 0.75rem; background: color-mix(in srgb, var(--color-danger) 7%, var(--color-surface)); }
  .refresh-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; padding: 0.7rem 0.9rem; color: var(--color-text); font-size: 0.8rem; }
  .error-state { display: grid; justify-items: start; gap: 0.6rem; padding: 1.25rem; }
  .error-state h2, .error-state p { margin: 0; }
  .error-state h2 { color: var(--color-text); font-size: 1rem; }
  .error-state p { color: var(--color-text-muted); font-size: 0.82rem; }
  .scroll-sentinel { height: 1px; }
  .paging-status { margin: 0; padding: 1rem; color: var(--color-text-muted); font-size: 0.78rem; text-align: center; }
  .empty-actions { display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; }
  .form { display: grid; gap: 1rem; }
  .form label { display: grid; gap: 0.35rem; color: var(--color-text); font-size: 0.8rem; font-weight: 650; }
  .form b { color: var(--color-danger); }
  .form input, .form textarea { padding: 0.65rem 0.7rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .form input:focus-visible, .form textarea:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .form-error { margin: 0; color: var(--color-danger); font-size: 0.78rem; }
  .form-actions { display: flex; justify-content: flex-end; gap: 0.6rem; }
  @media (max-width: 640px) { .page-header { flex-direction: column; } .page-header :global(.btn) { width: 100%; justify-content: center; } .refresh-error { align-items: flex-start; flex-direction: column; } }
</style>

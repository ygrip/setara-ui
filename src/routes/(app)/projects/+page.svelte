<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import { createProject, listProjects, type Project } from '$lib/api/projects';
  import { getValidSession, hasPermission } from '$lib/auth';
  import { formatNumber, formatPercent } from '$lib/utils/format';

  let { data } = $props();

  let canWrite = $state(false);
  let search = $state('');
  let sortBy = $state('createdAt');
  let sortDir = $state('desc');
  let showModal = $state(false);
  let creating = $state(false);
  let createError = $state('');

  let projects = $state<Project[]>(data.projects);
  let nextCursor = $state<string | null>(data.nextCursor);
  let loading = $state(false);
  let sentinel = $state<HTMLElement | null>(null);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let filterMounted = false;

  let formName = $state('');
  let formDesc = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  onMount(() => {
    canWrite = hasPermission(getValidSession(), 'project:write');
  });

  $effect(() => {
    const q = search;
    const by = sortBy;
    const dir = sortDir;
    if (!filterMounted) { filterMounted = true; return; }
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      listProjects(undefined, undefined, by, dir, q.trim() || undefined).then(page => {
        projects = page.items;
        nextCursor = page.nextCursor;
      });
    }, 300);
  });

  $effect(() => {
    const el = sentinel;
    const cursor = nextCursor;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  });

  async function loadMore() {
    if (loading || !nextCursor) return;
    loading = true;
    try {
      const page = await listProjects(nextCursor, undefined, sortBy, sortDir, search.trim() || undefined);
      projects = [...projects, ...page.items];
      nextCursor = page.nextCursor;
    } finally {
      loading = false;
    }
  }

  function setSort(field: string) {
    if (sortBy === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortDir = field === 'name' ? 'asc' : 'desc';
    }
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    creating = true;
    createError = '';
    try {
      await createProject({ name: formName.trim(), description: formDesc.trim() || undefined });
      formName = '';
      formDesc = '';
      showModal = false;
      await invalidateAll();
      const page = await listProjects(undefined, undefined, sortBy, sortDir, search.trim() || undefined);
      projects = page.items;
      nextCursor = page.nextCursor;
    } catch (err) {
      createError = (err as Error).message;
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Projects — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Projects</h1>
      <p class="page-subtitle">Select a project to view scenarios, builds, and coverage.</p>
    </div>
    {#if canWrite}
      <Button variant="primary" onclick={() => showModal = true}>+ New Project</Button>
    {/if}
  </div>

  <!-- Search + sort row -->
  <div class="controls">
    <div class="search-wrap">
      <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        placeholder="Search by name or key…"
        bind:value={search}
        class="search-input"
      />
    </div>
    <div class="sort-group">
      <span class="sort-label">Sort</span>
      <div class="sort-pills">
        {#each [
          { field: 'name', label: 'Name', defaultDir: 'asc' },
          { field: 'createdAt', label: 'Date', defaultDir: 'desc' },
          { field: 'scenarioCount', label: 'Scenarios', defaultDir: 'desc' },
          { field: 'coveragePercent', label: 'Coverage', defaultDir: 'desc' },
        ] as pill}
          <button
            class="sort-pill"
            class:sort-pill--active={sortBy === pill.field}
            onclick={() => setSort(pill.field)}
          >
            {pill.label}
            {#if sortBy === pill.field}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                {#if sortDir === 'asc'}
                  <path d="M5 2l4 6H1z"/>
                {:else}
                  <path d="M5 8L1 2h8z"/>
                {/if}
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>

  {#if data.error}
    <AppAlert tone="error" title="Could not connect to backend">{data.error}</AppAlert>
  {/if}

  {#if projects.length === 0 && !data.error}
    <div class="empty-state">
      {#if search}
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <p class="empty-title">No results for "{search}"</p>
        <p class="empty-hint">Try a different search term.</p>
        <button class="empty-link" onclick={() => search = ''}>Clear search</button>
      {:else}
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <p class="empty-title">No projects yet</p>
        <p class="empty-hint">Create your first project to start tracking test scenarios and coverage.</p>
        {#if canWrite}
          <button class="empty-link" onclick={() => showModal = true}>Create a project →</button>
        {/if}
      {/if}
    </div>
  {:else if projects.length > 0}
    <div class="project-grid">
      {#each projects as project}
        <a class="project-card" href="/projects/{project.projectKey}" aria-label="Open {project.name}">
          <!-- Card header -->
          <div class="card-header">
            <span class="card-key">{project.projectKey}</span>
          </div>

          <!-- Name + description -->
          <div class="card-body">
            <h2 class="card-name">{project.name}</h2>
            {#if project.description}
              <p class="card-desc">{project.description}</p>
            {/if}
          </div>

          <!-- Bento stats grid -->
          <div class="card-bento">
            <div class="bento-cell">
              <span class="bento-val">{project.scenarioCount != null ? formatNumber(project.scenarioCount) : '—'}</span>
              <span class="bento-label">Scenarios</span>
            </div>
            <div class="bento-divider"></div>
            <div class="bento-cell">
              <span class="bento-val bento-val--coverage">{project.coveragePercent != null ? formatPercent(project.coveragePercent) : '—'}</span>
              <span class="bento-label">Coverage</span>
            </div>
          </div>
        </a>
      {/each}
    </div>
    <div bind:this={sentinel} class="sentinel"></div>
    {#if loading}
      <div class="loading-more">Loading more…</div>
    {/if}
  {/if}
</div>

<Modal open={showModal} title="New Project" onclose={() => showModal = false}>
  <form onsubmit={handleCreate} class="form">
    <label class="field">
      <span class="label">Project Name <span class="req">*</span></span>
      <input class="input" type="text" bind:value={formName} required placeholder="My Project"/>
      <span class="hint">Project key is generated automatically from this name.</span>
    </label>
    <label class="field">
      <span class="label">Description</span>
      <textarea class="input textarea" bind:value={formDesc} placeholder="Optional description" rows="3"></textarea>
    </label>
    {#if createError}
      <div class="form-error">{createError}</div>
    {/if}
    <div class="form-actions">
      <Button variant="secondary" onclick={() => showModal = false}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={creating}>
        {creating ? 'Creating…' : 'Create Project'}
      </Button>
    </div>
  </form>
</Modal>

<style>
  .page { max-width: min(1520px, 100%); }

  /* ─── Header ─── */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .page-header { flex-direction: column; gap: 12px; }
    .page-header :global(.btn) { width: 100%; justify-content: center; }
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .page-subtitle {
    color: var(--color-text-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  /* ─── Controls ─── */
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 380px;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-input:focus { border-color: var(--color-accent); }

  .sort-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .sort-label {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .sort-pills {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--color-surface);
  }

  .sort-pill {
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.12s, color 0.12s;
    border-right: 1px solid var(--color-border);
  }

  .sort-pill:last-child { border-right: none; }

  .sort-pill:hover {
    background: color-mix(in srgb, var(--color-accent) 6%, transparent);
    color: var(--color-text);
  }

  .sort-pill--active {
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    color: var(--color-accent);
    font-weight: 600;
  }

  :global(.page > .app-alert) { margin-bottom: 20px; }

  /* ─── Empty state ─── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 72px 20px 56px;
    gap: 8px;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-muted);
    margin-bottom: 6px;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .empty-hint {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin: 0;
    max-width: 280px;
  }

  .empty-link {
    background: none;
    border: none;
    color: var(--color-accent);
    font-size: 0.82rem;
    cursor: pointer;
    padding: 4px 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ─── Grid ─── */
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  /* ─── Project card ─── */
  .project-card {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
    cursor: pointer;
  }

  .project-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 0;
    gap: 8px;
  }

  .card-key {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
    border-radius: 4px;
    padding: 2px 7px;
  }

  .card-date {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .card-body {
    padding: 10px 16px 14px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
    line-height: 1.3;
  }

  .card-desc {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ─── Bento stats ─── */
  .card-bento {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-accent) 3%, var(--color-surface));
  }

  .bento-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    gap: 2px;
  }

  .bento-divider {
    width: 1px;
    background: var(--color-border);
    margin: 8px 0;
  }

  .bento-val {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;
  }

  .bento-val--coverage {
    color: var(--color-success, #16a34a);
  }

  .bento-label {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .sentinel { height: 1px; }

  .loading-more {
    text-align: center;
    padding: 20px;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  /* ─── Form ─── */
  .form { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }
  .req { color: var(--color-danger); }
  .hint { font-size: 0.72rem; color: var(--color-text-muted); }

  .input {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .input:focus { border-color: var(--color-accent); }
  .textarea { resize: vertical; min-height: 72px; }

  .form-error {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.8rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }
</style>

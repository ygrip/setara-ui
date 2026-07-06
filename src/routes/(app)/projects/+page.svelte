<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
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

  let projects = $state<Project[]>([]);
  let nextCursor = $state<string | null>(null);
  $effect(() => { projects = data.projects; nextCursor = data.nextCursor; });
  let loading = $state(false);
  let sentinel = $state<HTMLElement | null>(null);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let filterMounted = false;

  let formName = $state('');
  let formDesc = $state('');

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
    {#if search}
      <EmptyState
        title="No results for '{search}'"
        hint="Try a different search term."
      >
        <svelte:fragment slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </svelte:fragment>
        <div slot="actions">
          <Button onclick={() => search = ''}>Clear search</Button>
        </div>
      </EmptyState>
    {:else}
      <EmptyState
        title="No projects yet"
        hint="Create your first project to start tracking test scenarios and coverage."
      >
        <svelte:fragment slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </svelte:fragment>
        <div slot="actions">
          {#if canWrite}
            <Button onclick={() => showModal = true}>Create a project →</Button>
          {/if}
        </div>
      </EmptyState>
    {/if}

  {:else if projects.length > 0}
    <div class="project-grid">
      {#each projects as project}
        <BentoCard
          title={project.name}
          eyebrow={project.projectKey}
          subtitle={project.description || 'No project description provided.'}
          variant="accent"
          padding="md"
          href={`/projects/${project.projectKey}`}
          interactive
          className="project-bento"
        >
          <div class="project-metrics">
            <div class="project-metric">
              <span class="project-metric-label">Scenarios</span>
              <span class="project-metric-value">
                {project.scenarioCount != null ? formatNumber(project.scenarioCount) : '—'}
              </span>
            </div>
            <div class="project-metric">
              <span class="project-metric-label">Coverage</span>
              <span class="project-metric-value project-metric-value--coverage">
                {project.coveragePercent != null ? formatPercent(project.coveragePercent) : '—'}
              </span>
            </div>
          </div>
        </BentoCard>
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
  .page { 
    max-width: min(1520px, 100%);
    min-height: calc(100vh - 80px);
  }

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

  /* ─── Grid ─── */
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  /* ─── Project card ─── */
  :global(.project-bento) {
    min-height: 220px;
  }

  .project-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-border), transparent 18%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-accent-subtle), transparent 30%);
  }

  .project-metric {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 13px 14px;
  }

  .project-metric + .project-metric {
    border-left: 1px solid color-mix(in srgb, var(--color-border), transparent 18%);
  }

  .project-metric-label {
    color: var(--color-text-muted);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .project-metric-value {
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
  }

  .project-metric-value--coverage {
    color: var(--color-success);
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

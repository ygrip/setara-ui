<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { createProject, type Project } from '$lib/api/projects';
  import { getValidSession, hasPermission } from '$lib/auth';

  let { data } = $props();

  let canWrite = $state(false);
  let search = $state('');
  let showModal = $state(false);
  let creating = $state(false);
  let createError = $state('');

  // Form state
  let formName = $state('');
  let formDesc = $state('');

  const filtered = $derived(
    data.projects.filter(
      (p: Project) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.projectKey.toLowerCase().includes(search.toLowerCase())
    )
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  onMount(() => {
    canWrite = hasPermission(getValidSession(), 'project:write');
  });

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    creating = true;
    createError = '';
    try {
      await createProject({
        name: formName.trim(),
        description: formDesc.trim() || undefined
      });
      formName = '';
      formDesc = '';
      showModal = false;
      await invalidateAll();
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
      <p class="page-subtitle">Manage your test automation projects</p>
    </div>
    {#if canWrite}
      <Button variant="primary" onclick={() => showModal = true}>+ New Project</Button>
    {/if}
  </div>

  <div class="search-bar">
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
    <input
      type="text"
      placeholder="Search projects…"
      bind:value={search}
      class="search-input"
    />
  </div>

  {#if data.error}
    <div class="error-banner">
      Could not connect to backend — {data.error}
    </div>
  {/if}

  {#if filtered.length === 0 && !data.error}
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 7h18M3 12h18M3 17h18"/>
      </svg>
      <p>{search ? 'No projects match your search.' : 'No projects yet. Create your first project.'}</p>
    </div>
  {:else}
    <div class="project-grid">
      {#each filtered as project}
        <a href="/projects/{project.projectKey}" class="project-card">
          <div class="card-top">
            <Badge text={project.projectKey} variant="neutral" />
          </div>
          <h2 class="card-name">{project.name}</h2>
          {#if project.description}
            <p class="card-desc">{project.description}</p>
          {/if}
          <div class="card-meta">
            <span>Created {formatDate(project.createdAt)}</span>
          </div>
        </a>
      {/each}
    </div>
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

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
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

  .search-bar {
    position: relative;
    margin-bottom: 24px;
    max-width: 400px;
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
    padding: 8px 12px 8px 34px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: var(--color-accent);
  }

  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--color-text-muted);
  }

  .empty-state svg {
    margin-bottom: 12px;
    opacity: 0.4;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .project-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .project-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-md);
    text-decoration: none;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .card-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    margin-top: auto;
    padding-top: 8px;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
  }

  /* Form */
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

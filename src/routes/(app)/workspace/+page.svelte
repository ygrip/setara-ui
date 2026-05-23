<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import { type Project } from '$lib/api/projects';

  let { data } = $props();

  let search = $state('');

  const filtered = $derived(
    data.projects.filter(
      (p: Project) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.projectKey.toLowerCase().includes(search.toLowerCase())
    )
  );
</script>

<svelte:head>
  <title>Workspace — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Select a Project</h1>
      <p class="page-subtitle">Choose a project to start working</p>
    </div>
    <a href="/projects" class="manage-link">Manage Projects →</a>
  </div>

  {#if data.error}
    <div class="error-banner">
      Could not connect to backend — {data.error}
    </div>
  {/if}

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

  {#if data.projects.length === 0 && !data.error}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
        <path d="M3 7h18M3 12h18M3 17h18"/>
      </svg>
      <p class="empty-title">No projects yet</p>
      <p class="empty-sub">Get started by creating your first project.</p>
      <a href="/projects" class="create-link">Create your first project →</a>
    </div>
  {:else if filtered.length === 0}
    <div class="empty-state">
      <p>No projects match your search.</p>
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
          <div class="card-footer">
            <span class="open-link">Open Project →</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1100px; }

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
    margin-bottom: 4px;
  }

  .page-subtitle {
    color: var(--color-text-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  .manage-link {
    color: var(--color-accent);
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    padding-top: 4px;
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

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 12px 0 4px;
  }

  .empty-sub {
    margin: 0 0 16px;
    font-size: 0.875rem;
  }

  .create-link {
    color: var(--color-accent);
    font-weight: 500;
    font-size: 0.875rem;
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

  .card-footer {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .open-link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-accent);
  }
</style>

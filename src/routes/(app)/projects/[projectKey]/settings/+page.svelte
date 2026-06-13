<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { updateProject } from '$lib/api/projects';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';

  let { data } = $props();

  let busy = $state(false);
  let error = $state('');
  let saved = $state(false);
  let initialized = false;
  let name = $state('');
  let description = $state('');
  let squadId = $state('');
  let active = $state(true);

  $effect(() => {
    if (initialized || !data.project) return;
    name = data.project.name;
    description = data.project.description ?? '';
    squadId = data.project.squadId ?? '';
    active = data.project.active ?? true;
    initialized = true;
  });

  async function saveProject(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = true;
    error = '';
    saved = false;
    try {
      await updateProject(data.projectKey, {
        name: name.trim(),
        description: description.trim() || null,
        squadId: squadId || null,
        active
      });
      saved = true;
      await invalidateAll();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Settings — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Settings</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Project Settings</h1>
      <p class="page-sub">Manage project metadata, ownership, and automation access.</p>
    </div>
    <a class="api-key-link" href="/projects/{data.projectKey}/settings/api-keys">API Keys</a>
  </div>

  {#if data.error}
    <AppAlert tone="error" title="Could not load project">{data.error}</AppAlert>
  {/if}
  {#if error}<AppAlert tone="error">{error}</AppAlert>{/if}
  {#if saved}<div class="success-banner">Project settings saved.</div>{/if}

  {#if data.project}
    <form class="settings-panel" onsubmit={saveProject}>
      <section>
        <h2>Metadata</h2>
        <div class="field-grid">
          <label>
            <span>Project title</span>
            <input bind:value={name} disabled={busy} required />
          </label>
          <label>
            <span>Squad</span>
            <select bind:value={squadId} disabled={busy}>
              <option value="">No squad</option>
              {#each data.squads as squad}
                <option value={squad.id}>{squad.name}</option>
              {/each}
            </select>
          </label>
        </div>
        <label>
          <span>Description</span>
          <textarea bind:value={description} rows="5" disabled={busy} placeholder="What this project owns, tests, and releases"></textarea>
        </label>
      </section>

      <section>
        <h2>Lifecycle</h2>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={active} disabled={busy} />
          <span>
            <strong>{active ? 'Active project' : 'Inactive project'}</strong>
            <small>{active ? 'Visible in dashboards and selectable lists.' : 'Hidden from active project lists after save.'}</small>
          </span>
        </label>
      </section>

      <div class="form-actions">
        <button class="primary-btn" type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .page { max-width: 920px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
  .page-sub { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }
  .api-key-link, button { border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 12px; text-decoration: none; font: inherit; cursor: pointer; }
  .api-key-link:hover, button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  .primary-btn { background: var(--color-accent); color: white; border-color: var(--color-accent); }
  .primary-btn:hover:not(:disabled) { color: white; }
  button:disabled, input:disabled, textarea:disabled, select:disabled { opacity: 0.6; cursor: not-allowed; }
  .settings-panel { display: grid; gap: 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
  section { display: grid; gap: 14px; }
  h2 { font-size: 1rem; margin: 0; }
  .field-grid { display: grid; grid-template-columns: 1fr 280px; gap: 14px; }
  label { display: grid; gap: 6px; color: var(--color-text-muted); font-size: 0.78rem; }
  input, textarea, select { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); padding: 10px; font: inherit; }
  textarea { resize: vertical; }
  .toggle-row { display: flex; align-items: flex-start; gap: 12px; border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; background: color-mix(in srgb, var(--color-accent), transparent 95%); }
  .toggle-row input { width: 18px; height: 18px; margin-top: 2px; }
  .toggle-row span { display: grid; gap: 3px; color: var(--color-text); }
  .toggle-row small { color: var(--color-text-muted); }
  .form-actions { display: flex; justify-content: flex-end; }
  :global(.page > .app-alert), .success-banner { margin-bottom: 16px; }
  .success-banner { border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; }
  .success-banner { background: color-mix(in srgb, var(--color-success), transparent 88%); color: var(--color-success); border: 1px solid color-mix(in srgb, var(--color-success), transparent 70%); }
  @media (max-width: 720px) {
    .field-grid { grid-template-columns: 1fr; }
  }
</style>

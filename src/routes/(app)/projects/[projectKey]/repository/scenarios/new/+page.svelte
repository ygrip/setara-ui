<script lang="ts">
  import { goto } from '$app/navigation';
  import { createScenario, type TestDirectory } from '$lib/api/testcases';
  import Modal from '$lib/components/Modal.svelte';
  import SetaraStepGridEditor from '$lib/components/scenario/SetaraStepGridEditor.svelte';
  import TagInput from '$lib/components/TagInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import type { BackendStep } from '$lib/components/scenario/step-grid.types';
  import type { TagInput as TagInputType } from '$lib/api/testcases';

  let { data } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let nodeId = $state('');
  let showDirectoryPicker = $state(false);
  let directoryFilter = $state('');
  let name = $state('');
  let priority = $state('MEDIUM');
  let automationStatus = $state('AUTOMATABLE');
  let description = $state('');
  let tags = $state<{ sanitized?: string; display: string }[]>([]);
  let detailSteps = $state<BackendStep[]>([
    { sequenceNo: 1, keyword: 'GIVEN', name: '', description: null, expectation: null },
    { sequenceNo: 2, keyword: 'WHEN', name: '', description: null, expectation: null },
    { sequenceNo: 3, keyword: 'THEN', name: '', description: null, expectation: null }
  ]);

  const selectedNode = $derived(data.directories.find((node: TestDirectory) => node.id === nodeId) ?? null);
  const breadcrumbNodes = $derived(buildBreadcrumb(selectedNode));
  const filteredDirectories = $derived(data.directories.filter((node: TestDirectory) =>
    `${node.name} ${node.path}`.toLowerCase().includes(directoryFilter.trim().toLowerCase())
  ));

  $effect(() => {
    if (!nodeId) nodeId = data.nodeId ?? data.directories[0]?.id ?? '';
  });

  function buildBreadcrumb(node: TestDirectory | null): TestDirectory[] {
    if (!node) return [];
    const byId = new Map(data.directories.map((item: TestDirectory) => [item.id, item]));
    const result: TestDirectory[] = [];
    let current: TestDirectory | undefined = node;
    while (current) {
      result.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return result;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!nodeId || !name.trim()) return;
    const filledSteps = detailSteps.filter((s) => s.name?.trim());
    busy = true;
    actionError = '';
    try {
      await createScenario(data.projectKey, {
        nodeId,
        name: name.trim(),
        priority,
        automatable: automationStatus !== 'MANUAL_ONLY',
        notes: description.trim() || undefined,
        tags: tags.length > 0 ? tags.map(t => ({ display: t.display, sanitized: t.sanitized ?? '' })) : undefined,
        steps: filledSteps.map((s, i) => ({
          sequenceNo: i + 1,
          keyword: s.keyword,
          name: s.name.trim(),
          description: s.description ?? null,
          expectation: s.expectation ?? null
        }))
      });
      await goto(`/projects/${data.projectKey}/repository`);
    } catch (err) {
      actionError = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Create Scenario — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/repository">Test Repository</a>
    <span class="sep">›</span>
    <span>Create Scenario</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Create Scenario</h1>
      <p class="page-subtitle">Draft a scenario in the selected repository directory.</p>
    </div>
  </div>

  {#if data.error}<div class="error-banner">Could not load directories — {data.error}</div>{/if}
  {#if actionError}<div class="error-banner">{actionError}</div>{/if}

  <form class="scenario-form" onsubmit={handleSubmit}>
    <section class="section">
      <div class="path-row">
        <span>Path</span>
        <div class="path">
          {#each breadcrumbNodes as node, index}
            {#if index > 0}<span class="sep">›</span>{/if}
            <strong>{node.name}</strong>
          {:else}
            <strong>Select a directory</strong>
          {/each}
        </div>
      </div>

      <div class="form-grid">
        <div class="field wide">
          <span>Directory</span>
          <button type="button" class="directory-select" onclick={() => showDirectoryPicker = true} disabled={busy}>
            <strong>{selectedNode?.name ?? 'Select directory'}</strong>
            <span>{selectedNode?.path ?? 'Choose where this scenario belongs'}</span>
          </button>
        </div>
        <label class="wide">
          <span>Scenario Name</span>
          <input bind:value={name} placeholder="User can complete payment using saved card" required disabled={busy} />
        </label>
        <label>
          <span>Priority</span>
          <select bind:value={priority} disabled={busy}>
            <option>CRITICAL</option>
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>
        </label>
        <label>
          <span>Automation</span>
          <select bind:value={automationStatus} disabled={busy}>
            <option value="MANUAL_ONLY">Manual Only</option>
            <option value="AUTOMATABLE">Automatable</option>
            <option value="AUTOMATED">Automated</option>
          </select>
        </label>
        <label class="wide">
          <span>Description</span>
          <textarea bind:value={description} placeholder="Optional review notes or scenario context" disabled={busy}></textarea>
        </label>
        <div class="wide tag-field">
          <span class="field-label">Tags <span class="opt">(optional, max 20)</span></span>
          <TagInput
            tags={tags.map(t => ({ id: '', sanitized: t.sanitized ?? '', display: t.display }))}
            suggestions={[]}
            disabled={busy}
            onchange={(updated: TagInputType[]) => { tags = updated; }}
          />
        </div>
      </div>
    </section>

    <section class="section steps-section">
      <h2 class="section-title">Steps</h2>
      <SetaraStepGridEditor
        steps={detailSteps}
        readonly={busy}
        onchange={(updated) => { detailSteps = updated; }}
      />
    </section>

    <div class="form-actions">
      <Button variant="secondary" type="button" onclick={() => goto(`/projects/${data.projectKey}/repository`)} disabled={busy}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={busy || !nodeId || !name.trim()}>
        {busy ? 'Creating…' : 'Create Draft Scenario'}
      </Button>
    </div>
  </form>
</div>

<Modal open={showDirectoryPicker} title="Select Directory" size="lg" onclose={() => showDirectoryPicker = false}>
  <div class="directory-modal">
    <input bind:value={directoryFilter} placeholder="Search directories..." />
    <div class="directory-results">
      {#if filteredDirectories.length === 0}
        <p class="empty-picker">No matching directories.</p>
      {:else}
        {#each filteredDirectories as node}
          <button
            type="button"
            class:directory-option--active={node.id === nodeId}
            class="directory-option"
            onclick={() => { nodeId = node.id; showDirectoryPicker = false; }}
          >
            <strong>{node.name}</strong>
            <span>{node.path}</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</Modal>

<style>
  .page { max-width: min(1520px, 100%); }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 18px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .scenario-form { display: grid; gap: 18px; }
  .section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .path-row { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; color: var(--color-text-muted); }
  .path { display: flex; align-items: center; gap: 8px; color: var(--color-text); flex-wrap: wrap; }
  .form-grid { display: grid; grid-template-columns: 220px 1fr; gap: 14px; }
  .wide { grid-column: 1 / -1; }
  label, .field { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .tag-field { display: grid; gap: 5px; }
  .field-label { font-size: 0.78rem; color: var(--color-text-muted); }
  .opt { font-size: 0.72em; font-weight: 400; }
  button, input, select, textarea { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  input, select, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  textarea { min-height: 64px; resize: vertical; }
  .directory-select {
    display: grid;
    gap: 3px;
    text-align: left;
    padding: 10px 12px;
    background: var(--color-bg);
  }
  .directory-select strong { color: var(--color-text); }
  .directory-select span { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .directory-modal { display: grid; gap: 12px; }
  .directory-modal input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); padding: 9px 11px; }
  .directory-results { display: grid; gap: 6px; max-height: min(58vh, 520px); overflow: auto; }
  .directory-option { display: grid; gap: 3px; text-align: left; padding: 11px 12px; }
  .directory-option--active { border-color: var(--color-accent); background: var(--color-accent-subtle); }
  .directory-option span { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-picker { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center; }
  .steps-section { padding-bottom: 8px; }
  .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 12px; }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 720px) {
    .form-grid { grid-template-columns: 1fr; }
    .page-title { font-size: 1.2rem; }
    .path-row { flex-direction: column; align-items: flex-start; gap: 6px; }
    .form-actions { flex-wrap: wrap; }
    .form-actions :global(button), .form-actions :global(a) { flex: 1; min-width: 120px; justify-content: center; }
  }
  @media (max-width: 480px) {
    .section { padding: 12px; }
    .page-title { font-size: 1.1rem; }
    .page-subtitle { font-size: 0.8rem; }
    .form-actions :global(button), .form-actions :global(a) { width: 100%; flex: none; }
    .path-row { font-size: 0.8rem; }
  }
</style>

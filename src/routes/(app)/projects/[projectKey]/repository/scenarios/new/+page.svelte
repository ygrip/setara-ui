<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
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
    { sequenceNo: 2, keyword: 'WHEN',  name: '', description: null, expectation: null },
    { sequenceNo: 3, keyword: 'THEN',  name: '', description: null, expectation: null }
  ]);

  /** true when viewport ≤ 720px — set on mount + on resize */
  let isMobile = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    isMobile = mq.matches;
    const handler = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const KEYWORDS = ['GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'];
  const KW_COLORS: Record<string, string> = {
    GIVEN: '#8b5cf6', WHEN: '#d97706', THEN: '#0d9488', AND: '#64748b', BUT: '#64748b'
  };

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

  function addStep() {
    const seq = detailSteps.length + 1;
    const lastKw = detailSteps[detailSteps.length - 1]?.keyword ?? 'THEN';
    // suggest sensible next keyword
    const nextKw = lastKw === 'GIVEN' ? 'WHEN' : lastKw === 'WHEN' ? 'THEN' : 'AND';
    detailSteps = [...detailSteps, { sequenceNo: seq, keyword: nextKw, name: '', description: null, expectation: null }];
  }

  function removeStep(index: number) {
    if (detailSteps.length <= 1) return;
    detailSteps = detailSteps.filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, sequenceNo: i + 1 }));
  }

  function moveStep(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= detailSteps.length) return;
    const arr = [...detailSteps];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    detailSteps = arr.map((s, i) => ({ ...s, sequenceNo: i + 1 }));
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
    <h1 class="page-title">Create Scenario</h1>
    <p class="page-subtitle">Draft a new scenario in the selected repository directory.</p>
  </div>

  {#if data.error}<div class="error-banner">Could not load directories — {data.error}</div>{/if}
  {#if actionError}<div class="error-banner">{actionError}</div>{/if}

  <form class="scenario-form" onsubmit={handleSubmit}>

    <!-- ── Details section ─────────────────────────────────────── -->
    <section class="section">
      <!-- Breadcrumb path indicator -->
      <div class="path-row">
        <span class="path-label">Path</span>
        <div class="path">
          {#each breadcrumbNodes as node, index}
            {#if index > 0}<span class="sep">›</span>{/if}
            <strong>{node.name}</strong>
          {:else}
            <em class="path-empty">Select a directory below</em>
          {/each}
        </div>
      </div>

      <div class="form-grid">
        <!-- Directory picker button -->
        <div class="field wide">
          <span class="field-label">Directory <span class="req">*</span></span>
          <button type="button" class="directory-select" onclick={() => showDirectoryPicker = true} disabled={busy}>
            <span class="dir-name">{selectedNode?.name ?? 'Select directory'}</span>
            <span class="dir-path">{selectedNode?.path ?? 'Choose where this scenario belongs'}</span>
          </button>
        </div>

        <!-- Scenario name -->
        <label class="wide">
          <span class="field-label">Scenario Name <span class="req">*</span></span>
          <input bind:value={name} placeholder="User can complete payment using saved card" required disabled={busy} />
        </label>

        <!-- Priority + Automation type -->
        <label>
          <span class="field-label">Priority</span>
          <select bind:value={priority} disabled={busy}>
            <option>CRITICAL</option>
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>
        </label>
        <label>
          <span class="field-label">Automation Type</span>
          <select bind:value={automationStatus} disabled={busy}>
            <option value="MANUAL_ONLY">Manual Only</option>
            <option value="AUTOMATABLE">Automatable</option>
            <option value="AUTOMATED">Automated</option>
          </select>
        </label>

        <!-- Description -->
        <label class="wide">
          <span class="field-label">Description <span class="opt">(optional)</span></span>
          <textarea bind:value={description} placeholder="Notes, acceptance criteria, or context about this scenario" disabled={busy} rows="3"></textarea>
        </label>

        <!-- Tags -->
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

    <!-- ── Steps section ────────────────────────────────────────── -->
    <section class="section steps-section">
      <h2 class="section-title">Steps</h2>

      {#if isMobile}
        <!-- ── Mobile: card-based step editor ─────────────────── -->
        <div class="mobile-steps">
          {#each detailSteps as step, i (i)}
            <div class="step-card">
              <div class="step-card-header">
                <span class="step-num">{i + 1}</span>
                <select
                  class="kw-select"
                  bind:value={detailSteps[i].keyword}
                  style="color: {KW_COLORS[step.keyword] ?? '#64748b'}"
                  disabled={busy}
                >
                  {#each KEYWORDS as kw}
                    <option value={kw}>{kw}</option>
                  {/each}
                </select>
                <div class="step-card-actions">
                  {#if i > 0}
                    <button type="button" class="icon-act" title="Move up" aria-label="Move up"
                      onclick={() => moveStep(i, -1)} disabled={busy}>↑</button>
                  {/if}
                  {#if i < detailSteps.length - 1}
                    <button type="button" class="icon-act" title="Move down" aria-label="Move down"
                      onclick={() => moveStep(i, 1)} disabled={busy}>↓</button>
                  {/if}
                  {#if detailSteps.length > 1}
                    <button type="button" class="icon-act danger" title="Remove step" aria-label="Remove step"
                      onclick={() => removeStep(i)} disabled={busy}>✕</button>
                  {/if}
                </div>
              </div>
              <input
                class="step-text-input"
                bind:value={detailSteps[i].name}
                placeholder="Step text…"
                disabled={busy}
              />
              <textarea
                class="step-notes-input"
                bind:value={detailSteps[i].description}
                placeholder="Description (optional)"
                rows="2"
                disabled={busy}
              ></textarea>
              <input
                class="step-expect-input"
                bind:value={detailSteps[i].expectation}
                placeholder="Expected result (optional)"
                disabled={busy}
              />
            </div>
          {/each}

          <button type="button" class="add-step-btn" onclick={addStep} disabled={busy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Step
          </button>
        </div>
      {:else}
        <!-- ── Desktop: full RevoGrid editor ───────────────────── -->
        <SetaraStepGridEditor
          steps={detailSteps}
          readonly={busy}
          onchange={(updated) => { detailSteps = updated; }}
        />
      {/if}
    </section>

    <!-- ── Form actions ─────────────────────────────────────────── -->
    <div class="form-actions">
      <Button variant="secondary" type="button" onclick={() => goto(`/projects/${data.projectKey}/repository`)} disabled={busy}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={busy || !nodeId || !name.trim()}>
        {busy ? 'Creating…' : 'Create Draft Scenario'}
      </Button>
    </div>
  </form>
</div>

<!-- Directory picker modal -->
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
            class="directory-option"
            class:directory-option--active={node.id === nodeId}
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
  /* ── Page shell ──────────────────────────────────────────────── */
  .page {
    max-width: min(1200px, 100%);
    padding-bottom: 40px;
  }
  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--color-text-muted);
    margin-bottom: 20px; flex-wrap: wrap;
  }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .breadcrumb a:hover { text-decoration: underline; }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 20px; }
  .page-title { font-size: clamp(1.2rem, 4vw, 1.5rem); font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .error-banner {
    background: color-mix(in srgb, var(--color-danger), transparent 90%);
    color: var(--color-danger);
    border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%);
    border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px;
  }

  /* ── Form layout ─────────────────────────────────────────────── */
  .scenario-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    /* flex instead of grid — eliminates the min-width: auto overflow problem */
  }

  .section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    /* Prevent content from widening the section beyond the viewport */
    min-width: 0;
    overflow: hidden;
  }
  .steps-section {
    /* Override overflow so the RevoGrid on desktop can draw its scroll bars */
    overflow: visible;
    padding-bottom: 12px;
  }

  /* ── Path row ─────────────────────────────────────────────────── */
  .path-row {
    display: flex; align-items: flex-start; gap: 12px;
    padding-bottom: 14px; margin-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.85rem; color: var(--color-text-muted);
    flex-wrap: wrap;
  }
  .path-label { font-weight: 600; flex-shrink: 0; padding-top: 2px; }
  .path { display: flex; align-items: center; gap: 6px; color: var(--color-text); flex-wrap: wrap; }
  .path-empty { color: var(--color-text-muted); font-style: italic; }

  /* ── Form grid ────────────────────────────────────────────────── */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .wide { grid-column: 1 / -1; }

  /* ── Field atoms ─────────────────────────────────────────────── */
  .field-label {
    display: block;
    font-size: 0.78rem; font-weight: 600;
    color: var(--color-text-muted); margin-bottom: 5px;
  }
  .opt { font-weight: 400; opacity: 0.75; }
  .req { color: var(--color-danger); }
  .tag-field { display: flex; flex-direction: column; gap: 5px; }
  label, .field { display: flex; flex-direction: column; gap: 5px; }

  /* ── Native form controls ─────────────────────────────────────── */
  button, input, select, textarea { font: inherit; }
  input, select, textarea {
    width: 100%; border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-bg);
    color: var(--color-text); padding: 9px 11px; min-width: 0;
    box-sizing: border-box;
    transition: border-color 0.12s;
  }
  input:focus, select:focus, textarea:focus {
    outline: none; border-color: var(--color-accent);
  }
  textarea { min-height: 80px; resize: vertical; }
  button {
    border: 1px solid var(--color-border); background: var(--color-surface);
    color: var(--color-text); border-radius: 6px; padding: 7px 12px; cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:active:not(:disabled) { background: var(--color-accent-subtle); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }

  /* Directory picker button */
  .directory-select {
    display: flex; flex-direction: column; gap: 3px;
    text-align: left; padding: 11px 13px;
    background: var(--color-bg); width: 100%; min-height: 52px;
    touch-action: manipulation;
  }
  .dir-name { font-weight: 600; color: var(--color-text); font-size: 0.9rem; }
  .dir-path { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Steps section ────────────────────────────────────────────── */
  .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 14px; }

  /* ── Mobile step cards ────────────────────────────────────────── */
  .mobile-steps {
    display: flex; flex-direction: column; gap: 12px;
  }
  .step-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    background: var(--color-bg);
    display: flex; flex-direction: column; gap: 8px;
  }
  .step-card-header {
    display: flex; align-items: center; gap: 8px;
  }
  .step-num {
    display: inline-grid; place-items: center;
    width: 26px; height: 26px; flex-shrink: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-accent), transparent 84%);
    color: var(--color-accent);
    font-size: 0.75rem; font-weight: 800;
  }
  .kw-select {
    flex: 1; min-width: 0;
    font-size: 0.8rem; font-weight: 700;
    padding: 7px 9px;
    letter-spacing: 0.03em;
    width: auto;
  }
  .step-card-actions {
    display: flex; gap: 4px; flex-shrink: 0;
  }
  .icon-act {
    display: inline-grid; place-items: center;
    width: 32px; height: 32px; padding: 0;
    font-size: 0.85rem;
    border-radius: 5px; border: 1px solid var(--color-border);
    background: var(--color-surface); color: var(--color-text-muted);
    cursor: pointer; touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .icon-act:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  .icon-act:active:not(:disabled) { background: var(--color-accent-subtle); }
  .icon-act.danger:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); background: color-mix(in srgb, var(--color-danger), transparent 90%); }
  .step-text-input {
    font-size: 0.9rem; font-weight: 500;
    background: var(--color-surface);
  }
  .step-notes-input {
    font-size: 0.82rem; min-height: 56px;
    color: var(--color-text-muted);
  }
  .step-expect-input {
    font-size: 0.82rem;
    color: var(--color-text-muted);
  }
  .add-step-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 12px;
    font-size: 0.85rem; font-weight: 600;
    border: 2px dashed var(--color-border);
    border-radius: 8px; color: var(--color-text-muted);
    background: transparent;
    touch-action: manipulation;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  .add-step-btn:hover:not(:disabled) {
    border-color: var(--color-accent); color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 94%);
  }

  /* ── Form actions ─────────────────────────────────────────────── */
  .form-actions {
    display: flex; justify-content: flex-end; gap: 10px;
    flex-wrap: wrap;
  }
  .form-actions :global(.btn) { min-width: 120px; }

  /* ── Directory picker modal ───────────────────────────────────── */
  .directory-modal { display: flex; flex-direction: column; gap: 12px; }
  .directory-modal input {
    border: 1px solid var(--color-border); border-radius: 6px;
    background: var(--color-bg); color: var(--color-text);
    padding: 9px 11px; width: 100%; box-sizing: border-box;
  }
  .directory-results {
    display: flex; flex-direction: column; gap: 4px;
    max-height: min(58vh, 520px); overflow-y: auto;
  }
  .directory-option {
    display: flex; flex-direction: column; gap: 3px;
    text-align: left; padding: 11px 12px;
    border: 1px solid transparent; border-radius: 6px;
    background: transparent; cursor: pointer; width: 100%;
    transition: background 0.1s, border-color 0.1s;
    touch-action: manipulation;
  }
  .directory-option:hover { background: var(--color-accent-subtle); border-color: color-mix(in srgb, var(--color-accent), transparent 70%); }
  .directory-option--active { border-color: var(--color-accent); background: var(--color-accent-subtle); }
  .directory-option strong { font-size: 0.875rem; color: var(--color-text); }
  .directory-option span { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-picker { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center; }

  /* ── Responsive ───────────────────────────────────────────────── */
  @media (max-width: 720px) {
    .section { padding: 14px; }
    .form-grid { grid-template-columns: 1fr; }
    .form-actions { flex-direction: column; }
    .form-actions :global(.btn) { width: 100%; justify-content: center; }
    .path-row { flex-direction: column; gap: 4px; }
  }
  @media (max-width: 480px) {
    .section { padding: 12px; }
    .page-title { font-size: 1.1rem; }
    .page-subtitle { font-size: 0.82rem; }
  }
</style>

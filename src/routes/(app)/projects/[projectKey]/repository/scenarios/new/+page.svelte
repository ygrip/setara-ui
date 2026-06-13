<script lang="ts">
  import { goto } from '$app/navigation';
  import { createScenario, suggestScenarioSteps, type TestDirectory } from '$lib/api/testcases';
  import AiThinkingPanel from '$lib/components/AiThinkingPanel.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import SetaraStepGridEditor from '$lib/components/scenario/SetaraStepGridEditor.svelte';
  import TagInput from '$lib/components/TagInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import type { BackendStep } from '$lib/components/scenario/step-grid.types';
  import type { TagInput as TagInputType } from '$lib/api/testcases';

  let { data } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let nodeId = $state('');
  let showDirectoryPicker = $state(false);
  let suggesting = $state(false);
  let suggestError = $state('');
  let suggestInfo = $state('');
  let suggestDraftHint = $state(false);
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

  async function handleSuggestSteps() {
    if (!name.trim() || suggesting) return;
    suggesting = true;
    suggestError = '';
    suggestInfo = '';
    suggestDraftHint = false;
    try {
      const directoryPath = breadcrumbNodes.map(n => n.name);
      const result = await suggestScenarioSteps(data.projectKey, {
        scenarioName: name.trim(),
        directoryNodeId: nodeId || undefined,
        directoryPath: directoryPath.length > 0 ? directoryPath : undefined,
        tags: tags.length > 0 ? tags.map(t => ({ sanitized: t.sanitized ?? '', display: t.display })) : undefined,
        existingSteps: detailSteps.filter(s => s.name?.trim())
          .map(s => ({ keyword: s.keyword, name: s.name.trim() })),
        maxSteps: 8
      });
      if (result.suggestions.length > 0) {
        detailSteps = result.suggestions.map(s => ({
          sequenceNo: s.sequenceNo,
          keyword: s.keyword,
          name: s.name,
          description: null,
          expectation: null
        }));
        suggestDraftHint = true;
      } else {
        const msg = result.message ?? 'No steps were generated. Try a more specific scenario name.';
        const isDisabled = msg.toLowerCase().includes('not enabled') || msg.toLowerCase().includes('not available');
        if (isDisabled) {
          suggestInfo = msg;
        } else {
          suggestError = msg;
        }
      }
    } catch (err) {
      suggestError = 'Could not reach AI provider. Your draft steps are unchanged — try again or add steps manually.';
    } finally {
      suggesting = false;
    }
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

  {#if data.error}<AppAlert tone="error" title="Could not load directories">{data.error}</AppAlert>{/if}
  {#if actionError}<AppAlert tone="error">{actionError}</AppAlert>{/if}

  <form class="scenario-form" onsubmit={handleSubmit}>

    <!-- ── Details ──────────────────────────────────────────────── -->
    <section class="section">
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
        <div class="field wide">
          <span class="field-label">Directory <span class="req">*</span></span>
          <button type="button" class="directory-select" onclick={() => showDirectoryPicker = true} disabled={busy}>
            <span class="dir-name">{selectedNode?.name ?? 'Select directory'}</span>
            <span class="dir-path">{selectedNode?.path ?? 'Choose where this scenario belongs'}</span>
          </button>
        </div>

        <label class="wide">
          <span class="field-label">Scenario Name <span class="req">*</span></span>
          <input bind:value={name} placeholder="User can complete payment using saved card" required disabled={busy} />
        </label>

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

        <label class="wide">
          <span class="field-label">Description <span class="opt">(optional)</span></span>
          <textarea bind:value={description} placeholder="Notes, acceptance criteria, or context" disabled={busy} rows="3"></textarea>
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

    <!-- ── Steps ─────────────────────────────────────────────────── -->
    <section class="section steps-section">
      <div class="steps-header">
        <div>
          <h2 class="section-title">Steps</h2>
          <p class="steps-hint">Scroll left–right inside the table to see all columns.</p>
        </div>
        <div class="suggest-wrap">
          <button
            type="button"
            class="suggest-btn"
            onclick={handleSuggestSteps}
            disabled={!name.trim() || busy || suggesting}
            aria-label={!name.trim() ? 'Enter a scenario name first to enable AI suggestions' : 'Suggest steps using AI'}
            title={!name.trim() ? 'Enter a scenario name first' : 'Generate BDD draft steps from your scenario name and context'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>
            {suggesting ? 'Thinking…' : 'Suggest steps'}
          </button>
          <span class="suggest-caption">AI drafts · always editable</span>
        </div>
      </div>

      {#if suggestDraftHint}
        <div class="suggest-draft-hint" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          AI-generated drafts — review and edit each step before saving. These are never auto-saved.
          <button type="button" class="hint-dismiss" onclick={() => suggestDraftHint = false} aria-label="Dismiss">✕</button>
        </div>
      {/if}
      {#if suggestInfo}
        <div class="suggest-info" role="status">{suggestInfo}</div>
      {/if}
      {#if suggestError}
        <div class="suggest-error" role="alert">{suggestError}</div>
      {/if}

      {#if suggesting}
        <AiThinkingPanel
          title="Suggesting steps"
          subtitle="Analyzing scenario name and context to generate BDD steps."
          steps={['Reading scenario name', 'Analyzing project context', 'Generating BDD steps', 'Formatting suggestions']}
        />
      {:else}
        <SetaraStepGridEditor
          steps={detailSteps}
          readonly={busy}
          onchange={(updated) => { detailSteps = updated; }}
        />
      {/if}
    </section>

    <!-- ── Actions ───────────────────────────────────────────────── -->
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
  /* ── Page ───────────────────────────────────────────────────────── */
  .page { max-width: min(1200px, 100%); padding-bottom: 40px; }

  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--color-text-muted);
    margin-bottom: 20px; flex-wrap: wrap;
  }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .breadcrumb a:hover { text-decoration: underline; }
  .sep { opacity: 0.5; }

  .page-header { margin-bottom: 20px; }
  .page-title { font-size: clamp(1.15rem, 4vw, 1.5rem); font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  :global(.page > .app-alert) { margin-bottom: 16px; }

  /* ── Form ───────────────────────────────────────────────────────── */
  /*
   * Use flex (column) rather than grid so items don't inherit min-width: auto
   * from the grid algorithm — that was what let the RevoGrid (992px wide)
   * force the whole form to be 992px wide on mobile.
   */
  .scenario-form { display: flex; flex-direction: column; gap: 18px; }

  .section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    /* Prevent intrinsically-wide children from widening this section */
    min-width: 0;
    overflow: hidden;
  }

  /*
   * Steps section: keep overflow:visible so the RevoGrid web component
   * can render its internal scroll chrome at full height/width.
   * min-width:0 still prevents the section from expanding the page.
   */
  .steps-section { overflow: visible; padding-bottom: 12px; }

  /* ── Path row ────────────────────────────────────────────────────── */
  .path-row {
    display: flex; align-items: flex-start; gap: 10px;
    padding-bottom: 14px; margin-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.85rem; color: var(--color-text-muted); flex-wrap: wrap;
  }
  .path-label { font-weight: 600; flex-shrink: 0; padding-top: 2px; }
  .path { display: flex; align-items: center; gap: 6px; color: var(--color-text); flex-wrap: wrap; }
  .path-empty { color: var(--color-text-muted); font-style: italic; }

  /* ── Form grid ───────────────────────────────────────────────────── */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .wide { grid-column: 1 / -1; }

  .field-label {
    display: block; font-size: 0.78rem; font-weight: 600;
    color: var(--color-text-muted); margin-bottom: 5px;
  }
  .opt { font-weight: 400; opacity: 0.75; }
  .req { color: var(--color-danger); }
  .tag-field { display: flex; flex-direction: column; gap: 5px; }
  label, .field { display: flex; flex-direction: column; gap: 5px; }

  /* ── Controls ────────────────────────────────────────────────────── */
  button, input, select, textarea { font: inherit; }
  input, select, textarea {
    width: 100%; border: 1px solid var(--color-border);
    border-radius: 6px; background: var(--color-bg);
    color: var(--color-text); padding: 9px 11px; min-width: 0;
    box-sizing: border-box; transition: border-color 0.12s;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--color-accent); }
  textarea { min-height: 80px; resize: vertical; }
  button {
    border: 1px solid var(--color-border); background: var(--color-surface);
    color: var(--color-text); border-radius: 6px; padding: 7px 12px; cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:active:not(:disabled) { background: var(--color-accent-subtle); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }

  .directory-select {
    display: flex; flex-direction: column; gap: 3px;
    text-align: left; padding: 11px 13px; width: 100%; min-height: 52px;
    background: var(--color-bg); touch-action: manipulation;
  }
  .dir-name { font-weight: 600; color: var(--color-text); font-size: 0.9rem; }
  .dir-path { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Steps section ───────────────────────────────────────────────── */
  .steps-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 4px; }
  .steps-hint {
    font-size: 0.75rem; color: var(--color-text-muted);
    margin: 0;
    display: none;
  }
  @media (max-width: 720px) {
    .steps-hint { display: block; }
  }

  .suggest-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 7px 12px;
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 50%);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
    color: var(--color-accent);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s;
  }
  .suggest-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-accent), transparent 80%);
    border-color: var(--color-accent);
  }
  .suggest-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .suggest-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .suggest-caption {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    opacity: 0.75;
  }

  .suggest-draft-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: color-mix(in srgb, var(--color-accent), #333 30%);
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 65%);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 10px;
  }

  .hint-dismiss {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0 2px;
    line-height: 1;
    opacity: 0.6;
  }
  .hint-dismiss:hover { opacity: 1; }

  .suggest-info {
    font-size: 0.825rem;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-text-muted, #666), transparent 92%);
    border: 1px solid color-mix(in srgb, var(--color-text-muted, #666), transparent 75%);
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 12px;
  }

  .suggest-error {
    font-size: 0.825rem;
    color: var(--color-warning, #f59e0b);
    background: color-mix(in srgb, #f59e0b, transparent 90%);
    border: 1px solid color-mix(in srgb, #f59e0b, transparent 70%);
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 12px;
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  .form-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
  .form-actions :global(.btn) { min-width: 120px; }

  /* ── Directory modal ─────────────────────────────────────────────── */
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
    text-align: left; padding: 11px 12px; border: 1px solid transparent;
    border-radius: 6px; background: transparent; cursor: pointer; width: 100%;
    transition: background 0.1s, border-color 0.1s; touch-action: manipulation;
  }
  .directory-option:hover { background: var(--color-accent-subtle); border-color: color-mix(in srgb, var(--color-accent), transparent 70%); }
  .directory-option--active { border-color: var(--color-accent); background: var(--color-accent-subtle); }
  .directory-option strong { font-size: 0.875rem; color: var(--color-text); }
  .directory-option span { color: var(--color-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-picker { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center; }

  /* ── Responsive ──────────────────────────────────────────────────── */
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

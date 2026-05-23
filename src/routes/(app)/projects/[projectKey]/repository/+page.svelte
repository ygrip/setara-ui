<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import {
    approveDraftScenarios,
    archiveScenario,
    createManualExecution,
    createNode,
    createScenario,
    deleteNode,
    rejectDraftScenarios,
    renameNode,
    updateScenario,
    type Scenario,
    type ScenarioStep,
    type TestNode
  } from '$lib/api/testcases';

  let { data } = $props();

  type ScenarioDraftRow = {
    name: string;
    priority: string;
    automatable: boolean;
    notes: string;
    steps: Array<Omit<ScenarioStep, 'id'>>;
  };

  let selectedNodeId = $state<string | null>(null);
  let selectedScenarioId = $state<string | null>(null);
  let reviewMode = $state<'LIVE' | 'DRAFT'>('LIVE');
  let initializedSelection = $state(false);
  let busy = $state(false);
  let actionError = $state('');
  let selectedDraftIds = $state<string[]>([]);

  let nodeName = $state('');
  let nodeType = $state<'DIRECTORY' | 'FEATURE'>('DIRECTORY');
  let renameValue = $state('');

  let draftRows = $state<ScenarioDraftRow[]>([
    {
      name: '',
      priority: 'MEDIUM',
      automatable: true,
      notes: '',
      steps: [
        { sequenceNo: 1, keyword: 'GIVEN', name: '', description: '', expectation: '' },
        { sequenceNo: 2, keyword: 'WHEN', name: '', description: '', expectation: '' },
        { sequenceNo: 3, keyword: 'THEN', name: '', description: '', expectation: '' }
      ]
    }
  ]);

  let manualStatus = $state('PASSED');
  let manualExecutor = $state('');
  let manualEnvironment = $state('');
  let manualNotes = $state('');
  let editScenarioName = $state('');
  let editAutomationStatus = $state('MANUAL_ONLY');
  let editManualNotes = $state('');
  let editSteps = $state<Array<Omit<ScenarioStep, 'id'>>>([]);

  const scopedScenarios = $derived(reviewMode === 'LIVE' ? data.scenarios : data.draftScenarios);
  const selectedNode = $derived(data.nodes.find((node: TestNode) => node.id === selectedNodeId) ?? null);
  const visibleScenarios = $derived(
    selectedNodeId
      ? scopedScenarios.filter((scenario: Scenario) => scenario.nodeId === selectedNodeId)
      : scopedScenarios
  );
  const selectedScenario = $derived(
    scopedScenarios.find((scenario: Scenario) => scenario.id === selectedScenarioId) ?? visibleScenarios[0] ?? null
  );

  $effect(() => {
    if (!initializedSelection) {
      selectedNodeId = data.nodes[0]?.id ?? null;
      selectedScenarioId = data.scenarios[0]?.id ?? null;
      initializedSelection = true;
    }
  });

  $effect(() => {
    if (selectedNode) renameValue = selectedNode.name;
  });

  $effect(() => {
    if (selectedScenario) {
      editScenarioName = selectedScenario.name;
      editAutomationStatus = selectedScenario.automationStatus;
      editManualNotes = selectedScenario.manualNotes ?? '';
      editSteps = selectedScenario.steps?.length
        ? selectedScenario.steps.map((step: ScenarioStep, index: number) => ({
            sequenceNo: index + 1,
            keyword: step.keyword,
            name: step.name,
            description: step.description ?? '',
            expectation: step.expectation ?? ''
          }))
        : [{ sequenceNo: 1, keyword: 'GIVEN', name: '', description: '', expectation: '' }];
    }
  });

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED':
      case 'AUTOMATED':
      case 'ACTIVE':
        return 'success';
      case 'FAILED':
      case 'ARCHIVED':
        return 'danger';
      case 'AUTOMATABLE':
        return 'info';
      case 'DRAFT':
      case 'BLOCKED':
      case 'MANUAL_ONLY':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  function selectNode(nodeId: string | null) {
    selectedNodeId = nodeId;
    selectedScenarioId = null;
  }

  function setReviewMode(mode: 'LIVE' | 'DRAFT') {
    reviewMode = mode;
    selectedDraftIds = [];
    selectedScenarioId = (mode === 'LIVE' ? data.scenarios[0]?.id : data.draftScenarios[0]?.id) ?? null;
  }

  function toggleDraft(id: string) {
    selectedDraftIds = selectedDraftIds.includes(id)
      ? selectedDraftIds.filter(existing => existing !== id)
      : [...selectedDraftIds, id];
  }

  function addDraftRow() {
    draftRows = [
      ...draftRows,
      { name: '', priority: 'MEDIUM', automatable: true, notes: '', steps: [{ sequenceNo: 1, keyword: 'GIVEN', name: '', description: '', expectation: '' }] }
    ];
  }

  function addStep(rowIndex: number) {
    draftRows[rowIndex].steps = [
      ...draftRows[rowIndex].steps,
      { sequenceNo: draftRows[rowIndex].steps.length + 1, keyword: 'AND', name: '', description: '', expectation: '' }
    ];
  }

  function moveEditStep(index: number, direction: -1 | 1) {
    const next = [...editSteps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    editSteps = next.map((step, idx) => ({ ...step, sequenceNo: idx + 1 }));
  }

  function addEditStep() {
    editSteps = [...editSteps, { sequenceNo: editSteps.length + 1, keyword: 'AND', name: '', description: '', expectation: '' }];
  }

  async function runAction(work: () => Promise<void>) {
    busy = true;
    actionError = '';
    try {
      await work();
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function handleCreateNode(e: SubmitEvent) {
    e.preventDefault();
    if (!nodeName.trim()) return;
    await runAction(async () => {
      const node = await createNode(data.projectKey, { parentId: null, nodeType, name: nodeName.trim() });
      selectedNodeId = node.id;
      nodeName = '';
    });
  }

  async function handleRenameNode(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNodeId || !renameValue.trim()) return;
    await runAction(async () => renameNode(data.projectKey, selectedNodeId as string, renameValue.trim()).then());
  }

  async function handleDeleteNode() {
    if (!selectedNodeId) return;
    await runAction(async () => {
      await deleteNode(data.projectKey, selectedNodeId as string);
      selectedNodeId = null;
      selectedScenarioId = null;
    });
  }

  async function handleBulkCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNodeId) return;
    const rows = draftRows.filter(row => row.name.trim());
    if (rows.length === 0) return;
    await runAction(async () => {
      for (const row of rows) {
        await createScenario(data.projectKey, {
          nodeId: selectedNodeId as string,
          name: row.name.trim(),
          priority: row.priority,
          automatable: row.automatable,
          notes: row.notes.trim() || undefined,
          steps: row.steps
            .filter(step => step.name.trim())
            .map((step, index) => ({ ...step, sequenceNo: index + 1, name: step.name.trim() }))
        });
      }
      setReviewMode('DRAFT');
      selectedDraftIds = [];
    });
  }

  async function handleSaveScenario() {
    if (!selectedScenario) return;
    await runAction(async () => {
      await updateScenario(data.projectKey, selectedScenario.id, {
        name: editScenarioName.trim(),
        priority: selectedScenario.priority ?? undefined,
        automatable: selectedScenario.automatable,
        automationStatus: editAutomationStatus,
        manualNotes: editManualNotes.trim() || undefined,
        steps: editSteps
          .filter(step => step.name.trim())
          .map((step, index) => ({ ...step, sequenceNo: index + 1, name: step.name.trim() }))
      });
    });
  }

  async function handleArchiveScenario() {
    if (!selectedScenario) return;
    await runAction(async () => {
      await archiveScenario(data.projectKey, selectedScenario.id);
      selectedScenarioId = null;
    });
  }

  async function handleApproveDrafts() {
    if (selectedDraftIds.length === 0) return;
    await runAction(async () => {
      await approveDraftScenarios(data.projectKey, selectedDraftIds);
      selectedDraftIds = [];
      setReviewMode('LIVE');
    });
  }

  async function handleRejectDrafts() {
    if (selectedDraftIds.length === 0) return;
    await runAction(async () => {
      await rejectDraftScenarios(data.projectKey, selectedDraftIds);
      selectedDraftIds = [];
    });
  }

  async function handleManualExecution(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedScenario) return;
    await runAction(async () => {
      await createManualExecution(data.projectKey, selectedScenario.id, {
        status: manualStatus,
        executedBy: manualExecutor.trim() || undefined,
        environment: manualEnvironment.trim() || undefined,
        notes: manualNotes.trim() || undefined,
        startedAt: new Date().toISOString()
      });
      manualNotes = '';
    });
  }
</script>

<svelte:head>
  <title>Test Repository — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Test Repository</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Test Repository</h1>
      <p class="page-subtitle">Draft, review, approve, and execute scenarios with cucumber-style steps.</p>
    </div>
  </div>

  {#if data.error}<div class="error-banner">Could not load repository — {data.error}</div>{/if}
  {#if actionError}<div class="error-banner">{actionError}</div>{/if}

  <div class="repo-layout">
    <aside class="tree-panel">
      <div class="panel-header">
        <span class="panel-title">Tree</span>
        <button class:active={selectedNodeId === null} onclick={() => selectNode(null)}>All</button>
      </div>

      <form class="compact-form" onsubmit={handleCreateNode}>
        <input bind:value={nodeName} placeholder="New node name" disabled={busy} />
        <select bind:value={nodeType} disabled={busy}>
          <option value="DIRECTORY">Directory</option>
          <option value="FEATURE">Feature</option>
        </select>
        <button type="submit" disabled={busy || !nodeName.trim()}>Create</button>
      </form>

      <div class="tree-list">
        {#each data.nodes as node}
          <button class="tree-item" class:active={selectedNodeId === node.id} onclick={() => selectNode(node.id)}>
            <span class="node-icon">{node.nodeType === 'FEATURE' ? 'F' : 'D'}</span>
            <span>
              <strong>{node.name}</strong>
              <small>{node.directoryId ?? node.path}</small>
            </span>
          </button>
        {:else}
          <p class="muted">No nodes yet.</p>
        {/each}
      </div>

      {#if selectedNode}
        <form class="compact-form edit-node" onsubmit={handleRenameNode}>
          <input bind:value={renameValue} disabled={busy} />
          <button type="submit" disabled={busy || !renameValue.trim()}>Rename</button>
          <button type="button" class="danger" onclick={handleDeleteNode} disabled={busy}>Delete</button>
        </form>
      {/if}
    </aside>

    <section class="scenario-panel">
      <div class="panel-header">
        <div>
          <span class="panel-title">{selectedNode ? selectedNode.name : 'All Scenarios'}</span>
          <p class="panel-subtitle">{visibleScenarios.length} {reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios</p>
        </div>
        <div class="segmented">
          <button class:active={reviewMode === 'LIVE'} onclick={() => setReviewMode('LIVE')}>Live</button>
          <button class:active={reviewMode === 'DRAFT'} onclick={() => setReviewMode('DRAFT')}>Review Drafts</button>
        </div>
      </div>

      <form class="sheet" onsubmit={handleBulkCreate}>
        <div class="sheet-head">
          <strong>Bulk Scenario Drafting</strong>
          <button type="button" onclick={addDraftRow}>+ Row</button>
        </div>
        <div class="sheet-table">
          <div class="sheet-row sheet-row--head">
            <span>Scenario</span><span>Priority</span><span>Auto</span><span>Notes</span><span>Steps</span>
          </div>
          {#each draftRows as row, rowIndex}
            <div class="sheet-row">
              <input bind:value={row.name} placeholder="Scenario name" disabled={busy || !selectedNodeId} />
              <select bind:value={row.priority} disabled={busy || !selectedNodeId}>
                <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
              <label class="mini-check"><input type="checkbox" bind:checked={row.automatable} disabled={busy || !selectedNodeId} /></label>
              <textarea bind:value={row.notes} placeholder="Review notes" disabled={busy || !selectedNodeId}></textarea>
              <div class="step-sheet">
                {#each row.steps as step}
                  <div class="step-row">
                    <select bind:value={step.keyword} disabled={busy || !selectedNodeId}>
                      <option>GIVEN</option><option>WHEN</option><option>THEN</option><option>AND</option><option>BUT</option>
                    </select>
                    <textarea bind:value={step.name} placeholder="Step name" disabled={busy || !selectedNodeId}></textarea>
                    <textarea bind:value={step.description} placeholder="Description" disabled={busy || !selectedNodeId}></textarea>
                    <textarea bind:value={step.expectation} placeholder="Expectation" disabled={busy || !selectedNodeId}></textarea>
                  </div>
                {/each}
                <button type="button" onclick={() => addStep(rowIndex)} disabled={busy || !selectedNodeId}>+ Step</button>
              </div>
            </div>
          {/each}
        </div>
        <button type="submit" disabled={busy || !selectedNodeId}>Create Drafts</button>
      </form>

      {#if reviewMode === 'DRAFT' && visibleScenarios.length > 0}
        <div class="bulk-actions">
          <span>{selectedDraftIds.length} selected</span>
          <button onclick={handleApproveDrafts} disabled={busy || selectedDraftIds.length === 0}>Approve</button>
          <button class="danger" onclick={handleRejectDrafts} disabled={busy || selectedDraftIds.length === 0}>Reject</button>
        </div>
      {/if}

      <div class="scenario-list">
        {#each visibleScenarios as scenario}
          <button class="scenario-row" class:active={selectedScenario?.id === scenario.id} onclick={() => selectedScenarioId = scenario.id}>
            {#if reviewMode === 'DRAFT'}
              <input type="checkbox" checked={selectedDraftIds.includes(scenario.id)} onclick={(e) => { e.stopPropagation(); toggleDraft(scenario.id); }} />
            {/if}
            <span class="scenario-key">{scenario.scenarioKey}</span>
            <span class="scenario-name">{scenario.name}</span>
            <Badge text={scenario.status} variant={statusVariant(scenario.status)} />
            <Badge text={scenario.automationStatus} variant={statusVariant(scenario.automationStatus)} />
          </button>
        {:else}
          <div class="empty-state">No {reviewMode === 'LIVE' ? 'live' : 'draft'} scenarios in this scope.</div>
        {/each}
      </div>
    </section>

    <aside class="detail-panel">
      {#if selectedScenario}
        <div class="detail-header">
          <div>
            <span class="scenario-key">{selectedScenario.scenarioKey}</span>
            <h2>{selectedScenario.name}</h2>
          </div>
          <Badge text={selectedScenario.status} variant={statusVariant(selectedScenario.status)} />
        </div>

        <div class="detail-grid">
          <span>Source</span><strong>{selectedScenario.source}</strong>
          <span>Priority</span><strong>{selectedScenario.priority ?? 'UNSET'}</strong>
          <span>Steps</span><strong>{selectedScenario.steps?.length ?? 0}</strong>
          <span>Automatable</span><strong>{selectedScenario.automatable ? 'Yes' : 'No'}</strong>
        </div>

        <label class="field"><span>Name</span><input bind:value={editScenarioName} disabled={busy} /></label>
        <label class="field">
          <span>Automation Status</span>
          <select bind:value={editAutomationStatus} disabled={busy}>
            <option>AUTOMATED</option><option>AUTOMATABLE</option><option>MANUAL_ONLY</option>
          </select>
        </label>
        <label class="field"><span>Manual Notes</span><textarea bind:value={editManualNotes} disabled={busy}></textarea></label>

        <div class="detail-steps">
          <div class="sheet-head">
            <strong>Steps</strong>
            <button type="button" onclick={addEditStep}>+ Step</button>
          </div>
          {#each editSteps as step, index}
            <div class="edit-step">
              <select bind:value={step.keyword} disabled={busy}>
                <option>GIVEN</option><option>WHEN</option><option>THEN</option><option>AND</option><option>BUT</option>
              </select>
              <textarea bind:value={step.name} placeholder="Step name" disabled={busy}></textarea>
              <textarea bind:value={step.description} placeholder="Description" disabled={busy}></textarea>
              <textarea bind:value={step.expectation} placeholder="Expectation" disabled={busy}></textarea>
              <div class="step-actions">
                <button type="button" onclick={() => moveEditStep(index, -1)} disabled={busy || index === 0}>↑</button>
                <button type="button" onclick={() => moveEditStep(index, 1)} disabled={busy || index === editSteps.length - 1}>↓</button>
              </div>
            </div>
          {/each}
        </div>

        <div class="actions">
          <button onclick={handleSaveScenario} disabled={busy}>Save</button>
          <button class="danger" onclick={handleArchiveScenario} disabled={busy}>Archive</button>
        </div>

        {#if selectedScenario.status === 'ACTIVE'}
          <form class="manual-form" onsubmit={handleManualExecution}>
            <h3>Manual Execution</h3>
            <select bind:value={manualStatus} disabled={busy}>
              <option>PASSED</option><option>FAILED</option><option>BLOCKED</option><option>SKIPPED</option>
            </select>
            <input bind:value={manualExecutor} placeholder="Executed by" disabled={busy} />
            <input bind:value={manualEnvironment} placeholder="Environment" disabled={busy} />
            <textarea bind:value={manualNotes} placeholder="Execution notes" disabled={busy}></textarea>
            <button type="submit" disabled={busy}>Record Result</button>
          </form>
        {/if}
      {:else}
        <div class="empty-state">Select a scenario to view details.</div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .page { max-width: 1320px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 18px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .repo-layout { display: grid; grid-template-columns: 240px minmax(500px, 1fr) 360px; border: 1px solid var(--color-border); border-radius: var(--radius); min-height: 680px; overflow: hidden; background: var(--color-surface); }
  .tree-panel, .scenario-panel, .detail-panel { min-width: 0; }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-bg); }
  .detail-panel { border-left: 1px solid var(--color-border); background: var(--color-bg); padding: 16px; overflow: auto; }
  .panel-header, .sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .panel-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .panel-subtitle { margin: 3px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }
  button, input, select, textarea { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.danger { color: var(--color-danger); }
  input, select, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  textarea { resize: vertical; min-height: 58px; }
  .compact-form, .manual-form { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid var(--color-border); }
  .edit-node { border-top: 1px solid var(--color-border); border-bottom: 0; }
  .tree-list { padding: 8px; }
  .tree-item { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; margin-bottom: 6px; }
  .tree-item small { display: block; color: var(--color-text-muted); font-size: 0.72rem; margin-top: 2px; }
  .node-icon { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; background: var(--color-accent-subtle); color: var(--color-accent); font-size: 0.72rem; font-weight: 800; flex-shrink: 0; }
  .segmented { display: flex; gap: 6px; }
  .sheet { border-bottom: 1px solid var(--color-border); }
  .sheet-table { overflow-x: auto; padding: 10px; }
  .sheet-row { display: grid; grid-template-columns: 180px 112px 52px 160px minmax(360px, 1fr); gap: 8px; min-width: 900px; align-items: start; margin-bottom: 8px; }
  .sheet-row--head { color: var(--color-text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
  .mini-check { display: grid; place-items: center; padding-top: 8px; }
  .mini-check input, .scenario-row input { width: auto; }
  .step-sheet, .detail-steps { display: grid; gap: 8px; }
  .step-row, .edit-step { display: grid; grid-template-columns: 92px 1fr 1fr 1fr; gap: 8px; }
  .sheet > button { margin: 0 10px 12px; }
  .bulk-actions { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.82rem; }
  .scenario-list { padding: 10px; }
  .scenario-row { width: 100%; display: grid; grid-template-columns: 28px 104px minmax(160px, 1fr) 86px 122px; align-items: center; gap: 10px; text-align: left; margin-bottom: 8px; }
  .scenario-list .scenario-row:not(:has(input)) { grid-template-columns: 104px minmax(160px, 1fr) 86px 122px; }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.76rem; color: var(--color-text-muted); }
  .scenario-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .detail-header h2 { font-size: 1rem; margin: 5px 0 0; line-height: 1.35; }
  .detail-grid { display: grid; grid-template-columns: 88px 1fr; gap: 8px 12px; padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); margin-bottom: 14px; font-size: 0.8rem; }
  .detail-grid span, .field span { color: var(--color-text-muted); }
  .field { display: grid; gap: 5px; margin-bottom: 10px; font-size: 0.8rem; }
  .detail-steps { margin: 12px 0; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }
  .detail-steps .sheet-head { padding: 0 0 10px; border-bottom: 0; }
  .edit-step { grid-template-columns: 84px 1fr; border-top: 1px solid var(--color-border); padding-top: 8px; }
  .edit-step textarea { grid-column: span 2; }
  .step-actions { display: flex; gap: 6px; }
  .actions { display: flex; gap: 8px; margin-bottom: 18px; }
  .manual-form { padding: 14px 0 0; border: 0; border-top: 1px solid var(--color-border); }
  .manual-form h3 { font-size: 0.9rem; margin: 0 0 4px; }
  .empty-state, .muted { color: var(--color-text-muted); font-size: 0.875rem; padding: 24px; text-align: center; }
  @media (max-width: 1100px) {
    .repo-layout { grid-template-columns: 1fr; }
    .tree-panel, .detail-panel { border: 0; border-bottom: 1px solid var(--color-border); }
  }
</style>

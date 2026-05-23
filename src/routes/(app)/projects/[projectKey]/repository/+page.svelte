<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import {
    archiveScenario,
    createManualExecution,
    createNode,
    createScenario,
    deleteNode,
    renameNode,
    updateScenario,
    type Scenario,
    type TestNode
  } from '$lib/api/testcases';

  let { data } = $props();

  let selectedNodeId = $state<string | null>(null);
  let selectedScenarioId = $state<string | null>(null);
  let initializedSelection = $state(false);
  let busy = $state(false);
  let actionError = $state('');

  let nodeName = $state('');
  let nodeType = $state<'DIRECTORY' | 'FEATURE'>('DIRECTORY');
  let renameValue = $state('');

  let scenarioName = $state('');
  let scenarioPriority = $state('MEDIUM');
  let scenarioAutomatable = $state(true);
  let scenarioNotes = $state('');

  let manualStatus = $state('PASSED');
  let manualExecutor = $state('');
  let manualEnvironment = $state('');
  let manualNotes = $state('');
  let editScenarioName = $state('');
  let editAutomationStatus = $state('MANUAL_ONLY');
  let editManualNotes = $state('');

  const activeScenarios = $derived(data.scenarios.filter((s: Scenario) => s.status !== 'ARCHIVED'));
  const selectedNode = $derived(data.nodes.find((node: TestNode) => node.id === selectedNodeId) ?? null);
  const visibleScenarios = $derived(
    selectedNodeId
      ? activeScenarios.filter((scenario: Scenario) => scenario.nodeId === selectedNodeId)
      : activeScenarios
  );
  const selectedScenario = $derived(
    activeScenarios.find((scenario: Scenario) => scenario.id === selectedScenarioId) ?? visibleScenarios[0] ?? null
  );

  $effect(() => {
    if (!initializedSelection) {
      selectedNodeId = data.nodes[0]?.id ?? null;
      selectedScenarioId = data.scenarios[0]?.id ?? null;
      initializedSelection = true;
    }
  });

  $effect(() => {
    if (selectedNode && !renameValue) renameValue = selectedNode.name;
  });

  $effect(() => {
    if (selectedScenario) {
      editScenarioName = selectedScenario.name;
      editAutomationStatus = selectedScenario.automationStatus;
      editManualNotes = selectedScenario.manualNotes ?? '';
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
    renameValue = data.nodes.find((node: TestNode) => node.id === nodeId)?.name ?? '';
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
      const node = await createNode(data.projectKey, {
        parentId: null,
        nodeType,
        name: nodeName.trim()
      });
      selectedNodeId = node.id;
      nodeName = '';
    });
  }

  async function handleRenameNode(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNodeId || !renameValue.trim()) return;
    await runAction(async () => {
      await renameNode(data.projectKey, selectedNodeId as string, renameValue.trim());
    });
  }

  async function handleDeleteNode() {
    if (!selectedNodeId) return;
    await runAction(async () => {
      await deleteNode(data.projectKey, selectedNodeId as string);
      selectedNodeId = null;
      selectedScenarioId = null;
    });
  }

  async function handleCreateScenario(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNodeId || !scenarioName.trim()) return;
    await runAction(async () => {
      const scenario = await createScenario(data.projectKey, {
        nodeId: selectedNodeId as string,
        name: scenarioName.trim(),
        priority: scenarioPriority,
        automatable: scenarioAutomatable,
        notes: scenarioNotes.trim() || undefined
      });
      selectedScenarioId = scenario.id;
      scenarioName = '';
      scenarioNotes = '';
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
        manualNotes: editManualNotes.trim() || undefined
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
      <p class="page-subtitle">Manage test folders, feature nodes, manual scenarios, and execution evidence.</p>
    </div>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load repository — {data.error}</div>
  {/if}
  {#if actionError}
    <div class="error-banner">{actionError}</div>
  {/if}

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
        {#if data.nodes.length === 0}
          <p class="muted">No nodes yet.</p>
        {:else}
          {#each data.nodes as node}
            <button
              class="tree-item"
              class:active={selectedNodeId === node.id}
              onclick={() => selectNode(node.id)}
            >
              <span class="node-icon">{node.nodeType === 'FEATURE' ? 'F' : 'D'}</span>
              <span>
                <strong>{node.name}</strong>
                <small>{node.path}</small>
              </span>
            </button>
          {/each}
        {/if}
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
          <p class="panel-subtitle">{visibleScenarios.length} active scenarios</p>
        </div>
      </div>

      <form class="scenario-form" onsubmit={handleCreateScenario}>
        <input bind:value={scenarioName} placeholder="New scenario name" disabled={busy || !selectedNodeId} />
        <select bind:value={scenarioPriority} disabled={busy || !selectedNodeId}>
          <option>CRITICAL</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
        <label class="check">
          <input type="checkbox" bind:checked={scenarioAutomatable} disabled={busy || !selectedNodeId} />
          Automatable
        </label>
        <textarea bind:value={scenarioNotes} placeholder="Manual notes" disabled={busy || !selectedNodeId}></textarea>
        <button type="submit" disabled={busy || !selectedNodeId || !scenarioName.trim()}>Add Scenario</button>
      </form>

      <div class="scenario-list">
        {#if visibleScenarios.length === 0}
          <div class="empty-state">No scenarios in this scope.</div>
        {:else}
          {#each visibleScenarios as scenario}
            <button
              class="scenario-row"
              class:active={selectedScenario?.id === scenario.id}
              onclick={() => selectedScenarioId = scenario.id}
            >
              <span class="scenario-key">{scenario.scenarioKey}</span>
              <span class="scenario-name">{scenario.name}</span>
              <Badge text={scenario.priority ?? 'UNSET'} variant="neutral" />
              <Badge text={scenario.automationStatus} variant={statusVariant(scenario.automationStatus)} />
            </button>
          {/each}
        {/if}
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
          <span>Feature</span><strong>{selectedScenario.featureName ?? 'Manual'}</strong>
          <span>Automatable</span><strong>{selectedScenario.automatable ? 'Yes' : 'No'}</strong>
        </div>

        <label class="field">
          <span>Name</span>
          <input bind:value={editScenarioName} disabled={busy} />
        </label>
        <label class="field">
          <span>Automation Status</span>
          <select bind:value={editAutomationStatus} disabled={busy}>
            <option>AUTOMATED</option>
            <option>AUTOMATABLE</option>
            <option>MANUAL_ONLY</option>
          </select>
        </label>
        <label class="field">
          <span>Manual Notes</span>
          <textarea bind:value={editManualNotes} disabled={busy}></textarea>
        </label>

        <div class="actions">
          <button onclick={handleSaveScenario} disabled={busy}>Save</button>
          <button class="danger" onclick={handleArchiveScenario} disabled={busy}>Archive</button>
        </div>

        <form class="manual-form" onsubmit={handleManualExecution}>
          <h3>Manual Execution</h3>
          <select bind:value={manualStatus} disabled={busy}>
            <option>PASSED</option>
            <option>FAILED</option>
            <option>BLOCKED</option>
            <option>SKIPPED</option>
          </select>
          <input bind:value={manualExecutor} placeholder="Executed by" disabled={busy} />
          <input bind:value={manualEnvironment} placeholder="Environment" disabled={busy} />
          <textarea bind:value={manualNotes} placeholder="Execution notes" disabled={busy}></textarea>
          <button type="submit" disabled={busy}>Record Result</button>
        </form>
      {:else}
        <div class="empty-state">Select a scenario to view details.</div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .page { max-width: 1280px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 18px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }

  .repo-layout {
    display: grid;
    grid-template-columns: 250px minmax(340px, 1fr) 300px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    min-height: 620px;
    overflow: hidden;
    background: var(--color-surface);
  }

  .tree-panel, .scenario-panel, .detail-panel { min-width: 0; }
  .tree-panel { border-right: 1px solid var(--color-border); background: var(--color-bg); }
  .detail-panel { border-left: 1px solid var(--color-border); background: var(--color-bg); padding: 16px; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .panel-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .panel-subtitle { margin: 3px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }

  button, input, select, textarea { font: inherit; }
  button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: 6px;
    padding: 7px 10px;
    cursor: pointer;
  }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.danger { color: var(--color-danger); }
  input, select, textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    padding: 8px 10px;
    min-width: 0;
  }
  textarea { resize: vertical; min-height: 72px; }

  .compact-form, .scenario-form, .manual-form { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid var(--color-border); }
  .edit-node { border-top: 1px solid var(--color-border); border-bottom: 0; }
  .tree-list { padding: 8px; }
  .tree-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    margin-bottom: 6px;
  }
  .tree-item small { display: block; color: var(--color-text-muted); font-size: 0.72rem; margin-top: 2px; }
  .node-icon {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: 0.72rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .scenario-form { grid-template-columns: minmax(160px, 1fr) 112px 120px; align-items: center; }
  .scenario-form textarea, .scenario-form button { grid-column: 1 / -1; }
  .check { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); }
  .check input { width: auto; }
  .scenario-list { padding: 10px; }
  .scenario-row {
    width: 100%;
    display: grid;
    grid-template-columns: 96px minmax(100px, 1fr) 76px 112px;
    align-items: center;
    gap: 10px;
    text-align: left;
    margin-bottom: 8px;
  }
  .scenario-key { font-family: ui-monospace, monospace; font-size: 0.76rem; color: var(--color-text-muted); }
  .scenario-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .detail-header h2 { font-size: 1rem; margin: 5px 0 0; line-height: 1.35; }
  .detail-grid { display: grid; grid-template-columns: 88px 1fr; gap: 8px 12px; padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); margin-bottom: 14px; font-size: 0.8rem; }
  .detail-grid span { color: var(--color-text-muted); }
  .field { display: grid; gap: 5px; margin-bottom: 10px; font-size: 0.8rem; color: var(--color-text-muted); }
  .actions { display: flex; gap: 8px; margin-bottom: 18px; }
  .manual-form { padding: 14px 0 0; border: 0; border-top: 1px solid var(--color-border); }
  .manual-form h3 { font-size: 0.9rem; margin: 0 0 4px; }
  .empty-state, .muted { color: var(--color-text-muted); font-size: 0.875rem; padding: 24px; text-align: center; }

  @media (max-width: 980px) {
    .repo-layout { grid-template-columns: 1fr; }
    .tree-panel, .detail-panel { border: 0; border-bottom: 1px solid var(--color-border); }
    .scenario-row { grid-template-columns: 96px 1fr; }
  }
</style>

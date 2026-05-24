<script lang="ts">
  import { goto } from '$app/navigation';
  import { createScenario, type ScenarioStep, type TestDirectory } from '$lib/api/testcases';

  let { data } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let nodeId = $state('');
  let name = $state('');
  let priority = $state('MEDIUM');
  let automatable = $state(true);
  let description = $state('');
  let steps = $state<Array<Omit<ScenarioStep, 'id'>>>([
    { sequenceNo: 1, keyword: 'GIVEN', name: '', description: '', expectation: '' },
    { sequenceNo: 2, keyword: 'WHEN', name: '', description: '', expectation: '' },
    { sequenceNo: 3, keyword: 'THEN', name: '', description: '', expectation: '' }
  ]);

  const selectedNode = $derived(data.directories.find((node: TestDirectory) => node.id === nodeId) ?? null);
  const breadcrumbNodes = $derived(buildBreadcrumb(selectedNode));

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
    steps = [...steps, { sequenceNo: steps.length + 1, keyword: 'AND', name: '', description: '', expectation: '' }];
  }

  function removeStep(index: number) {
    steps = steps.filter((_, stepIndex) => stepIndex !== index).map((step, stepIndex) => ({ ...step, sequenceNo: stepIndex + 1 }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    steps = next.map((step, stepIndex) => ({ ...step, sequenceNo: stepIndex + 1 }));
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!nodeId || !name.trim()) return;
    busy = true;
    actionError = '';
    try {
      await createScenario(data.projectKey, {
        nodeId,
        name: name.trim(),
        priority,
        automatable,
        notes: description.trim() || undefined,
        steps: steps
          .filter((step) => step.name.trim())
          .map((step, index) => ({ ...step, sequenceNo: index + 1, name: step.name.trim() }))
      });
      await goto(`/projects/${data.projectKey}/repository`);
    } catch (e) {
      actionError = (e as Error).message;
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
        <label class="wide">
          <span>Directory</span>
          <select bind:value={nodeId} required disabled={busy}>
            {#each data.directories as node}
              <option value={node.id}>{node.path}</option>
            {/each}
          </select>
        </label>
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
        <label class="check-field">
          <input type="checkbox" bind:checked={automatable} disabled={busy} />
          <span>Automatable</span>
        </label>
        <label class="wide">
          <span>Description</span>
          <textarea bind:value={description} placeholder="Optional review notes or scenario context" disabled={busy}></textarea>
        </label>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2>Steps</h2>
        <button type="button" onclick={addStep} disabled={busy}>+ Step</button>
      </div>
      <div class="steps-table">
        <div class="steps-row steps-row--head">
          <span>Order</span>
          <span>Keyword</span>
          <span>Name</span>
          <span>Description</span>
          <span>Expectation</span>
          <span></span>
        </div>
        {#each steps as step, index}
          <div class="steps-row">
            <div class="order-cell">
              <strong>{index + 1}</strong>
              <button type="button" onclick={() => moveStep(index, -1)} disabled={busy || index === 0}>↑</button>
              <button type="button" onclick={() => moveStep(index, 1)} disabled={busy || index === steps.length - 1}>↓</button>
            </div>
            <select bind:value={step.keyword} disabled={busy}>
              <option>GIVEN</option>
              <option>WHEN</option>
              <option>THEN</option>
              <option>AND</option>
              <option>BUT</option>
            </select>
            <textarea bind:value={step.name} placeholder="Step name" disabled={busy}></textarea>
            <textarea bind:value={step.description} placeholder="Details" disabled={busy}></textarea>
            <textarea bind:value={step.expectation} placeholder="Expected result" disabled={busy}></textarea>
            <button type="button" class="danger" onclick={() => removeStep(index)} disabled={busy || steps.length === 1}>Remove</button>
          </div>
        {/each}
      </div>
    </section>

    <div class="form-actions">
      <button type="button" onclick={() => goto(`/projects/${data.projectKey}/repository`)} disabled={busy}>Cancel</button>
      <button type="submit" class="primary-btn" disabled={busy || !nodeId || !name.trim()}>Create Draft Scenario</button>
    </div>
  </form>
</div>

<style>
  .page { max-width: 1180px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { margin-bottom: 18px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  .scenario-form { display: grid; gap: 18px; }
  .section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .path-row { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; color: var(--color-text-muted); }
  .path { display: flex; align-items: center; gap: 8px; color: var(--color-text); flex-wrap: wrap; }
  .form-grid { display: grid; grid-template-columns: 220px 1fr; gap: 14px; }
  .wide { grid-column: 1 / -1; }
  label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .check-field { grid-template-columns: auto 1fr; align-items: center; align-content: center; padding-top: 22px; }
  button, input, select, textarea { font: inherit; }
  button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  button.danger { color: var(--color-danger); }
  input, select, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); padding: 8px 10px; min-width: 0; }
  input[type='checkbox'] { width: auto; }
  textarea { min-height: 64px; resize: vertical; }
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .section-header h2 { font-size: 1rem; margin: 0; }
  .steps-table { overflow-x: auto; }
  .steps-row { display: grid; grid-template-columns: 86px 110px minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) 90px; gap: 8px; min-width: 960px; margin-bottom: 8px; align-items: start; }
  .steps-row--head { color: var(--color-text-muted); font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
  .order-cell { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 4px; }
  .order-cell button { padding: 5px 7px; }
  .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 720px) {
    .form-grid { grid-template-columns: 1fr; }
    .check-field { padding-top: 0; }
  }
</style>

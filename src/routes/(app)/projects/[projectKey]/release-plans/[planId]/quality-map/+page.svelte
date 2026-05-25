<script lang="ts">
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import SetaraMindMap from '$lib/components/mindmap/SetaraMindMap.svelte';
  import type { MapNode } from '$lib/api/mindmaps';
  import { getScenario, type Scenario } from '$lib/api/testcases';

  let { data } = $props();
  let scenarioDetail = $state<Scenario | null>(null);
  let scenarioOpen = $state(false);
  let scenarioBusy = $state(false);
  let scenarioError = $state('');

  function updateQuery(key: string, value: boolean) {
    const search = new URLSearchParams();
    search.set('depth', String(data.depth));
    search.set('includeScenarios', String(key === 'includeScenarios' ? value : data.includeScenarios));
    search.set('riskOnly', String(key === 'riskOnly' ? value : data.riskOnly));
    goto(`?${search.toString()}`);
  }

  async function handleNodeClick(node: MapNode) {
    if (node.type === 'DIRECTORY') {
      const directoryId = node.target?.entityId ?? node.id.replace(/^directory:/, '');
      if (directoryId && !directoryId.includes('/')) {
        goto(`/projects/${data.projectKey}/repository/directories/${encodeURIComponent(directoryId)}/coverage-map?includeScenarios=true`);
      }
      return;
    }
    if (node.type === 'SCENARIO') {
      const scenarioId = node.target?.entityId ?? node.id.replace(/^scenario:/, '');
      await openScenario(scenarioId);
    }
  }

  async function openScenario(scenarioId: string) {
    scenarioOpen = true;
    scenarioBusy = true;
    scenarioError = '';
    scenarioDetail = null;
    try {
      scenarioDetail = await getScenario(data.projectKey, scenarioId);
    } catch (e) {
      scenarioError = (e as Error).message;
    } finally {
      scenarioBusy = false;
    }
  }
</script>

<svelte:head>
  <title>Quality Map - {data.projectKey} - Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span>/</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>/</span>
    <a href="/projects/{data.projectKey}/release-plans/{data.planId}">Plan</a>
    <span>/</span>
    <strong>Quality Map</strong>
  </nav>

  <div class="page-header">
    <div>
      <p>Release Plan</p>
      <h1>Quality Map</h1>
      <span>Plan confidence, coverage gaps, and execution risks in one view.</span>
    </div>
    <div class="header-actions">
      <label><input type="checkbox" checked={data.includeScenarios} onchange={(e) => updateQuery('includeScenarios', e.currentTarget.checked)} /> Scenarios</label>
      <label><input type="checkbox" checked={data.riskOnly} onchange={(e) => updateQuery('riskOnly', e.currentTarget.checked)} /> Risk only</label>
    </div>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load quality map - {data.error}</div>
  {:else if data.qualityMap}
    <SetaraMindMap map={data.qualityMap} onnodeclick={handleNodeClick} />
  {/if}
</div>

<Modal open={scenarioOpen} title={scenarioDetail?.name ?? 'Scenario Detail'} size="lg" onclose={() => scenarioOpen = false}>
  {#if scenarioBusy}
    <div class="empty-state">Loading scenario...</div>
  {:else if scenarioError}
    <div class="error-banner">{scenarioError}</div>
  {:else if scenarioDetail}
    <div class="scenario-detail">
      <div class="scenario-meta">
        <span>{scenarioDetail.scenarioKey}</span>
        <span>{scenarioDetail.priority ?? 'UNSET'}</span>
        <span>{scenarioDetail.automationStatus}</span>
        <span>{scenarioDetail.status}</span>
      </div>
      {#if scenarioDetail.manualNotes}<p>{scenarioDetail.manualNotes}</p>{/if}
      <div class="step-list">
        {#each scenarioDetail.steps as step}
          <div class="step-row">
            <span>{step.sequenceNo}</span>
            <div>
              <strong>{step.keyword} {step.name}</strong>
              {#if step.description}<p>{step.description}</p>{/if}
              {#if step.expectation}<small>Expected: {step.expectation}</small>{/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</Modal>

<style>
  .page { max-width: none; }
  .breadcrumb { display: flex; align-items: center; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .page-header p { margin: 0 0 4px; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem; font-weight: 850; }
  .page-header h1 { margin: 0; font-size: 1.45rem; }
  .page-header span { color: var(--color-text-muted); font-size: 0.86rem; }
  .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  label { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; color: var(--color-text-muted); font-size: 0.82rem; background: var(--color-surface); }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; }
  .empty-state { color: var(--color-text-muted); padding: 18px; text-align: center; }
  .scenario-detail { display: grid; gap: 14px; }
  .scenario-detail > p { margin: 0; color: var(--color-text-muted); }
  .scenario-meta { display: flex; flex-wrap: wrap; gap: 8px; }
  .scenario-meta span { border: 1px solid var(--color-border); border-radius: 999px; padding: 5px 9px; color: var(--color-text-muted); font-size: 0.74rem; font-weight: 800; }
  .step-list { display: grid; gap: 12px; max-height: min(58vh, 620px); overflow: auto; padding-right: 4px; }
  .step-row { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; align-items: start; }
  .step-row > span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; background: color-mix(in srgb, var(--color-accent), transparent 84%); color: var(--color-accent); font-size: 0.78rem; font-weight: 900; }
  .step-row strong { display: block; }
  .step-row p, .step-row small { display: block; margin: 4px 0 0; color: var(--color-text-muted); font-size: 0.84rem; line-height: 1.45; }
  @media (max-width: 720px) { .page-header { display: grid; } }
</style>

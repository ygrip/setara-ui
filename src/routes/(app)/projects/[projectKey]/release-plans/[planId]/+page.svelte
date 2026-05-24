<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { addPlanScenario, closePlan, removePlanScenario, selectPlanExecution, type PlanMetrics, type PlanScenario, type ReleasePlan } from '$lib/api/plans';
  import type { ScenarioRunResult } from '$lib/api/runs';
  import { createManualExecution, type Scenario } from '$lib/api/testcases';

  let { data }: {
    data: {
      projectKey: string;
      planId: string;
      plan: ReleasePlan | null;
      planScenarios: PlanScenario[];
      metrics: PlanMetrics | null;
      liveScenarios: Scenario[];
      results: ScenarioRunResult[];
      error: string | null;
    }
  } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let selectedScenarioId = $state('');
  let selectedResultId = $state('');
  let selectedBy = $state('');
  let showScenarioPicker = $state(false);
  let scenarioFilter = $state('');
  let manualStatus = $state('PASSED');
  let signoffBy = $state('');

  const scopedIds = $derived(new Set(data.planScenarios.map(item => item.scenarioId)));
  const availableScenarios = $derived(data.liveScenarios.filter(item => !scopedIds.has(item.id)));
  const selectedScenarioResults = $derived(data.results.filter(result => result.scenarioId === selectedScenarioId));
  const pickerScenarios = $derived(availableScenarios.filter(s => `${s.scenarioKey} ${s.name}`.toLowerCase().includes(scenarioFilter.toLowerCase())));
  const canClose = $derived((data.metrics?.totalScenarios ?? 0) > 0 && (data.metrics?.selectedExecutions ?? 0) >= (data.metrics?.totalScenarios ?? 0));
  const planDonut = $derived({
    labels: ['Passed', 'Failed', 'Not executed', 'Other executed'],
    datasets: [{
      data: [
        data.metrics?.passed ?? 0,
        data.metrics?.failed ?? 0,
        Math.max((data.metrics?.totalScenarios ?? 0) - (data.metrics?.selectedExecutions ?? 0), 0),
        (data.metrics?.blocked ?? 0) + (data.metrics?.skipped ?? 0)
      ],
      backgroundColor: ['#0f766e', '#dc2626', '#d1d5db', '#f59e0b'],
      borderWidth: 0
    }]
  });

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED':
      case 'READY':
      case 'RELEASED':
      case 'CLOSED':
        return 'success';
      case 'FAILED':
      case 'FAIL':
        return 'danger';
      case 'ACTIVE':
      case 'RUNNING':
      case 'IN_PROGRESS':
        return 'info';
      case 'WARNING':
      case 'AT_RISK':
      case 'SKIPPED':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function pct(value: number | undefined | null): string {
    return `${Number(value ?? 0).toFixed(0)}%`;
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

  async function addScenario(scenarioId: string) {
    await runAction(async () => {
      await addPlanScenario(data.projectKey, data.planId, scenarioId, false, 'MANUAL');
      showScenarioPicker = false;
    });
  }

  async function removeScenario(scenarioId: string) {
    await runAction(async () => {
      await removePlanScenario(data.projectKey, data.planId, scenarioId);
    });
  }

  async function selectEvidence() {
    if (!selectedScenarioId || !selectedResultId) return;
    await runAction(async () => {
      await selectPlanExecution(data.projectKey, data.planId, {
        scenarioId: selectedScenarioId,
        scenarioRunResultId: selectedResultId,
        selectedBy: selectedBy.trim() || undefined
      });
      selectedResultId = '';
    });
  }

  async function createManualEvidence() {
    if (!selectedScenarioId) return;
    await runAction(async () => {
      const execution = await createManualExecution(data.projectKey, selectedScenarioId, {
        status: manualStatus,
        executedBy: selectedBy.trim() || undefined,
        finishedAt: new Date().toISOString()
      });
      await selectPlanExecution(data.projectKey, data.planId, {
        scenarioId: selectedScenarioId,
        manualExecutionId: execution.id,
        selectedBy: selectedBy.trim() || undefined
      });
    });
  }

  async function signOffPlan() {
    if (!canClose) return;
    await runAction(async () => {
      await closePlan(data.projectKey, data.planId, { signedOffBy: signoffBy.trim() || undefined });
    });
  }
</script>

<svelte:head>
  <title>Release Plan — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/release-plans">Release Plans</a>
    <span class="sep">›</span>
    <span>{data.plan?.name ?? data.planId.slice(0, 8)}</span>
  </nav>

  {#if data.error}
    <div class="error-banner">Could not load release plan - {data.error}</div>
  {:else if data.plan && data.metrics}
    <div class="page-header">
      <div>
        <p class="eyebrow">{data.plan.releaseVersion ?? data.projectKey}</p>
        <h1 class="page-title">{data.plan.name}</h1>
        {#if data.plan.description}<p class="page-subtitle">{data.plan.description}</p>{/if}
      </div>
      <div class="header-actions">
        <Badge text={data.plan.status} variant={statusVariant(data.plan.status)} />
      </div>
    </div>

    {#if actionError}<div class="error-banner">{actionError}</div>{/if}

    <div class="metrics-row">
      <MetricCard label="Plan Scenarios" value={data.metrics.totalScenarios} sub="live scope" />
      <MetricCard label="Evidence Selected" value={data.metrics.selectedExecutions} sub={pct(data.metrics.executionCoverage)} variant="info" />
      <MetricCard label="Pass Rate" value={pct(data.metrics.passPercentage)} sub={`${data.metrics.passed} passed`} variant={data.metrics.failed ? 'danger' : 'success'} />
      <MetricCard label="Automation Coverage" value={pct(data.metrics.automationCoverage)} sub={`threshold ${data.plan.coverageThreshold}%`} variant="default" />
    </div>

    <section class="panel visual-panel">
      <div class="chart-copy">
        <h2>Execution Composition</h2>
        <p>{data.metrics.selectedExecutions} executed of {data.metrics.totalScenarios} scoped scenarios.</p>
      </div>
      <DonutChart chartData={planDonut} size={320} />
    </section>

    <section class="panel quality-panel">
      <div>
        <h2>Plan Sign Off</h2>
        <p>Close this plan after every scoped scenario has execution evidence.</p>
      </div>
      <div class="gate-breakdown">
        <span>Passed <strong>{data.metrics.passed}</strong></span>
        <span>Failed <strong>{data.metrics.failed}</strong></span>
        <span>Blocked <strong>{data.metrics.blocked}</strong></span>
        <span>Skipped <strong>{data.metrics.skipped}</strong></span>
      </div>
      <div class="signoff-actions">
        <input bind:value={signoffBy} placeholder="Signed off by" disabled={busy || data.plan.status === 'CLOSED'} />
        <button class="primary-btn" onclick={signOffPlan} disabled={busy || !canClose || data.plan.status === 'CLOSED'}>Sign Off / Close Plan</button>
      </div>
    </section>

    <section class="panel">
        <div class="section-head">
          <h2>Plan Scenarios</h2>
          <div class="section-actions">
            <span>{data.planScenarios.length} selected</span>
            <button onclick={() => showScenarioPicker = true} disabled={busy || data.plan.status === 'CLOSED'}>Add Manual Scenario</button>
          </div>
        </div>
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Scenario</th>
              <th>Priority</th>
              <th>Runnable</th>
              <th>Last Evidence</th>
              <th>Run By</th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#if data.planScenarios.length === 0}
              <tr><td colspan="4" class="empty-cell">No scenarios in this plan.</td></tr>
            {:else}
              {#each data.planScenarios as scenario}
                <tr>
                  <td><strong>{scenario.scenarioKey}</strong><span>{scenario.name}</span></td>
                  <td>{scenario.priority ?? '-'}</td>
                  <td><Badge text={scenario.runnable ? 'RUNNABLE' : 'MANUAL'} variant={scenario.runnable ? 'info' : 'neutral'} /></td>
                  <td>{scenario.selectedStatus ?? 'Not run'}</td>
                  <td>{scenario.runBy ?? scenario.selectedBy ?? '-'}</td>
                  <td><button class="ghost-btn" onclick={() => removeScenario(scenario.scenarioId)} disabled={busy}>Remove</button></td>
                </tr>
              {/each}
            {/if}
          {/snippet}
        </DataTable>
    </section>

    <section class="panel evidence-panel">
      <div class="section-head">
        <h2>Execution Evidence</h2>
        <span>{data.results.length} recent results</span>
      </div>
      <div class="evidence-controls">
        <label>
          <span>Plan Scenario</span>
          <select bind:value={selectedScenarioId}>
            <option value="">Select scenario</option>
            {#each data.planScenarios as scenario}
              <option value={scenario.scenarioId}>{scenario.scenarioKey} - {scenario.name}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Run Result</span>
          <select bind:value={selectedResultId} disabled={!selectedScenarioId}>
            <option value="">Select execution result</option>
            {#each selectedScenarioResults as result}
              <option value={result.id}>{result.status} - {formatDate(result.finishedAt)}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Selected By</span>
          <input bind:value={selectedBy} placeholder="qa@example.com" />
        </label>
        <button class="primary-btn" onclick={selectEvidence} disabled={busy || !selectedScenarioId || !selectedResultId}>Select Evidence</button>
      </div>
      {#if selectedScenarioId && selectedScenarioResults.length === 0}
        <div class="manual-evidence">
          <p class="hint">No automated result found for this scenario in recent runs. Add manual evidence to complete sign off.</p>
          <select bind:value={manualStatus}>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="SKIPPED">Skipped</option>
          </select>
          <button onclick={createManualEvidence} disabled={busy || !selectedScenarioId}>Add Manual Evidence</button>
        </div>
      {/if}
    </section>
  {/if}
</div>

<Modal open={showScenarioPicker} title="Add Manual Scenario" onclose={() => showScenarioPicker = false}>
  <div class="picker">
    <input bind:value={scenarioFilter} placeholder="Search scenario key or name" />
    <div class="add-list">
      {#if pickerScenarios.length === 0}
        <div class="empty-cell">No matching live scenarios available.</div>
      {:else}
        {#each pickerScenarios as scenario}
          <button class="add-row" onclick={() => addScenario(scenario.id)} disabled={busy}>
            <strong>{scenario.scenarioKey}</strong>
            <span>{scenario.name}</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</Modal>

<style>
  .page { max-width: 1180px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .page-subtitle, .eyebrow, .hint { color: var(--color-text-muted); font-size: 0.85rem; margin: 6px 0 0; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .header-actions { display: flex; align-items: center; gap: 10px; }
  .metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .visual-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px; margin-bottom: 18px; }
  .chart-copy { min-width: 0; }
  .visual-panel p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; }
  .quality-panel { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; margin-bottom: 18px; }
  h2 { font-size: 1rem; margin: 0 0 4px; }
  .quality-panel p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; }
  .gate-breakdown { display: flex; flex-wrap: wrap; gap: 8px; }
  .gate-breakdown span { border: 1px solid var(--color-border); border-radius: 6px; padding: 6px 9px; color: var(--color-text-muted); font-size: 0.8rem; }
  .gate-breakdown strong { color: var(--color-text); }
  .signoff-actions { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 10px; align-items: center; }
  button, select, input { font: inherit; }
  button, select, input { border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
  button { padding: 7px 11px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  select, input { width: 100%; padding: 8px 10px; }
  .primary-btn { background: var(--color-accent); border-color: var(--color-accent); color: white; align-self: end; }
  .ghost-btn { font-size: 0.78rem; }
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .section-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .section-head span { color: var(--color-text-muted); font-size: 0.78rem; }
  td span { display: block; color: var(--color-text-muted); font-size: 0.78rem; margin-top: 2px; }
  .empty-cell { text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 24px !important; }
  .add-list { display: grid; gap: 8px; max-height: 360px; overflow: auto; }
  .add-row { display: grid; gap: 3px; text-align: left; padding: 10px; }
  .add-row span { color: var(--color-text-muted); font-size: 0.8rem; }
  .evidence-controls { display: grid; grid-template-columns: 1fr 1fr 220px auto; gap: 12px; align-items: end; }
  .manual-evidence { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  .manual-evidence .hint { flex: 1 1 320px; }
  .manual-evidence select { width: 160px; }
  .picker { display: grid; gap: 12px; }
  label { display: grid; gap: 5px; color: var(--color-text-muted); font-size: 0.75rem; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  @media (max-width: 920px) {
    .page-header, .quality-panel { grid-template-columns: 1fr; flex-direction: column; }
    .evidence-controls, .visual-panel, .signoff-actions { grid-template-columns: 1fr; }
  }
</style>

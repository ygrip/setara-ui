<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { addPlanScenario, addPlanScenariosFromRun, closePlan, removePlanScenario, selectPlanExecution, type PlanMetrics, type PlanScenario, type ReleasePlan } from '$lib/api/plans';
  import type { AutomationRun, ScenarioRunResult } from '$lib/api/runs';
  import { createManualExecution, type Scenario, type TestDirectory } from '$lib/api/testcases';

  let { data }: {
    data: {
      projectKey: string;
      planId: string;
      plan: ReleasePlan | null;
      planScenarios: PlanScenario[];
      metrics: PlanMetrics | null;
      liveScenarios: Scenario[];
      directories: TestDirectory[];
      runs: AutomationRun[];
      results: ScenarioRunResult[];
      error: string | null;
    }
  } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let selectedBy = $state('');
  let showScenarioPicker = $state(false);
  let showRunPicker = $state(false);
  let showAudit = $state(false);
  let detailScenarioId = $state('');
  let expandedDirectoryIds = $state<Set<string>>(new Set());
  let scenarioFilter = $state('');
  let signoffBy = $state('');
  let signoffNotes = $state('');
  let manualActualByScenario = $state<Record<string, string>>({});

  const scopedIds = $derived(new Set(data.planScenarios.map(item => item.scenarioId)));
  const availableScenarios = $derived(data.liveScenarios.filter(item => !scopedIds.has(item.id)));
  const pickerScenarios = $derived(availableScenarios.filter(s => `${s.scenarioKey} ${s.name}`.toLowerCase().includes(scenarioFilter.toLowerCase())));
  const detailScenario = $derived(data.liveScenarios.find(s => s.id === detailScenarioId) ?? null);
  const visibleDirectories = $derived(data.directories.filter(dir => !dir.parentId || parentChainOpen(dir)));
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

  function parentChainOpen(directory: TestDirectory): boolean {
    let parentId = directory.parentId;
    while (parentId) {
      if (!expandedDirectoryIds.has(parentId)) return false;
      parentId = data.directories.find(dir => dir.id === parentId)?.parentId ?? null;
    }
    return true;
  }

  function directoryDepth(directory: TestDirectory): number {
    return Math.max(0, directory.path.split('/').length - 1);
  }

  function scenariosInDirectory(directoryId: string): Scenario[] {
    return pickerScenarios.filter(scenario => scenario.nodeId === directoryId);
  }

  function resultCountForRun(runId: string): number {
    return data.results.filter(result => result.runId === runId && result.scenarioId).length;
  }

  function toggleDirectory(directoryId: string) {
    const next = new Set(expandedDirectoryIds);
    if (next.has(directoryId)) next.delete(directoryId);
    else next.add(directoryId);
    expandedDirectoryIds = next;
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

  async function addFromRun(runId: string) {
    await runAction(async () => {
      await addPlanScenariosFromRun(data.projectKey, data.planId, runId, selectedBy.trim() || undefined);
      showRunPicker = false;
    });
  }

  async function removeScenario(scenarioId: string) {
    await runAction(async () => {
      await removePlanScenario(data.projectKey, data.planId, scenarioId);
    });
  }

  async function setManualEvidence(scenarioId: string) {
    const status = manualActualByScenario[scenarioId] || 'PASSED';
    await runAction(async () => {
      const execution = await createManualExecution(data.projectKey, scenarioId, {
        status,
        executedBy: selectedBy.trim() || undefined,
        finishedAt: new Date().toISOString()
      });
      await selectPlanExecution(data.projectKey, data.planId, {
        scenarioId,
        manualExecutionId: execution.id,
        selectedBy: selectedBy.trim() || undefined
      });
    });
  }

  async function signOffPlan() {
    if (!canClose) return;
    await runAction(async () => {
      await closePlan(data.projectKey, data.planId, {
        signedOffBy: signoffBy.trim() || undefined,
        notes: signoffNotes.trim() || undefined
      });
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
        <button onclick={() => showAudit = true}>Audit Trail</button>
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
      <div class="chart-head">
        <div>
          <h2>Execution Composition</h2>
          <p>{data.metrics.selectedExecutions} executed of {data.metrics.totalScenarios} scoped scenarios.</p>
        </div>
      </div>
      <div class="chart-layout">
        <DonutChart chartData={planDonut} size={460} />
        <div class="chart-legend" aria-label="Execution composition legend">
          <span><i class="dot passed"></i>Passed <strong>{data.metrics.passed}</strong></span>
          <span><i class="dot failed"></i>Failed <strong>{data.metrics.failed}</strong></span>
          <span><i class="dot pending"></i>Not executed <strong>{Math.max(data.metrics.totalScenarios - data.metrics.selectedExecutions, 0)}</strong></span>
          <span><i class="dot other"></i>Other executed <strong>{data.metrics.blocked + data.metrics.skipped}</strong></span>
        </div>
      </div>
      <div class="chart-details">
        <span>Execution coverage <strong>{pct(data.metrics.executionCoverage)}</strong></span>
        <span>Pass rate <strong>{pct(data.metrics.passPercentage)}</strong></span>
        <span>Automation coverage <strong>{pct(data.metrics.automationCoverage)}</strong></span>
      </div>
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
        <input bind:value={signoffNotes} placeholder="Sign-off notes" disabled={busy || data.plan.status === 'CLOSED'} />
        <button class="primary-btn" onclick={signOffPlan} disabled={busy || !canClose || data.plan.status === 'CLOSED'}>Sign Off / Close Plan</button>
      </div>
    </section>

    <section class="panel">
        <div class="section-head">
          <h2>Plan Scenarios</h2>
          <div class="section-actions">
            <span>{data.planScenarios.length} selected</span>
            <button onclick={() => showScenarioPicker = true} disabled={busy || data.plan.status === 'CLOSED'}>Add Manual Scenario</button>
            <button onclick={() => showRunPicker = true} disabled={busy || data.plan.status === 'CLOSED'}>Add From Last Run</button>
          </div>
        </div>
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Scenario</th>
              <th>Priority</th>
              <th>Execution</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Run By</th>
              <th></th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#if data.planScenarios.length === 0}
              <tr><td colspan="7" class="empty-cell">No scenarios in this plan.</td></tr>
            {:else}
              {#each data.planScenarios as scenario}
                <tr>
                  <td>
                    <button class="scenario-name-btn" onclick={() => detailScenarioId = scenario.scenarioId}>
                      <strong>{scenario.scenarioKey}</strong><span>{scenario.name}</span>
                    </button>
                  </td>
                  <td>{scenario.priority ?? '-'}</td>
                  <td><Badge text={scenario.runnable ? 'AUTOMATION' : 'MANUAL'} variant={scenario.runnable ? 'info' : 'neutral'} /></td>
                  <td>PASS</td>
                  <td>
                    {#if scenario.selectedStatus}
                      <Badge text={scenario.selectedStatus} variant={statusVariant(scenario.selectedStatus)} />
                    {:else}
                      <div class="actual-control">
                        <select bind:value={manualActualByScenario[scenario.scenarioId]}>
                          <option value="PASSED">Passed</option>
                          <option value="FAILED">Failed</option>
                          <option value="BLOCKED">Blocked</option>
                          <option value="SKIPPED">Skipped</option>
                        </select>
                        <button onclick={() => setManualEvidence(scenario.scenarioId)} disabled={busy}>Save</button>
                      </div>
                    {/if}
                  </td>
                  <td>{scenario.runBy ?? scenario.selectedBy ?? '-'}</td>
                  <td><button class="ghost-btn" onclick={() => removeScenario(scenario.scenarioId)} disabled={busy}>Remove</button></td>
                </tr>
              {/each}
            {/if}
          {/snippet}
        </DataTable>
    </section>
  {/if}
</div>

<Modal open={showScenarioPicker} title="Add Manual Scenario" onclose={() => showScenarioPicker = false}>
  <div class="picker picker-split">
    <aside class="directory-picker">
      <input bind:value={scenarioFilter} placeholder="Search scenario key or name" />
      <div class="dir-list">
        {#each visibleDirectories as directory}
          <div>
            <button class="dir-row" style={`--depth:${directoryDepth(directory)}`} onclick={() => toggleDirectory(directory.id)}>
              <span>{expandedDirectoryIds.has(directory.id) ? '▾' : '▸'}</span>
              <strong>{directory.name}</strong>
              <small>{directory.scenarioCount}</small>
            </button>
            {#if expandedDirectoryIds.has(directory.id)}
              {#each scenariosInDirectory(directory.id) as scenario}
                <button class="scenario-pick" style={`--depth:${directoryDepth(directory) + 1}`} onclick={() => addScenario(scenario.id)} disabled={busy}>
                  <strong>{scenario.scenarioKey}</strong>
                  <span>{scenario.name}</span>
                </button>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    </aside>
    <div class="picker-preview">
      <h3>Available Scenarios</h3>
      <p>{pickerScenarios.length} scenarios match your filter and are not yet scoped in this plan.</p>
    </div>
  </div>
</Modal>

<Modal open={showRunPicker} title="Add From Last Run" onclose={() => showRunPicker = false}>
  <div class="picker">
    <label>
      <span>Selected by</span>
      <input bind:value={selectedBy} placeholder="qa@example.com" />
    </label>
    <div class="run-list">
      {#each data.runs as run}
        <button class="run-row" onclick={() => addFromRun(run.id)} disabled={busy || resultCountForRun(run.id) === 0}>
          <strong>{run.jobName ?? run.runnerId}</strong>
          <span>{run.status} · {formatDate(run.finishedAt ?? run.startedAt)} · {resultCountForRun(run.id)} scenarios</span>
        </button>
      {/each}
    </div>
  </div>
</Modal>

<Modal open={showAudit} title="Lifecycle Audit Trail" onclose={() => showAudit = false}>
  {#if data.plan}
    <div class="audit-steps">
      <div class="audit-step done">
        <span>1</span>
        <div><strong>Opened</strong><p>{formatDate(data.plan.openedAt ?? data.plan.createdAt)} · {data.plan.openedBy ?? 'System'}</p></div>
      </div>
      <div class="audit-step" class:done={!!data.plan.inProgressAt}>
        <span>2</span>
        <div><strong>Moved to In Progress</strong><p>{formatDate(data.plan.inProgressAt ?? null)} · {data.plan.inProgressBy ?? (data.plan.inProgressAt ? 'System' : 'Not yet')}</p></div>
      </div>
      <div class="audit-step" class:done={!!data.plan.signedOffAt}>
        <span>3</span>
        <div><strong>Signed Off</strong><p>{formatDate(data.plan.signedOffAt ?? null)} · {data.plan.signedOffBy ?? (data.plan.signedOffAt ? 'System' : 'Not yet')}</p></div>
      </div>
      {#if data.plan.signOffNotes}
        <p class="audit-notes">{data.plan.signOffNotes}</p>
      {/if}
    </div>
  {/if}
</Modal>

<Modal open={!!detailScenarioId} title={detailScenario?.name ?? 'Scenario Steps'} onclose={() => detailScenarioId = ''}>
  {#if detailScenario}
    <div class="step-list">
      {#each detailScenario.steps as step}
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
  {/if}
</Modal>

<style>
  .page { max-width: 1180px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .page-subtitle, .eyebrow { color: var(--color-text-muted); font-size: 0.85rem; margin: 6px 0 0; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .header-actions { display: flex; align-items: center; gap: 10px; }
  .metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .visual-panel { display: grid; gap: 18px; margin-bottom: 18px; }
  .chart-layout { display: grid; grid-template-columns: auto minmax(180px, 260px); align-items: center; justify-content: center; gap: 28px; }
  .chart-legend, .chart-details { display: grid; gap: 10px; }
  .chart-legend span, .chart-details span { display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 12px; color: var(--color-text-muted); font-size: 0.84rem; }
  .chart-legend strong, .chart-details strong { color: var(--color-text); }
  .chart-details { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dot { width: 10px; height: 10px; border-radius: 999px; flex: 0 0 auto; }
  .dot.passed { background: #0f766e; }
  .dot.failed { background: #dc2626; }
  .dot.pending { background: #d1d5db; }
  .dot.other { background: #f59e0b; }
  .visual-panel p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; }
  .quality-panel { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; margin-bottom: 18px; }
  h2 { font-size: 1rem; margin: 0 0 4px; }
  .quality-panel p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; }
  .gate-breakdown { display: flex; flex-wrap: wrap; gap: 8px; }
  .gate-breakdown span { border: 1px solid var(--color-border); border-radius: 6px; padding: 6px 9px; color: var(--color-text-muted); font-size: 0.8rem; }
  .gate-breakdown strong { color: var(--color-text); }
  .signoff-actions { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(180px, 0.8fr) minmax(220px, 1fr) auto; gap: 10px; align-items: center; }
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
  .scenario-name-btn { display: grid; gap: 2px; padding: 0; border: 0; background: transparent; text-align: left; color: var(--color-text); }
  .actual-control { display: grid; grid-template-columns: minmax(120px, 1fr) auto; gap: 6px; align-items: center; }
  .audit-steps, .step-list { display: grid; gap: 12px; }
  .audit-step, .step-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; align-items: start; }
  .audit-step > span, .step-row > span { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; background: var(--color-accent-subtle); color: var(--color-text-muted); font-weight: 800; }
  .audit-step.done > span, .step-row > span { background: color-mix(in srgb, var(--color-accent), transparent 82%); color: var(--color-accent); }
  .audit-step p, .step-row p, .step-row small { margin: 4px 0 0; color: var(--color-text-muted); font-size: 0.84rem; }
  .audit-notes { color: var(--color-text-muted); }
  .audit-notes { margin: 12px 0 0; font-size: 0.85rem; }
  .section-head span { color: var(--color-text-muted); font-size: 0.78rem; }
  td span { display: block; color: var(--color-text-muted); font-size: 0.78rem; margin-top: 2px; }
  .empty-cell { text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 24px !important; }
  .picker { display: grid; gap: 12px; }
  .picker-split { grid-template-columns: minmax(280px, 1.2fr) minmax(220px, 0.8fr); align-items: start; }
  .directory-picker, .picker-preview { display: grid; gap: 12px; }
  .dir-list, .run-list { display: grid; gap: 6px; max-height: 440px; overflow: auto; }
  .dir-row, .scenario-pick, .run-row { width: 100%; text-align: left; }
  .dir-row { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding-left: calc(10px + var(--depth) * 18px); }
  .dir-row small { color: var(--color-text-muted); }
  .scenario-pick { display: grid; gap: 2px; margin-left: calc(var(--depth) * 18px); }
  .scenario-pick span, .run-row span, .picker-preview p { color: var(--color-text-muted); font-size: 0.82rem; }
  .run-row { display: grid; gap: 3px; padding: 12px; }
  label { display: grid; gap: 5px; color: var(--color-text-muted); font-size: 0.75rem; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
  @media (max-width: 920px) {
    .page-header, .quality-panel { grid-template-columns: 1fr; flex-direction: column; }
    .chart-layout, .chart-details, .signoff-actions, .picker-split { grid-template-columns: 1fr; }
  }
</style>

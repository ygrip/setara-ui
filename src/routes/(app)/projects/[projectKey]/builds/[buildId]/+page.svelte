<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { verifyBuild, addBuildScenario, updateBuildScenarioResult, removeBuildScenarios, addAutomationToBuild, type ProjectBuild, type BuildScenario } from '$lib/api/builds';
  import type { AutomationRun } from '$lib/api/runs';

  let { data } = $props();

  let build = $state<ProjectBuild | null>(null);
  let scenarios = $state<BuildScenario[]>([]);
  let auditOpen = $state(false);
  let verifying = $state(false);
  let verifyError = $state('');
  let verifyGateError = $state('');

  // Add Scenario modal
  let addScenarioOpen = $state(false);
  let scenarioSearch = $state('');
  let addingScenario = $state(false);

  // Update Result modal
  let updateResultOpen = $state(false);
  let updatingScenario = $state<BuildScenario | null>(null);
  let updateStatus = $state('PASSED');
  let updateNotes = $state('');
  let updatingResult = $state(false);

  // Verify notes modal (when there are failed scenarios)
  let verifyNotesOpen = $state(false);
  let verifyNotes = $state('');

  // Bulk remove
  let selectedIds = $state<Set<string>>(new Set());

  // Add Automation Run modal
  let addRunOpen = $state(false);
  let selectedRunId = $state('');
  let addingRun = $state(false);

  $effect(() => {
    build = data.build;
    scenarios = [...data.scenarios];
  });

  const chartData = $derived({
    labels: ['Passed', 'Failed', 'Blocked', 'Skipped', 'Not executed'],
    datasets: [{
      data: [
        build?.metrics.passed ?? 0,
        build?.metrics.failed ?? 0,
        build?.metrics.blocked ?? 0,
        build?.metrics.skipped ?? 0,
        build?.metrics.notExecuted ?? 0
      ],
      backgroundColor: ['#16a34a', '#dc2626', '#d97706', '#64748b', '#cbd5e1'],
      borderWidth: 0
    }]
  });

  const filteredPool = $derived.by(() => {
    const q = scenarioSearch.toLowerCase();
    return (data.scenarios_pool ?? []).filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.scenarioKey.toLowerCase().includes(q)
    );
  });

  const allSelected = $derived(scenarios.length > 0 && selectedIds.size === scenarios.length);
  const hasFailed = $derived(scenarios.some(s => s.latestStatus === 'FAILED'));

  // Audit event label map
  const eventLabels: Record<string, string> = {
    BUILD_OPENED: 'Build Created',
    SCENARIO_ADDED: 'Scenarios Added',
    SCENARIOS_REMOVED: 'Scenarios Removed',
    EXECUTION_ADDED: 'Automation Run Linked',
    SCENARIO_RESULT_UPDATED: 'Scenario Result Updated',
    AUTOMATION_RUN_ADDED: 'Automation Run Added',
    BUILD_VERIFIED: 'Build Verified'
  };

  function formatEventLabel(eventType: string): string {
    return eventLabels[eventType] ?? eventType.replaceAll('_', ' ');
  }

  function metadataRows(eventType: string, meta: Record<string, unknown> | null): { field: string; value: string }[] {
    if (!meta) return [];
    switch (eventType) {
      case 'BUILD_OPENED':
        return [
          { field: 'Build Key', value: String(meta.buildKey ?? '') },
          ...(meta.name ? [{ field: 'Name', value: String(meta.name) }] : [])
        ];
      case 'SCENARIO_ADDED':
        return [{ field: 'Scenarios added', value: String(meta.count ?? '') }];
      case 'SCENARIOS_REMOVED':
        return [{ field: 'Scenarios removed', value: String(meta.count ?? '') }];
      case 'SCENARIO_RESULT_UPDATED':
        return [
          { field: 'Scenario', value: String(meta.scenarioKey ?? '') },
          { field: 'Status', value: `${meta.previousStatus ?? '?'} → ${meta.newStatus ?? '?'}` },
          { field: 'Source', value: String(meta.source ?? '') },
          ...(meta.notes ? [{ field: 'Notes', value: String(meta.notes) }] : [])
        ];
      case 'EXECUTION_ADDED':
      case 'AUTOMATION_RUN_ADDED':
        return [
          { field: 'Run ID', value: String(meta.runId ?? '') },
          { field: 'Merged', value: String(meta.merged ?? 0) },
          { field: 'Updated', value: String(meta.updated ?? 0) }
        ];
      case 'BUILD_VERIFIED':
        return [
          { field: 'Verified by', value: String(meta.verifiedBy ?? '') },
          ...(meta.notes ? [{ field: 'Notes', value: String(meta.notes) }] : [])
        ];
      default:
        return Object.entries(meta).map(([k, v]) => ({ field: k, value: String(v ?? '') }));
    }
  }

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'VERIFIED':
      case 'PASSED': return 'success';
      case 'FAILED': return 'danger';
      case 'IN_PROGRESS': return 'info';
      case 'INITIATED':
      case 'NOT_EXECUTED': return 'warning';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function pct(value: number | undefined): string {
    return `${Number(value || 0).toFixed(0)}%`;
  }

  function formatRunLabel(run: AutomationRun): string {
    const passed = run.passedScenarios ?? 0;
    const total = run.totalScenarios ?? 0;
    return `${run.jobName ?? run.runnerId} · ${run.branch ?? '?'} · ${passed}/${total} passed · ${formatDate(run.startedAt)}`;
  }

  const directoryGroups = $derived.by(() => {
    const groups = new Map<string, { path: string; label: string; passed: number; failed: number; blocked: number; skipped: number; notExecuted: number; total: number }>();
    for (const s of scenarios) {
      const path = s.directoryPath ?? 'Uncategorized';
      const label = s.featureName ?? s.directoryPath?.split('/').pop() ?? 'Uncategorized';
      if (!groups.has(path)) {
        groups.set(path, { path, label, passed: 0, failed: 0, blocked: 0, skipped: 0, notExecuted: 0, total: 0 });
      }
      const g = groups.get(path)!;
      g.total++;
      const st = s.latestStatus?.toUpperCase() ?? 'NOT_EXECUTED';
      if (st === 'PASSED') g.passed++;
      else if (st === 'FAILED') g.failed++;
      else if (st === 'BLOCKED') g.blocked++;
      else if (st === 'SKIPPED') g.skipped++;
      else g.notExecuted++;
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  });

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(scenarios.map(s => s.id));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function openUpdateResult(scenario: BuildScenario) {
    updatingScenario = scenario;
    updateStatus = scenario.latestStatus === 'NOT_EXECUTED' ? 'PASSED' : scenario.latestStatus;
    updateNotes = '';
    updateResultOpen = true;
  }

  async function handleAddScenario(scenarioId: string) {
    if (!build || addingScenario) return;
    addingScenario = true;
    try {
      const newRow = await addBuildScenario(data.projectKey, build.id, { scenarioId, source: 'MANUAL', addedBy: 'qa.user@setara.local' });
      scenarios = [newRow, ...scenarios];
      build = { ...build, metrics: { ...build.metrics, totalScenarios: build.metrics.totalScenarios + 1, notExecuted: build.metrics.notExecuted + 1 } };
      addScenarioOpen = false;
      scenarioSearch = '';
    } catch (e) {
      verifyError = (e as Error).message;
    } finally {
      addingScenario = false;
    }
  }

  async function handleUpdateResult() {
    if (!build || !updatingScenario || updatingResult) return;
    updatingResult = true;
    try {
      const updated = await updateBuildScenarioResult(data.projectKey, build.id, updatingScenario.id, {
        status: updateStatus,
        notes: updateNotes || undefined,
        executedBy: 'qa.user@setara.local'
      });
      scenarios = scenarios.map(s => s.id === updated.id ? updated : s);
      // Refresh build metrics from updated scenario list
      const total = scenarios.length;
      const passed = scenarios.filter(s => s.latestStatus === 'PASSED').length;
      const failed = scenarios.filter(s => s.latestStatus === 'FAILED').length;
      const blocked = scenarios.filter(s => s.latestStatus === 'BLOCKED').length;
      const skipped = scenarios.filter(s => s.latestStatus === 'SKIPPED').length;
      const notExecuted = scenarios.filter(s => s.latestStatus === 'NOT_EXECUTED').length;
      build = {
        ...build,
        metrics: {
          ...build.metrics,
          totalScenarios: total,
          passed,
          failed,
          blocked,
          skipped,
          notExecuted,
          passPercentage: total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 0,
          executionCoverage: total > 0 ? Math.round(((total - notExecuted) / total) * 100 * 100) / 100 : 0
        }
      };
      updateResultOpen = false;
    } catch (e) {
      verifyError = (e as Error).message;
    } finally {
      updatingResult = false;
    }
  }

  async function handleBulkRemove() {
    if (!build || selectedIds.size === 0) return;
    try {
      await removeBuildScenarios(data.projectKey, build.id, [...selectedIds]);
      scenarios = scenarios.filter(s => !selectedIds.has(s.id));
      selectedIds = new Set();
    } catch (e) {
      verifyError = (e as Error).message;
    }
  }

  async function handleAddRun() {
    if (!build || !selectedRunId || addingRun) return;
    addingRun = true;
    try {
      await addAutomationToBuild(data.projectKey, build.id, { runId: selectedRunId });
      // Refresh scenarios
      const { listBuildScenarios, getBuild } = await import('$lib/api/builds');
      scenarios = await listBuildScenarios(data.projectKey, build.id);
      build = await getBuild(data.projectKey, build.id);
      addRunOpen = false;
      selectedRunId = '';
    } catch (e) {
      verifyError = (e as Error).message;
    } finally {
      addingRun = false;
    }
  }

  function checkVerifyGate(): boolean {
    if (!build) return false;
    const notExecutedCount = scenarios.filter(s => s.latestStatus === 'NOT_EXECUTED').length;
    if (notExecutedCount > 0) {
      verifyGateError = `${notExecutedCount} scenario(s) still not executed. All scenarios must be executed before verifying.`;
      return false;
    }
    if ((build.metrics.passPercentage ?? 0) < 80) {
      verifyGateError = `Pass percentage (${pct(build.metrics.passPercentage)}) is below required 80%.`;
      return false;
    }
    verifyGateError = '';
    return true;
  }

  function handleVerifyClick() {
    if (!checkVerifyGate()) return;
    if (hasFailed) {
      verifyNotesOpen = true;
    } else {
      void handleVerify('');
    }
  }

  async function handleVerify(notes: string) {
    if (!build) return;
    verifying = true;
    verifyError = '';
    try {
      build = await verifyBuild(data.projectKey, build.id, { notes: notes || 'Verified from UI' });
      verifyNotesOpen = false;
      verifyNotes = '';
    } catch (error) {
      verifyError = error instanceof Error ? error.message : 'Unable to verify build';
    } finally {
      verifying = false;
    }
  }
</script>

<svelte:head>
  <title>{build?.name ?? 'Build'} - Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}/builds">Builds</a>
    <span>›</span>
    <span>{build?.buildKey ?? data.buildId}</span>
  </nav>

  {#if data.error || !build}
    <div class="error">{data.error ?? 'Build not found'}</div>
  {:else}
    <header class="page-header">
      <div>
        <h1>{build.name}</h1>
        <p>{build.projectName} · {build.buildKey}{build.version ? ` · ${build.version}` : ''}</p>
      </div>
      <div class="header-actions">
        <Badge text={build.status} variant={statusVariant(build.status)} />
        <a href="/projects/{data.projectKey}/builds/{data.buildId}/quality-map" class="secondary-btn">Quality Map</a>
        <button class="secondary-btn" onclick={() => auditOpen = true}>History</button>
        <button class="secondary-btn" onclick={() => addRunOpen = true} disabled={build.status === 'VERIFIED'}>Add Automation Run</button>
        <button class="secondary-btn" onclick={() => addScenarioOpen = true} disabled={build.status === 'VERIFIED'}>Add Scenario</button>
        <button class="primary-btn" disabled={verifying || build.status === 'VERIFIED'} onclick={handleVerifyClick}>
          {verifying ? 'Verifying…' : 'Verify Build'}
        </button>
      </div>
    </header>

    {#if verifyGateError}<div class="error">{verifyGateError}</div>{/if}
    {#if verifyError}<div class="error">{verifyError}</div>{/if}

    <section class="visual-panel">
      <div class="chart-wrap">
        <DonutChart chartData={chartData} size={460} />
      </div>
      <div class="metrics">
        <div><span>Total scenarios</span><strong>{build.metrics.totalScenarios}</strong></div>
        <div><span>Pass percentage</span><strong>{pct(build.metrics.passPercentage)}</strong></div>
        <div><span>Execution coverage</span><strong>{pct(build.metrics.executionCoverage)}</strong></div>
        <div><span>Verified at</span><strong>{formatDate(build.verifiedAt)}</strong></div>
      </div>
    </section>

    <section class="section">
      <h2>Scenario Status</h2>

      {#if selectedIds.size > 0}
        <div class="bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button class="danger-btn" onclick={handleBulkRemove}>Remove from build</button>
          <button class="secondary-btn-sm" onclick={() => selectedIds = new Set()}>Deselect all</button>
        </div>
      {/if}

      <DataTable>
        {#snippet head()}
          <tr>
            <th class="checkbox-col">
              <input type="checkbox" checked={allSelected} onchange={toggleSelectAll} />
            </th>
            <th>Scenario</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Source</th>
            <th>Executed By</th>
            <th>Executed At</th>
            <th>Action</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each scenarios as scenario (scenario.id)}
            <tr>
              <td class="checkbox-col">
                <input type="checkbox" checked={selectedIds.has(scenario.id)} onchange={() => toggleSelect(scenario.id)} />
              </td>
              <td>
                <strong>{scenario.scenarioKey}</strong>
                <div class="muted">{scenario.name}</div>
              </td>
              <td><Badge text={scenario.expectedStatus} variant="neutral" /></td>
              <td><Badge text={scenario.latestStatus} variant={statusVariant(scenario.latestStatus)} /></td>
              <td>{scenario.source}</td>
              <td>{scenario.executedBy ?? '—'}</td>
              <td>{formatDate(scenario.executedAt)}</td>
              <td>
                <button class="inline-btn" onclick={() => openUpdateResult(scenario)} disabled={build?.status === 'VERIFIED'}>
                  Update Result
                </button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    </section>

    {#if directoryGroups.length > 0 && directoryGroups.some(g => g.path !== 'Uncategorized')}
    <section class="section tree-section">
      <h2 class="section-title">Directory Breakdown</h2>
      <div class="tree-grid">
        {#each directoryGroups as group}
          <div class="tree-row">
            <div class="tree-path">
              <span class="tree-label">{group.label}</span>
              <span class="tree-sub">{group.path}</span>
            </div>
            <div class="tree-counts">
              {#if group.passed > 0}<span class="cnt cnt--pass">✓ {group.passed}</span>{/if}
              {#if group.failed > 0}<span class="cnt cnt--fail">✗ {group.failed}</span>{/if}
              {#if group.blocked > 0}<span class="cnt cnt--block">⊘ {group.blocked}</span>{/if}
              {#if group.notExecuted > 0}<span class="cnt cnt--pending">◌ {group.notExecuted}</span>{/if}
            </div>
            <div class="tree-bar-wrap">
              <div class="tree-bar">
                {#if group.passed > 0}<div class="tree-bar-seg seg--pass" style="width:{(group.passed/group.total)*100}%"></div>{/if}
                {#if group.failed > 0}<div class="tree-bar-seg seg--fail" style="width:{(group.failed/group.total)*100}%"></div>{/if}
                {#if group.blocked > 0}<div class="tree-bar-seg seg--block" style="width:{(group.blocked/group.total)*100}%"></div>{/if}
                {#if group.notExecuted + group.skipped > 0}<div class="tree-bar-seg seg--pending" style="width:{((group.notExecuted+group.skipped)/group.total)*100}%"></div>{/if}
              </div>
              <span class="tree-pct">{group.total > 0 ? Math.round((group.passed/group.total)*100) : 0}%</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
    {/if}
  {/if}
</div>

<!-- History Modal (renamed from Audit) -->
<Modal open={auditOpen} title="Build History" size="lg" onclose={() => auditOpen = false}>
  <ol class="audit-list">
    {#each data.audit as event}
      <li>
        <strong>{formatEventLabel(event.eventType)}</strong>
        <span>{formatDate(event.occurredAt)} · {event.actor ?? 'system'}</span>
        {#if event.metadata}
          {@const rows = metadataRows(event.eventType, event.metadata)}
          {#if rows.length > 0}
            <table class="diff-table">
              <thead><tr><th>Field</th><th>Change</th></tr></thead>
              <tbody>
                {#each rows as row}
                  <tr><td>{row.field}</td><td>{row.value}</td></tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {/if}
      </li>
    {/each}
  </ol>
</Modal>

<!-- Add Scenario Modal -->
<Modal open={addScenarioOpen} title="Add Scenario" size="md" onclose={() => { addScenarioOpen = false; scenarioSearch = ''; }}>
  <div class="modal-body">
    <input class="search-input" bind:value={scenarioSearch} placeholder="Search scenarios…" />
    <div class="scenario-list">
      {#each filteredPool as scenario}
        <button class="scenario-row" onclick={() => handleAddScenario(scenario.id)} disabled={addingScenario}>
          <strong>{scenario.scenarioKey}</strong>
          <span class="muted">{scenario.name}</span>
        </button>
      {/each}
      {#if filteredPool.length === 0}
        <p class="empty">No scenarios available to add.</p>
      {/if}
    </div>
  </div>
</Modal>

<!-- Update Result Modal -->
<Modal open={updateResultOpen} title="Update Result" size="sm" onclose={() => updateResultOpen = false}>
  <div class="modal-body">
    {#if updatingScenario}
      <p class="modal-scenario-name">{updatingScenario.scenarioKey} — {updatingScenario.name}</p>
      <label class="form-label">Status
        <select bind:value={updateStatus} class="form-select">
          <option value="PASSED">PASSED</option>
          <option value="FAILED">FAILED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="SKIPPED">SKIPPED</option>
          <option value="NOT_EXECUTED">NOT_EXECUTED</option>
        </select>
      </label>
      <label class="form-label">Notes (optional)
        <textarea bind:value={updateNotes} class="form-textarea" rows={3} placeholder="Add execution notes…"></textarea>
      </label>
      <div class="modal-actions">
        <button class="primary-btn" onclick={handleUpdateResult} disabled={updatingResult}>
          {updatingResult ? 'Saving…' : 'Save'}
        </button>
        <button class="secondary-btn" onclick={() => updateResultOpen = false}>Cancel</button>
      </div>
    {/if}
  </div>
</Modal>

<!-- Verify Notes Modal (required when there are failed scenarios) -->
<Modal open={verifyNotesOpen} title="Sign-Off Notes Required" size="sm" onclose={() => verifyNotesOpen = false}>
  <div class="modal-body">
    <p class="modal-warn">There are failed scenarios. Please provide sign-off notes to confirm verification intent.</p>
    <label class="form-label">Notes (required)
      <textarea bind:value={verifyNotes} class="form-textarea" rows={4} placeholder="Explain why the build is being verified despite failures…"></textarea>
    </label>
    <div class="modal-actions">
      <button class="primary-btn" onclick={() => handleVerify(verifyNotes)} disabled={verifying || !verifyNotes.trim()}>
        {verifying ? 'Verifying…' : 'Confirm Verify'}
      </button>
      <button class="secondary-btn" onclick={() => verifyNotesOpen = false}>Cancel</button>
    </div>
  </div>
</Modal>

<!-- Add Automation Run Modal -->
<Modal open={addRunOpen} title="Add Automation Run" size="md" onclose={() => { addRunOpen = false; selectedRunId = ''; }}>
  <div class="modal-body">
    <p class="modal-sub">Select an automation run to link results to this build.</p>
    <div class="run-list">
      {#each data.runs as run}
        <button
          class="run-row"
          class:run-row--selected={selectedRunId === run.id}
          onclick={() => selectedRunId = run.id}
        >
          <div class="run-row-top">
            <Badge text={run.status} variant={run.status === 'PASSED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'warning'} />
            <span class="run-job">{run.jobName ?? run.runnerId}</span>
            <span class="run-branch">{run.branch ?? '?'}</span>
          </div>
          <div class="run-row-bot">
            <span>{(run.passedScenarios ?? 0)}/{(run.totalScenarios ?? 0)} passed</span>
            <span>{formatDate(run.startedAt)}</span>
          </div>
        </button>
      {/each}
      {#if data.runs.length === 0}
        <p class="empty">No automation runs available.</p>
      {/if}
    </div>
    <div class="modal-actions">
      <button class="primary-btn" onclick={handleAddRun} disabled={!selectedRunId || addingRun}>
        {addingRun ? 'Adding…' : 'Add Run'}
      </button>
      <button class="secondary-btn" onclick={() => { addRunOpen = false; selectedRunId = ''; }}>Cancel</button>
    </div>
  </div>
</Modal>

<style>
  .page { max-width: min(1560px, 100%); }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 0 0 12px; }
  p, .muted { color: var(--color-text-muted); margin: 0; }
  .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
  .visual-panel { display: grid; grid-template-columns: minmax(360px, 520px) 1fr; gap: 28px; align-items: center; border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; }
  .chart-wrap { display: flex; justify-content: center; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
  .metrics div { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 14px; background: var(--color-bg); }
  .metrics span { display: block; color: var(--color-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; }
  .metrics strong { font-size: 1.35rem; }
  .section { margin-top: 22px; }
  .primary-btn, .secondary-btn { min-height: 38px; padding: 8px 14px; border-radius: 6px; font-weight: 800; cursor: pointer; font: inherit; font-size: 0.875rem; }
  .primary-btn { border: 1px solid var(--color-accent); background: var(--color-accent); color: white; }
  .secondary-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); text-decoration: none; display: inline-flex; align-items: center; }
  .primary-btn:disabled, .secondary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .danger-btn { min-height: 32px; padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; font: inherit; font-size: 0.82rem; border: 1px solid #dc2626; background: #dc2626; color: white; }
  .secondary-btn-sm { min-height: 32px; padding: 6px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font: inherit; font-size: 0.82rem; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
  .inline-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .inline-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .checkbox-col { width: 36px; text-align: center; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }
  .bulk-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: color-mix(in srgb, var(--color-accent), transparent 90%); border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 10px; font-size: 0.875rem; font-weight: 600; }
  /* History modal */
  .audit-list { display: grid; gap: 14px; margin: 0; padding-left: 22px; }
  .audit-list li { padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
  .audit-list span { display: block; color: var(--color-text-muted); margin: 4px 0; }
  .diff-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.82rem; }
  .diff-table th { text-align: left; padding: 4px 8px; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }
  .diff-table td { padding: 4px 8px; border: 1px solid var(--color-border); }
  /* Modal internals */
  .modal-body { display: flex; flex-direction: column; gap: 14px; }
  .modal-sub { color: var(--color-text-muted); font-size: 0.875rem; }
  .modal-warn { background: #fef3c7; border: 1px solid #d97706; border-radius: 6px; padding: 10px 12px; font-size: 0.875rem; color: #92400e; }
  .modal-scenario-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
  .search-input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .scenario-list { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
  .scenario-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); cursor: pointer; text-align: left; }
  .scenario-row:hover { border-color: var(--color-accent); }
  .scenario-row:disabled { opacity: 0.5; cursor: not-allowed; }
  .run-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
  .run-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); cursor: pointer; text-align: left; }
  .run-row--selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent), transparent 88%); }
  .run-row-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .run-row-bot { display: flex; gap: 12px; font-size: 0.78rem; color: var(--color-text-muted); }
  .run-job { font-weight: 700; font-size: 0.875rem; }
  .run-branch { font-size: 0.8rem; color: var(--color-text-muted); }
  .form-label { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; font-weight: 600; }
  .form-select, .form-textarea { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .form-textarea { resize: vertical; }
  .empty { color: var(--color-text-muted); font-size: 0.875rem; text-align: center; padding: 16px; }
  @media (max-width: 900px) {
    .page-header, .visual-panel { grid-template-columns: 1fr; flex-direction: column; }
    .header-actions { justify-content: flex-start; }
  }
  .tree-section { margin-top: 28px; }
  .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 14px; color: var(--color-text); }
  .tree-grid { display: flex; flex-direction: column; gap: 10px; }
  .tree-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: center; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 14px; }
  .tree-path { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .tree-label { font-weight: 600; font-size: 0.875rem; color: var(--color-text); }
  .tree-sub { font-size: 0.7rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); }
  .tree-counts { display: flex; gap: 6px; flex-shrink: 0; }
  .cnt { font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
  .cnt--pass { background: #dcfce7; color: #15803d; }
  .cnt--fail { background: #fee2e2; color: #dc2626; }
  .cnt--block { background: #fef3c7; color: #d97706; }
  .cnt--pending { background: var(--color-surface); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .tree-bar-wrap { display: flex; align-items: center; gap: 8px; min-width: 140px; flex-shrink: 0; }
  .tree-bar { flex: 1; height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden; display: flex; }
  .tree-bar-seg { height: 100%; }
  .seg--pass { background: #16a34a; }
  .seg--fail { background: #dc2626; }
  .seg--block { background: #d97706; }
  .seg--pending { background: #cbd5e1; }
  .tree-pct { font-size: 0.72rem; font-weight: 700; color: var(--color-text-muted); min-width: 32px; text-align: right; }
  :global([data-theme="dark"]) .cnt--pass { background: #14532d; color: #4ade80; }
  :global([data-theme="dark"]) .cnt--fail { background: #450a0a; color: #f87171; }
  :global([data-theme="dark"]) .cnt--block { background: #451a03; color: #fbbf24; }
</style>

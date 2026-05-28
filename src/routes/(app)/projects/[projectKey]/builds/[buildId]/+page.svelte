<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { verifyBuild, addBuildScenario, updateBuildScenarioResult, removeBuildScenarios, addAutomationToBuild, listBuildScenarios, listBuildAudit, listRunScenarios, type ProjectBuild, type BuildScenario, type BuildAuditEvent, type RunScenarioView } from '$lib/api/builds';
  import type { AutomationRun } from '$lib/api/runs';
  import { listDirectories, listScenarios, type TestDirectory, type Scenario } from '$lib/api/testcases';

  let { data } = $props();

  let build = $state<ProjectBuild | null>(null);
  let scenarios = $state<BuildScenario[]>([]);
  let scenarioNextCursor = $state<string | null>(null);
  let scenarioPrevCursor = $state<string | null>(null);
  let auditEvents = $state<BuildAuditEvent[]>([]);
  let auditNextCursor = $state<string | null>(null);
  let loadingMore = $state(false);

  let auditOpen = $state(false);
  let verifying = $state(false);
  let verifyError = $state('');
  let verifyGateError = $state('');

  // Unified Add Scenario dropdown
  let addScenarioMenuOpen = $state(false);
  let addMode = $state<'menu' | 'automation' | 'manual'>('menu');

  // Automation run mode
  let selectedRunId = $state('');
  let addingRun = $state(false);
  let runSearch = $state('');
  let runConfirmOpen = $state(false);
  let runToConfirm = $state<AutomationRun | null>(null);
  let runPreviewScenarios = $state<RunScenarioView[]>([]);
  let loadingRunPreview = $state(false);

  // Manual select mode
  let manualDirectories = $state<TestDirectory[]>([]);
  let manualScenarios = $state<Scenario[]>([]);
  let manualDirFilter = $state('');
  let manualScenarioFilter = $state('');
  let selectedManualIds = $state<Set<string>>(new Set());
  let selectedDirId = $state<string | null>(null);
  let manualStep = $state<'select' | 'confirm'>('select');
  let addingManual = $state(false);
  let manualConfirmOpen = $state(false);

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

  // Scenario table search & sort
  let scenarioFilter = $state('');
  let scenarioSortBy = $state<'scenarioKey' | 'executedAt'>('scenarioKey');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');

  function toggleScenarioSort(col: 'scenarioKey' | 'executedAt') {
    if (scenarioSortBy === col) scenarioSortDir = scenarioSortDir === 'asc' ? 'desc' : 'asc';
    else { scenarioSortBy = col; scenarioSortDir = 'asc'; }
  }
  function scenarioSortIcon(col: string): string {
    if (scenarioSortBy !== col) return '';
    return scenarioSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filteredScenarios = $derived.by(() => {
    let result = scenarios;
    const q = scenarioFilter.toLowerCase();
    if (q) result = result.filter(s => s.scenarioKey.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    return [...result].sort((a, b) => {
      let va = '', vb = '';
      if (scenarioSortBy === 'executedAt') { va = a.executedAt ?? ''; vb = b.executedAt ?? ''; }
      else { va = a.scenarioKey; vb = b.scenarioKey; }
      if (va < vb) return scenarioSortDir === 'asc' ? -1 : 1;
      if (va > vb) return scenarioSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  // Manual scenario selection — runs filtered
  const filteredRuns = $derived.by(() => {
    const q = runSearch.toLowerCase();
    return (data.runs ?? []).filter(r => {
      if (!q) return true;
      const label = (r.jobName ?? r.runnerId) + ' ' + (r.branch ?? '');
      return label.toLowerCase().includes(q);
    });
  });

  // Manual directory list filtered
  const filteredDirs = $derived.by(() => {
    const q = manualDirFilter.toLowerCase();
    if (!q) return manualDirectories;
    return manualDirectories.filter(d => d.name.toLowerCase().includes(q));
  });

  // Manual scenarios for selected directory
  const filteredManualScenarios = $derived.by(() => {
    const q = manualScenarioFilter.toLowerCase();
    let result = manualScenarios;
    if (q) result = result.filter(s => s.name.toLowerCase().includes(q) || s.scenarioKey.toLowerCase().includes(q));
    return result;
  });

  const manualSelectedCount = $derived(selectedManualIds.size);

  // Get selected scenario details for confirmation
  const selectedManualScenarios = $derived.by(() => {
    return manualScenarios.filter(s => selectedManualIds.has(s.id));
  });

  let copiedVersion = $state(false);
  async function copyBuildVersion(version: string) {
    try { await navigator.clipboard.writeText(version); copiedVersion = true; setTimeout(() => copiedVersion = false, 1500); } catch {}
  }

  $effect(() => {
    build = data.build;
    scenarios = data.scenariosPage?.items ?? [];
    scenarioNextCursor = data.scenariosPage?.nextCursor ?? null;
    scenarioPrevCursor = data.scenariosPage?.prevCursor ?? null;
    auditEvents = data.auditPage?.items ?? [];
    auditNextCursor = data.auditPage?.nextCursor ?? null;
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

  function closeAddMenu() {
    addScenarioMenuOpen = false;
    addMode = 'menu';
    selectedRunId = '';
    runSearch = '';
    runConfirmOpen = false;
    runToConfirm = null;
    runPreviewScenarios = [];
    loadingRunPreview = false;
    selectedManualIds = new Set();
    manualStep = 'select';
    manualDirFilter = '';
    manualScenarioFilter = '';
    manualConfirmOpen = false;
  }

  function openAutomationMode() {
    addScenarioMenuOpen = false;
    addMode = 'automation';
    selectedRunId = '';
    runSearch = '';
    runConfirmOpen = false;
    runToConfirm = null;
    runPreviewScenarios = [];
    loadingRunPreview = false;
  }

  async function openManualMode() {
    addScenarioMenuOpen = false;
    addMode = 'manual';
    selectedManualIds = new Set();
    manualStep = 'select';
    manualDirFilter = '';
    manualScenarioFilter = '';
    manualConfirmOpen = false;
    try {
      manualDirectories = await listDirectories(data.projectKey, null, 'ACTIVE');
      if (manualDirectories.length > 0) {
        selectedDirId = manualDirectories[0].id;
        manualScenarios = await listScenarios(data.projectKey, selectedDirId, 'ACTIVE');
      } else {
        selectedDirId = null;
        manualScenarios = [];
      }
    } catch (e) {
      manualDirectories = [];
      manualScenarios = [];
    }
  }

  async function selectManualDir(dirId: string) {
    selectedDirId = dirId;
    selectedManualIds = new Set();
    manualScenarioFilter = '';
    try {
      manualScenarios = await listScenarios(data.projectKey, dirId, 'ACTIVE');
    } catch {
      manualScenarios = [];
    }
  }

  function toggleManualScenario(id: string) {
    const next = new Set(selectedManualIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedManualIds = next;
  }

  function toggleAllManualScenarios() {
    const visible = filteredManualScenarios;
    const allSelected = visible.every(s => selectedManualIds.has(s.id));
    const next = new Set(selectedManualIds);
    if (allSelected) {
      visible.forEach(s => next.delete(s.id));
    } else {
      visible.forEach(s => next.add(s.id));
    }
    selectedManualIds = next;
  }

  const manualAllSelected = $derived(filteredManualScenarios.length > 0 && filteredManualScenarios.every(s => selectedManualIds.has(s.id)));

  function goToConfirmStep() {
    manualStep = 'confirm';
  }

  function goBackToSelect() {
    manualStep = 'select';
  }

  async function handleFinishManualAdd() {
    if (!build || selectedManualIds.size === 0 || addingManual) return;
    addingManual = true;
    try {
      let addedCount = 0;
      for (const sid of selectedManualIds) {
        try {
          const newRow = await addBuildScenario(data.projectKey, build.id, { scenarioId: sid, source: 'MANUAL', addedBy: 'qa.user@setara.local' });
          scenarios = [newRow, ...scenarios];
          addedCount++;
        } catch { /* skip individual failures */ }
      }
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
          passed, failed, blocked, skipped, notExecuted,
          passPercentage: total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 0,
          executionCoverage: total > 0 ? Math.round(((total - notExecuted) / total) * 100 * 100) / 100 : 0
        }
      };
      closeAddMenu();
      const page = await listBuildScenarios(data.projectKey, build.id, undefined, 20);
      scenarios = page.items;
      scenarioNextCursor = page.nextCursor;
    } catch (e) {
      verifyError = (e as Error).message;
    } finally {
      addingManual = false;
    }
  }

  async function openRunConfirm(run: AutomationRun) {
    runToConfirm = run;
    runConfirmOpen = true;
    loadingRunPreview = true;
    runPreviewScenarios = [];
    try {
      runPreviewScenarios = await listRunScenarios(data.projectKey, run.id);
    } catch {
      runPreviewScenarios = [];
    } finally {
      loadingRunPreview = false;
    }
  }

  async function confirmAddRun() {
    if (!build || !runToConfirm || addingRun) return;
    addingRun = true;
    try {
      const updated = await addAutomationToBuild(data.projectKey, build.id, { runId: runToConfirm.id });
      build = updated;
      // Reload scenarios
      const page = await listBuildScenarios(data.projectKey, build.id, undefined, 20);
      scenarios = page.items;
      scenarioNextCursor = page.nextCursor;
      closeAddMenu();
    } catch (e) {
      verifyError = (e as Error).message;
    } finally {
      addingRun = false;
    }
  }

  async function loadMoreScenarios() {
    if (!build || loadingMore || !scenarioNextCursor) return;
    loadingMore = true;
    try {
      const page = await listBuildScenarios(data.projectKey, build.id, scenarioNextCursor, 20);
      scenarios = [...scenarios, ...page.items];
      scenarioNextCursor = page.nextCursor;
    } catch { /* ignore */ }
    finally { loadingMore = false; }
  }

  async function loadMoreAudit() {
    if (!build || loadingMore || !auditNextCursor) return;
    loadingMore = true;
    try {
      const page = await listBuildAudit(data.projectKey, build.id, auditNextCursor, 20);
      auditEvents = [...auditEvents, ...page.items];
      auditNextCursor = page.nextCursor;
    } catch { /* ignore */ }
    finally { loadingMore = false; }
  }

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
        <p>{build.projectName} · {build.buildKey}{build.version ? ` · ${build.version}` : ''}
          {#if build.version}
            {@const ver = build.version}
            <button class="copy-inline-btn" onclick={() => copyBuildVersion(ver)} title="Copy version" aria-label="Copy build version">
              {copiedVersion ? '✓' : '⧉'}
            </button>
          {/if}
        </p>
      </div>
      <div class="header-actions">
        <Badge text={build.status} variant={statusVariant(build.status)} />
        <Button variant="secondary" href="/projects/{data.projectKey}/builds/{data.buildId}/quality-map"
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10"/><path d="M2 12h20"/></svg>'
        >Quality Map</Button>
        <Button variant="secondary" onclick={() => auditOpen = true}
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        >History</Button>
        <div class="add-scenario-wrap">
          <Button variant="primary" disabled={build.status === 'VERIFIED'} onclick={() => addScenarioMenuOpen = !addScenarioMenuOpen}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          >Add Scenario</Button>
          {#if addScenarioMenuOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="add-menu-backdrop" onclick={() => addScenarioMenuOpen = false}></div>
            <div class="add-menu-dropdown">
              <button class="add-menu-item" onclick={openAutomationMode}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div><strong>From Automation Run</strong><span>Link results from an existing execution run</span></div>
              </button>
              <button class="add-menu-item" onclick={openManualMode}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div><strong>Manually Select</strong><span>Browse repository and pick scenarios</span></div>
              </button>
            </div>
          {/if}
        </div>
        <Button variant="primary" disabled={verifying || build.status === 'VERIFIED'} onclick={handleVerifyClick}
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        >
          {verifying ? 'Verifying…' : 'Verify Build'}
        </Button>
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

      <div class="filters-bar" style="margin-bottom:12px;">
        <div class="search-wrap">
          <input class="search-input" type="search" placeholder="Search scenarios…" bind:value={scenarioFilter} aria-label="Search scenarios" />
        </div>
      </div>

      {#if selectedIds.size > 0}
        <div class="bulk-bar">
          <span>{selectedIds.size} selected</span>
          <Button variant="danger" size="sm" onclick={handleBulkRemove}>Remove from build</Button>
          <Button variant="secondary" size="sm" onclick={() => selectedIds = new Set()}>Deselect all</Button>
        </div>
      {/if}

      <DataTable>
        {#snippet head()}
          <tr>
            <th class="checkbox-col">
              <input type="checkbox" checked={allSelected} onchange={toggleSelectAll} />
            </th>
            <th class="th-sort" onclick={() => toggleScenarioSort('scenarioKey')}>Scenario{scenarioSortIcon('scenarioKey')}</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Source</th>
            <th>Executed By</th>
            <th class="th-sort" onclick={() => toggleScenarioSort('executedAt')}>Executed At{scenarioSortIcon('executedAt')}</th>
            <th>Action</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each filteredScenarios as scenario (scenario.id)}
            <tr>
              <td class="checkbox-col">
                <input type="checkbox" checked={selectedIds.has(scenario.id)} onchange={() => toggleSelect(scenario.id)} />
              </td>
              <td>
                <strong>{scenario.scenarioKey}</strong>
                <div class="muted">{scenario.name}</div>
                {#if scenario.directoryPath}<div class="path-hint">{scenario.directoryPath}</div>{/if}
              </td>
              <td><Badge text={scenario.expectedStatus} variant="neutral" /></td>
              <td><Badge text={scenario.latestStatus} variant={statusVariant(scenario.latestStatus)} /></td>
              <td><Badge text={scenario.source} variant={scenario.source === 'AUTOMATION' ? 'automated' : 'manual'} /></td>
              <td>{scenario.executedBy ?? '—'}</td>
              <td>{formatDate(scenario.executedAt)}</td>
              <td>
                {#if scenario.source !== 'AUTOMATION'}
                <button class="inline-btn" onclick={() => openUpdateResult(scenario)} disabled={build?.status === 'VERIFIED'}>
                  Update Result
                </button>
                {:else}
                <span class="auto-lock" title="Automation-sourced — cannot manually update">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
                {/if}
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
      {#if scenarioNextCursor}
        <div class="load-more-wrap">
          <button class="load-more-btn" onclick={loadMoreScenarios} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more scenarios'}
          </button>
        </div>
      {/if}
    </section>
  {/if}
</div>

<!-- History Modal (renamed from Audit) -->
<Modal open={auditOpen} title="Build History" size="lg" onclose={() => auditOpen = false}>
  <ol class="audit-list">
    {#each auditEvents as event}
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
  {#if auditNextCursor}
    <div class="load-more-wrap">
      <button class="load-more-btn" onclick={loadMoreAudit} disabled={loadingMore}>
        {loadingMore ? 'Loading…' : 'Load more'}
      </button>
    </div>
  {/if}
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
        <Button variant="primary" size="sm" onclick={handleUpdateResult} disabled={updatingResult}>
          {updatingResult ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" size="sm" onclick={() => updateResultOpen = false}>Cancel</Button>
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
      <Button variant="primary" size="sm" onclick={() => handleVerify(verifyNotes)} disabled={verifying || !verifyNotes.trim()}>
        {verifying ? 'Verifying…' : 'Confirm Verify'}
      </Button>
      <Button variant="secondary" size="sm" onclick={() => verifyNotesOpen = false}>Cancel</Button>
    </div>
  </div>
</Modal>

<!-- Automation Run Selection Modal -->
<Modal open={addMode === 'automation'} title="Add from Automation Run" size="md" onclose={closeAddMenu}>
  <div class="modal-body">
    <p class="modal-sub">Select an execution run to link its scenario results to this build.</p>
    <input class="search-input" bind:value={runSearch} placeholder="Search runs…" />
    <div class="run-list">
      {#each filteredRuns as run}
        <button class="run-row" onclick={() => openRunConfirm(run)}>
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
      {#if filteredRuns.length === 0}
        <p class="empty">{runSearch ? 'No runs match your search.' : 'No automation runs available.'}</p>
      {/if}
    </div>
  </div>
</Modal>

<!-- Run Confirm Dialog -->
<Modal open={runConfirmOpen} title="Confirm Automation Run" size="lg" onclose={() => runConfirmOpen = false}>
  <div class="modal-body">
    {#if runToConfirm}
      <p class="modal-sub">Link scenario results from this run to the build.</p>
      <div class="confirm-run-card">
        <div class="run-row-top">
          <Badge text={runToConfirm.status} variant={runToConfirm.status === 'PASSED' ? 'success' : runToConfirm.status === 'FAILED' ? 'danger' : 'warning'} />
          <span class="run-job">{runToConfirm.jobName ?? runToConfirm.runnerId}</span>
          <span class="run-branch">{runToConfirm.branch ?? '?'}</span>
        </div>
        <div class="run-row-bot">
          <span>{(runToConfirm.passedScenarios ?? 0)}/{(runToConfirm.totalScenarios ?? 0)} passed</span>
          <span>{formatDate(runToConfirm.startedAt)}</span>
        </div>
      </div>
      {#if loadingRunPreview}
        <p class="empty">Loading scenario preview…</p>
      {:else if runPreviewScenarios.length > 0}
        <h4 class="preview-heading">{runPreviewScenarios.length} scenarios will be linked</h4>
        <div class="confirm-table-wrap">
          <table class="confirm-table">
            <thead><tr><th>Status</th><th>Scenario</th><th>Name</th><th>Feature</th></tr></thead>
            <tbody>
              {#each runPreviewScenarios as rp}
                <tr>
                  <td><Badge text={rp.status} variant={rp.status === 'PASSED' ? 'success' : rp.status === 'FAILED' ? 'danger' : 'warning'} /></td>
                  <td><code>{rp.scenarioKey ?? '—'}</code></td>
                  <td>{rp.scenarioName}</td>
                  <td class="muted">{rp.featureName ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No scenario results in this run.</p>
      {/if}
    {/if}
    <div class="modal-actions">
      <Button variant="primary" size="sm" onclick={confirmAddRun} disabled={addingRun || loadingRunPreview}>
        {addingRun ? 'Adding…' : 'Confirm'}
      </Button>
      <Button variant="secondary" size="sm" onclick={() => runConfirmOpen = false}>Cancel</Button>
    </div>
  </div>
</Modal>

<!-- Manual Scenario Selection Modal -->
<Modal open={addMode === 'manual'} title="Select Scenarios" size="xl" onclose={closeAddMenu}>
  <div class="manual-picker" class:manual-step-confirm={manualStep === 'confirm'}>
    {#if manualStep === 'select'}
      <!-- Step 1: Browse & select -->
      <div class="picker-sidebar">
        <input class="search-input" bind:value={manualDirFilter} placeholder="Filter directories…" />
        <div class="dir-list">
          {#each filteredDirs as dir}
            <button class="dir-row" class:dir-row--active={selectedDirId === dir.id} onclick={() => selectManualDir(dir.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              <span>{dir.name}</span>
              <small>{dir.scenarioCount}</small>
            </button>
          {/each}
          {#if filteredDirs.length === 0}
            <p class="empty">No directories found.</p>
          {/if}
        </div>
      </div>
      <div class="picker-main">
        <div class="picker-toolbar">
          <input class="search-input" bind:value={manualScenarioFilter} placeholder="Search scenarios…" />
          <span class="picker-count">{manualSelectedCount} selected</span>
        </div>
        <div class="scenario-check-list">
          {#if filteredManualScenarios.length > 0}
            <label class="check-all-row">
              <input type="checkbox" checked={manualAllSelected} onchange={toggleAllManualScenarios} />
              <span>Select all</span>
            </label>
          {/if}
          {#each filteredManualScenarios as scenario}
            <label class="check-row">
              <input type="checkbox" checked={selectedManualIds.has(scenario.id)} onchange={() => toggleManualScenario(scenario.id)} />
              <div class="check-row-info">
                <strong>{scenario.scenarioKey}</strong>
                <span class="muted">{scenario.name}</span>
              </div>
            </label>
          {/each}
          {#if filteredManualScenarios.length === 0}
            <p class="empty">{manualScenarioFilter ? 'No scenarios match your search.' : 'No scenarios in this directory.'}</p>
          {/if}
        </div>
        <div class="modal-actions">
          <Button variant="secondary" size="sm" onclick={closeAddMenu}>Cancel</Button>
          <Button variant="primary" size="sm" onclick={goToConfirmStep} disabled={manualSelectedCount === 0}>
            Review ({manualSelectedCount})
          </Button>
        </div>
      </div>
    {:else}
      <!-- Step 2: Confirmation -->
      <div class="confirm-section">
        <h3>{selectedManualScenarios.length} scenarios to add</h3>
        <div class="confirm-table-wrap">
          <table class="confirm-table">
            <thead><tr><th>Key</th><th>Name</th><th>Directory</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {#each selectedManualScenarios as s}
                <tr>
                  <td><code>{s.scenarioKey}</code></td>
                  <td>{s.name}</td>
                  <td class="muted">{s.featureName ?? '—'}</td>
                  <td>{s.priority ?? '—'}</td>
                  <td><Badge text={s.status} variant={s.status === 'ACTIVE' ? 'success' : 'warning'} /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="modal-actions">
          <Button variant="secondary" size="sm" onclick={goBackToSelect}>Back</Button>
          <Button variant="primary" size="sm" onclick={handleFinishManualAdd} disabled={addingManual}>
            {addingManual ? 'Adding…' : 'Finish Adding'}
          </Button>
        </div>
      </div>
    {/if}
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
  .inline-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .inline-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .auto-lock { display: inline-flex; align-items: center; color: var(--color-text-muted); opacity: 0.45; }
  .th-sort { cursor: pointer; user-select: none; }
  .th-sort:hover { color: var(--color-accent); }
  .filters-bar { display: flex; gap: .75rem; align-items: center; }
  .search-wrap { position: relative; display: flex; align-items: center; flex: 1; max-width: 320px; }
  .copy-inline-btn { display: inline-flex; align-items: center; background: none; border: 1px solid var(--color-border); border-radius: 3px; cursor: pointer; color: var(--color-text-muted); font-size: 0.65rem; padding: 1px 4px; margin-left: 2px; vertical-align: middle; }
  @media (max-width: 900px) {
    .page-header { flex-direction: column; }
    .header-actions { justify-content: flex-start; flex-wrap: wrap; }
    .visual-panel { grid-template-columns: 1fr; gap: 16px; padding: 16px; }
    .chart-wrap { max-width: 320px; margin: 0 auto; }
    .metrics { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .metrics { grid-template-columns: 1fr; }
    .header-actions { gap: 6px; }
  }
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
  .run-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
  .run-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); cursor: pointer; text-align: left; }
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

  /* Add Scenario dropdown */
  .add-scenario-wrap { position: relative; }
  .add-menu-backdrop { position: fixed; inset: 0; z-index: 49; }
  .add-menu-dropdown { position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.18); min-width: 280px; overflow: hidden; }
  .add-menu-item { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 16px; border: none; background: none; cursor: pointer; text-align: left; color: var(--color-text); font: inherit; transition: background 0.1s; }
  .add-menu-item:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .add-menu-item + .add-menu-item { border-top: 1px solid var(--color-border); }
  .add-menu-item svg { flex-shrink: 0; margin-top: 1px; color: var(--color-accent); }
  .add-menu-item strong { display: block; font-size: 0.875rem; margin-bottom: 2px; }
  .add-menu-item span { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

  /* Confirm run card */
  .confirm-run-card { border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; background: var(--color-bg); display: flex; flex-direction: column; gap: 8px; }

  /* Manual picker layout */
  .manual-picker { display: grid; grid-template-columns: 220px 1fr; gap: 0; min-height: 420px; max-height: 65vh; }
  .manual-step-confirm { grid-template-columns: 1fr; }
  .picker-sidebar { border-right: 1px solid var(--color-border); padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
  .picker-sidebar .search-input { margin-bottom: 4px; }
  .dir-list { display: flex; flex-direction: column; gap: 2px; }
  .dir-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 6px; background: none; cursor: pointer; font: inherit; color: var(--color-text); font-size: 0.82rem; text-align: left; }
  .dir-row:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); }
  .dir-row--active { background: color-mix(in srgb, var(--color-accent), transparent 88%); font-weight: 700; }
  .dir-row small { margin-left: auto; color: var(--color-text-muted); font-size: 0.72rem; }
  .picker-main { padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
  .picker-toolbar { display: flex; gap: 10px; align-items: center; }
  .picker-toolbar .search-input { flex: 1; }
  .picker-count { font-size: 0.78rem; font-weight: 700; color: var(--color-accent); white-space: nowrap; }
  .scenario-check-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .check-all-row, .check-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; cursor: pointer; }
  .check-all-row { font-weight: 700; font-size: 0.82rem; border-bottom: 1px solid var(--color-border); margin-bottom: 4px; }
  .check-row:hover { background: color-mix(in srgb, var(--color-accent), transparent 94%); }
  .check-row-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .check-row-info strong { font-size: 0.82rem; }
  .check-row-info .muted { font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Confirm step */
  .confirm-section { padding: 4px 0; }
  .confirm-section h3 { font-size: 1rem; margin: 0 0 12px; }
  .confirm-table-wrap { max-height: 340px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 8px; }
  .confirm-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .confirm-table th { text-align: left; padding: 8px 10px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); font-weight: 700; font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); position: sticky; top: 0; z-index: 1; }
  .confirm-table td { padding: 7px 10px; border-bottom: 1px solid var(--color-border); }
  .confirm-table code { font-size: 0.75rem; background: var(--color-bg); padding: 2px 5px; border-radius: 3px; }

  /* Load more */
  .load-more-wrap { display: flex; justify-content: center; padding: 14px 0 4px; }
  .load-more-btn { padding: 7px 20px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-accent); font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
  .load-more-btn:hover { border-color: var(--color-accent); }
  .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .preview-heading { font-size: 0.875rem; font-weight: 700; margin: 8px 0 4px; }
  .path-hint { font-size: 0.68rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); margin-top: 1px; }

  /* Responsive */
  @media (max-width: 700px) {
    .add-menu-dropdown { right: auto; left: 0; min-width: 240px; }
    .manual-picker { grid-template-columns: 1fr; }
    .picker-sidebar { border-right: none; border-bottom: 1px solid var(--color-border); max-height: 180px; flex-shrink: 0; }
    .picker-main { max-height: 320px; }
    .confirm-table-wrap { max-height: 240px; }
  }
  @media (max-width: 480px) {
    .add-menu-item { padding: 12px; gap: 8px; }
    .add-menu-item svg { width: 14px; height: 14px; }
    .confirm-table { font-size: 0.72rem; }
    .confirm-table th, .confirm-table td { padding: 5px 6px; }
  }
</style>

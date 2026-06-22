<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AiReviewPanel from '$lib/components/AiReviewPanel.svelte';
  import ReportExportMenu from '$lib/components/ReportExportMenu.svelte';
  import BuildScenarioDetail from '$lib/components/BuildScenarioDetail.svelte';
  import { verifyBuild, updateBuildScenarioResult, removeBuildScenarios, listBuildScenarios, listBuildAudit, updateBuild, deleteBuild, listBuildPlans, type ProjectBuild, type BuildScenario, type BuildAuditEvent, type PlanSummary } from '$lib/api/builds';

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

  // Update Result modal
  let updateResultOpen = $state(false);
  let updatingScenario = $state<BuildScenario | null>(null);
  let updateStatus = $state('PASSED');
  let updateNotes = $state('');
  let updatingResult = $state(false);

  // Verify notes modal (when there are failed scenarios)
  let verifyNotesOpen = $state(false);
  let verifyNotes = $state('');

  // Edit build modal
  let showEditBuild = $state(false);
  let editBuildName = $state('');
  let editBuildVersion = $state('');
  let editBuildDescription = $state('');
  let editBuildRequirements = $state('');
  let editBuildBusy = $state(false);
  let editBuildError = $state('');

  // Delete build confirm
  let showDeleteBuild = $state(false);
  let deleteBuildBusy = $state(false);
  let deleteBuildError = $state('');

  // Associated plans
  let associatedPlans = $state<PlanSummary[]>([]);
  const deleteBuildBlockedPlans = $derived(associatedPlans.filter(p => p.status === 'CLOSED'));
  const deleteBuildWarnPlans = $derived(associatedPlans.filter(p => p.status !== 'CLOSED'));

  // Bulk remove
  let selectedIds = $state<Set<string>>(new Set());

  // Scenario detail sidebar
  let selectedBuildScenario = $state<BuildScenario | null>(null);

  // Scenario table search, filter & sort — all backend-backed
  let scenarioFilter = $state('');
  let scenarioStatusFilter = $state('');
  let scenarioSortBy = $state<'name' | 'addedAt'>('name');
  let scenarioSortDir = $state<'asc' | 'desc'>('asc');
  let reloadingSort = $state(false);
  let scenarioSentinel = $state<HTMLElement | null>(null);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function reloadScenarios() {
    if (!build) return;
    reloadingSort = true;
    selectedIds = new Set();
    try {
      const page = await listBuildScenarios(
        data.projectKey, build.id, undefined, 20,
        scenarioSortBy, scenarioSortDir,
        scenarioFilter.trim() || undefined,
        scenarioStatusFilter || undefined
      );
      scenarios = page.items;
      scenarioNextCursor = page.nextCursor;
    } catch { /* ignore */ }
    finally { reloadingSort = false; }
  }

  function onSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(reloadScenarios, 300);
  }

  async function toggleScenarioSort(col: 'name' | 'addedAt') {
    const nextDir: 'asc' | 'desc' = scenarioSortBy === col ? (scenarioSortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    scenarioSortBy = col;
    scenarioSortDir = nextDir;
    await reloadScenarios();
  }

  function scenarioSortIcon(col: string): string {
    if (scenarioSortBy !== col) return '';
    return scenarioSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // Infinite scroll — fires loadMoreScenarios when sentinel enters viewport
  $effect(() => {
    const el = scenarioSentinel;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMoreScenarios();
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
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
    // Load associated plans
    if (data.build) {
      listBuildPlans(data.projectKey, data.build.id).then(plans => { associatedPlans = plans; }).catch(() => {});
    }
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
  }

  async function loadMoreScenarios() {
    if (!build || loadingMore || !scenarioNextCursor) return;
    loadingMore = true;
    try {
      const page = await listBuildScenarios(
        data.projectKey, build.id, scenarioNextCursor, 20,
        scenarioSortBy, scenarioSortDir,
        scenarioFilter.trim() || undefined,
        scenarioStatusFilter || undefined
      );
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
  const reportPath = $derived(`/api/projects/${data.projectKey}/builds/${data.buildId}/report`);
  const reportFilename = $derived(`setara-build-${data.projectKey}-${data.buildId}`);
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

  function openEditBuild() {
    editBuildName = build?.name ?? '';
    editBuildVersion = build?.version ?? '';
    editBuildDescription = build?.description ?? '';
    editBuildRequirements = build?.requirements ?? '';
    editBuildError = '';
    showEditBuild = true;
  }

  async function handleEditBuild() {
    if (!build) return;
    editBuildBusy = true;
    editBuildError = '';
    try {
      build = await updateBuild(data.projectKey, build.id, {
        name: editBuildName || undefined,
        version: editBuildVersion || null,
        description: editBuildDescription || null,
        requirements: editBuildRequirements || null
      });
      showEditBuild = false;
    } catch (e) {
      editBuildError = (e as Error).message;
    } finally {
      editBuildBusy = false;
    }
  }

  async function handleDeleteBuild() {
    if (!build) return;
    deleteBuildBusy = true;
    deleteBuildError = '';
    try {
      await deleteBuild(data.projectKey, build.id);
      await goto(`/projects/${data.projectKey}/builds`);
    } catch (e) {
      deleteBuildError = (e as Error).message;
      showDeleteBuild = false;
    } finally {
      deleteBuildBusy = false;
    }
  }

  function planStatusVariant(status: string): 'success' | 'info' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'CLOSED': return 'success';
      case 'IN_PROGRESS': return 'info';
      default: return 'neutral';
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
        <ReportExportMenu reportPath={reportPath} filenameBase={reportFilename} />
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
              <a class="add-menu-item add-menu-item--ai" href="/projects/{data.projectKey}/builds/{data.buildId}/suggest">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h.01"/></svg>
                <div><strong>AI Suggest</strong><span>Let AI recommend scenarios based on build requirements</span></div>
              </a>
              <a class="add-menu-item" href="/projects/{data.projectKey}/builds/{data.buildId}/add-from-run">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div><strong>From Automation Run</strong><span>Link results from an existing execution run</span></div>
              </a>
              <a class="add-menu-item" href="/projects/{data.projectKey}/builds/{data.buildId}/add-manual">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div><strong>Manually Select</strong><span>Browse repository and pick scenarios</span></div>
              </a>
            </div>
          {/if}
        </div>
        <Button variant="primary" disabled={verifying || build.status === 'VERIFIED'} onclick={handleVerifyClick}
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        >
          {verifying ? 'Verifying…' : 'Verify Build'}
        </Button>
        <Button variant="secondary" onclick={openEditBuild}
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>'
        >Edit</Button>
        {#if build.status !== 'VERIFIED'}
          <Button variant="danger" onclick={() => { showDeleteBuild = true; deleteBuildError = ''; }}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
          >Delete</Button>
        {/if}
      </div>
    </header>

    {#if verifyGateError}<div class="error">{verifyGateError}</div>{/if}
    {#if verifyError}<div class="error">{verifyError}</div>{/if}

    {#if build.description || build.requirements}
      <section class="build-meta-section">
        {#if build.description}
          <div class="build-meta-item">
            <span class="build-meta-label">Description</span>
            <p class="build-meta-text">{build.description}</p>
          </div>
        {/if}
        {#if build.requirements}
          <div class="build-meta-item">
            <span class="build-meta-label">Build Requirements</span>
            <p class="build-meta-text requirements-text">{build.requirements}</p>
          </div>
        {/if}
      </section>
    {/if}

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

    <section class="section ai-review-section">
      <AiReviewPanel reviewUrl="/api/projects/{data.projectKey}/builds/{data.buildId}/ai-review" label="this build" />
    </section>

    {#if associatedPlans.length > 0}
      <section class="section">
        <h2>Release Plans</h2>
        <DataTable>
          {#snippet head()}
            <tr>
              <th>Plan Name</th>
              <th>Squad</th>
              <th>Release Version</th>
              <th>Status</th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each associatedPlans as plan (plan.id)}
              <tr class="clickable-row" onclick={() => goto(`/squads/${plan.squadId}/release-plans/${plan.id}`)}>
                <td data-label="Plan Name"><strong>{plan.name}</strong></td>
                <td data-label="Squad">{plan.squadName ?? '—'}</td>
                <td data-label="Release Version">{plan.releaseVersion ? `v${plan.releaseVersion}` : '—'}</td>
                <td data-label="Status"><Badge text={plan.status} variant={planStatusVariant(plan.status)} /></td>
              </tr>
            {/each}
          {/snippet}
        </DataTable>
      </section>
    {/if}

    <section class="section">
      <h2>Scenario Status</h2>

      <div class="filters-bar" style="margin-bottom:12px;">
        <div class="search-wrap">
          <input class="search-input" type="search" placeholder="Search scenarios…" bind:value={scenarioFilter} oninput={onSearchInput} aria-label="Search scenarios" />
        </div>
        <select class="status-filter" bind:value={scenarioStatusFilter} onchange={reloadScenarios} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="NOT_EXECUTED">Not Executed</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="SKIPPED">Skipped</option>
        </select>
        {#if reloadingSort}<span class="filter-loading">…</span>{/if}
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
            <th class="th-sort" onclick={() => toggleScenarioSort('name')}>Scenario{scenarioSortIcon('name')}{#if reloadingSort && scenarioSortBy === 'name'} …{/if}</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Source</th>
            <th>Executed By</th>
            <th class="th-sort" onclick={() => toggleScenarioSort('addedAt')}>Added{scenarioSortIcon('addedAt')}{#if reloadingSort && scenarioSortBy === 'addedAt'} …{/if}</th>
            <th>Action</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each scenarios as scenario (scenario.id)}
            <tr>
              <td data-label="" class="checkbox-col">
                <input type="checkbox" checked={selectedIds.has(scenario.id)} onchange={() => toggleSelect(scenario.id)} />
              </td>
              <td data-label="Scenario">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="scenario-name-link" onclick={() => selectedBuildScenario = scenario} title="View details">
                  <strong>{scenario.scenarioKey}</strong>
                  <div class="muted">{scenario.name}</div>
                  {#if scenario.directoryPath}<div class="path-hint">{scenario.directoryPath}</div>{/if}
                </div>
              </td>
              <td data-label="Expected"><Badge text={scenario.expectedStatus} variant="neutral" /></td>
              <td data-label="Actual"><Badge text={scenario.latestStatus} variant={statusVariant(scenario.latestStatus)} /></td>
              <td data-label="Source"><Badge text={scenario.source} variant={scenario.source === 'AUTOMATION' ? 'automated' : 'manual'} /></td>
              <td data-label="Executed By">{scenario.executedBy ?? '—'}</td>
              <td data-label="Added">{formatDate(scenario.executedAt)}</td>
              <td data-label="">
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
        <div bind:this={scenarioSentinel} class="scroll-sentinel" aria-hidden="true"></div>
      {/if}
      {#if loadingMore}
        <div class="loading-more">Loading…</div>
      {/if}
    </section>
  {/if}
</div>

<BuildScenarioDetail
  scenario={selectedBuildScenario}
  projectKey={data.projectKey}
  onclose={() => selectedBuildScenario = null}
  onupdateresult={(s) => openUpdateResult(s)}
/>

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

<!-- Edit build modal -->
<Modal open={showEditBuild} title="Edit Build" size="sm" onclose={() => { showEditBuild = false; }}>
  <div class="field">
    <label class="field-label" for="edit-build-name">Name</label>
    <input id="edit-build-name" class="field-input" bind:value={editBuildName} placeholder="Build name" />
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-build-version">Version</label>
    <input id="edit-build-version" class="field-input" bind:value={editBuildVersion} placeholder="e.g. 2.4.0" />
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-build-desc">Description</label>
    <textarea id="edit-build-desc" class="field-textarea" bind:value={editBuildDescription} rows={3}></textarea>
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-build-req">Requirements</label>
    <textarea id="edit-build-req" class="field-textarea" bind:value={editBuildRequirements} rows={3}></textarea>
  </div>
  {#if editBuildError}<p class="form-error">{editBuildError}</p>{/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={() => { showEditBuild = false; }}>Cancel</Button>
    <Button variant="primary" size="sm" onclick={handleEditBuild} disabled={editBuildBusy || !editBuildName.trim()}>
      {editBuildBusy ? 'Saving…' : 'Save Changes'}
    </Button>
  </div>
</Modal>

<!-- Delete build confirmation -->
<Modal open={showDeleteBuild} title="Delete Build" size="sm" onclose={() => { showDeleteBuild = false; }}>
  {#if deleteBuildBlockedPlans.length > 0}
    <p class="modal-warn modal-warn--error">
      Cannot delete <strong>{build?.name}</strong>. This build is part of
      {deleteBuildBlockedPlans.length === 1 ? 'a closed release plan' : `${deleteBuildBlockedPlans.length} closed release plans`}
      and cannot be removed:
    </p>
    <ul class="plan-warning-list">
      {#each deleteBuildBlockedPlans as p (p.id)}
        <li><strong>{p.name}</strong>{p.releaseVersion ? ` · v${p.releaseVersion}` : ''}</li>
      {/each}
    </ul>
    <p class="modal-hint">Closed plans are locked. Contact a squad lead if this build needs to be removed.</p>
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => { showDeleteBuild = false; }}>Close</Button>
    </div>
  {:else if deleteBuildWarnPlans.length > 0}
    <p class="modal-warn">
      Deleting <strong>{build?.name}</strong> will also revoke it from
      {deleteBuildWarnPlans.length === 1 ? 'this release plan' : `these ${deleteBuildWarnPlans.length} release plans`}:
    </p>
    <ul class="plan-warning-list">
      {#each deleteBuildWarnPlans as p (p.id)}
        <li>
          <span class="plan-warning-name">{p.name}</span>
          {#if p.squadName}<span class="plan-warning-meta">{p.squadName}</span>{/if}
          {#if p.releaseVersion}<span class="plan-warning-meta">v{p.releaseVersion}</span>{/if}
        </li>
      {/each}
    </ul>
    <p class="modal-hint">This cannot be undone.</p>
    {#if deleteBuildError}<p class="form-error">{deleteBuildError}</p>{/if}
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => { showDeleteBuild = false; }}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={handleDeleteBuild} disabled={deleteBuildBusy}>
        {deleteBuildBusy ? 'Deleting…' : 'Revoke & Delete'}
      </Button>
    </div>
  {:else}
    <p class="modal-warn">Delete <strong>{build?.name}</strong>? This cannot be undone.</p>
    {#if deleteBuildError}<p class="form-error">{deleteBuildError}</p>{/if}
    <div class="modal-actions">
      <Button variant="secondary" size="sm" onclick={() => { showDeleteBuild = false; }}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={handleDeleteBuild} disabled={deleteBuildBusy}>
        {deleteBuildBusy ? 'Deleting…' : 'Delete Build'}
      </Button>
    </div>
  {/if}
</Modal>

<style>
  .page { max-width: min(1560px, 100%); }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 0 0 12px; }
  p, .muted { color: var(--color-text-muted); margin: 0; }
  .scenario-name-link { cursor: pointer; }
  .scenario-name-link:hover strong { color: var(--color-accent); text-decoration: underline; }
  .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
  .build-meta-section { display: flex; flex-direction: column; gap: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; }
  .build-meta-item { display: flex; flex-direction: column; gap: 4px; }
  .build-meta-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .build-meta-text { margin: 0; font-size: 0.875rem; color: var(--color-text); line-height: 1.55; }
  .requirements-text { white-space: pre-wrap; word-break: break-word; }
  .visual-panel {
    display: grid;
    grid-template-columns: minmax(360px, 520px) minmax(0, 1fr);
    gap: 28px;
    align-items: stretch;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 24px;
  }
  .chart-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 360px;
  }
  .metrics {
    align-self: center;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: minmax(112px, 1fr);
    gap: 14px;
    min-width: 0;
  }
  .metrics div {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
    background: var(--color-bg);
    min-height: 112px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }
  .metrics span { display: block; color: var(--color-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; }
  .metrics strong { font-size: 1.35rem; }
  .section { margin-top: 22px; }
  .ai-review-section { margin: 20px 0; }
  .inline-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .inline-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .auto-lock { display: inline-flex; align-items: center; color: var(--color-text-muted); opacity: 0.45; }
  .th-sort { cursor: pointer; user-select: none; }
  .th-sort:hover { color: var(--color-accent); }
  .filters-bar { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
  .search-wrap { position: relative; display: flex; align-items: center; flex: 1; max-width: 320px; }
  .search-input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .status-filter { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; }
  .filter-loading { color: var(--color-text-muted); font-size: 0.82rem; }
  .copy-inline-btn { display: inline-flex; align-items: center; background: none; border: 1px solid var(--color-border); border-radius: 3px; cursor: pointer; color: var(--color-text-muted); font-size: 0.65rem; padding: 1px 4px; margin-left: 2px; vertical-align: middle; }
  @media (max-width: 900px) {
    .page-header { flex-direction: column; }
    .header-actions { justify-content: flex-start; flex-wrap: wrap; }
    .visual-panel { grid-template-columns: 1fr; gap: 16px; padding: 16px; }
    .chart-wrap { max-width: 320px; min-height: 280px; margin: 0 auto; }
    .metrics { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .metrics { grid-template-columns: 1fr; }
    .header-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      width: 100%;
    }
    .header-actions :global(.btn) { width: 100%; justify-content: center; }
    /* Badge spans full row */
    .header-actions :global(.badge) { grid-column: 1 / -1; }
    /* Add-scenario wrapper stretches too */
    .add-scenario-wrap { width: 100%; }
  }
  .checkbox-col { width: 36px; text-align: center; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }
  .bulk-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: color-mix(in srgb, var(--color-accent), transparent 90%); border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 10px; font-size: 0.875rem; font-weight: 600; }
  /* History modal */
  .audit-list { display: grid; gap: 14px; margin: 0; padding-left: 22px; }
  .audit-list li { padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
  .audit-list span { display: block; color: var(--color-text-muted); margin: 4px 0; }
  .diff-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.82rem; display: block; overflow-x: auto; max-width: 100%; }
  .diff-table th { text-align: left; padding: 4px 8px; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }
  .diff-table td { padding: 4px 8px; border: 1px solid var(--color-border); background: var(--color-surface); }
  /* Modal internals */
  .modal-body { display: flex; flex-direction: column; gap: 14px; }
  .modal-warn { background: #fef3c7; border: 1px solid #d97706; border-radius: 6px; padding: 10px 12px; font-size: 0.875rem; color: #92400e; }
  .modal-scenario-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 8px; }
  .form-label { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; font-weight: 600; }
  .form-select, .form-textarea { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; background: var(--color-bg); color: var(--color-text); font: inherit; }
  .form-textarea { resize: vertical; }

  /* Add Scenario dropdown */
  .add-scenario-wrap { position: relative; }
  .add-menu-backdrop { position: fixed; inset: 0; z-index: 49; }
  .add-menu-dropdown { position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.18); min-width: 280px; overflow: hidden; }
  .add-menu-item { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 16px; border: none; background: none; cursor: pointer; text-align: left; color: var(--color-text); font: inherit; transition: background 0.1s; text-decoration: none; }
  .add-menu-item:hover { background: color-mix(in srgb, var(--color-accent), transparent 92%); text-decoration: none; }
  .add-menu-item + .add-menu-item { border-top: 1px solid var(--color-border); }
  .add-menu-item svg { flex-shrink: 0; margin-top: 1px; color: var(--color-accent); }
  .add-menu-item strong { display: block; font-size: 0.875rem; margin-bottom: 2px; }
  .add-menu-item span { display: block; font-size: 0.75rem; color: var(--color-text-muted); }
  .add-menu-item--ai strong { color: var(--color-accent); }

  /* Infinite scroll */
  .scroll-sentinel { height: 1px; margin-top: 8px; }
  .loading-more { text-align: center; padding: 14px 0 4px; color: var(--color-text-muted); font-size: 0.82rem; }
  .path-hint { font-size: 0.68rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); margin-top: 1px; }

  @media (max-width: 700px) {
    .add-menu-dropdown { right: auto; left: 0; min-width: 240px; }
  }
  @media (max-width: 480px) {
    .add-menu-item { padding: 12px; gap: 8px; }
    .add-menu-item svg { width: 14px; height: 14px; }
  }

  .clickable-row { cursor: pointer; }
  .clickable-row:hover td { background: var(--color-surface-hover, var(--color-surface)); }

  /* Edit/delete modal fields */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
  .field-input, .field-textarea { font: inherit; font-size: 0.875rem; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); width: 100%; box-sizing: border-box; }
  .field-input:focus, .field-textarea:focus { outline: none; border-color: var(--color-accent); }
  .field-textarea { resize: vertical; }
  .form-error { font-size: 0.8rem; color: var(--color-danger); margin: 4px 0 0; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; }
  .modal-warn { font-size: 0.875rem; color: var(--color-text); margin: 0 0 10px; }
  .modal-warn--error { color: var(--color-danger); }
  .modal-hint { font-size: 0.8rem; color: var(--color-text-muted); margin: 8px 0 0; }
  .plan-warning-list { margin: 8px 0; padding-left: 18px; font-size: 0.875rem; display: flex; flex-direction: column; gap: 4px; }
  .plan-warning-list li { display: flex; align-items: center; gap: 8px; }
  .plan-warning-name { font-weight: 500; }
  .plan-warning-meta { font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono, monospace); }
</style>

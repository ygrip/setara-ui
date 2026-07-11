<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AiReviewPanel from '$lib/components/AiReviewPanel.svelte';
  import ReportExportMenu from '$lib/components/ReportExportMenu.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import TrackedIssuesTable from '$lib/components/issues/TrackedIssuesTable.svelte';
  import {
    addSquadPlanBuild, removeSquadPlanBuild, closeSquadPlan, updateSquadPlan, deleteSquadPlan,
    type PlanBuild, type PlanLifecycleEvent, type ReleasePlan, type SquadPlanMetrics
  } from '$lib/api/squadPlans';
  import { listBuilds, type ProjectBuild } from '$lib/api/builds';
  import { listProjects, type Project } from '$lib/api/projects';
  import { getValidSession } from '$lib/auth';

  let { data }: {
    data: {
      squadId: string;
      planId: string;
      squad: { id: string; name: string; tribeName?: string | null } | null;
      plan: ReleasePlan | null;
      builds: PlanBuild[];
      metrics: SquadPlanMetrics | null;
      lifecycle: PlanLifecycleEvent[];
      issuesEnabled: boolean;
      error: string | null;
    }
  } = $props();

  let builds = $state<PlanBuild[]>([]);
  let metrics = $state<SquadPlanMetrics | null>(null);
  let lifecycle = $state<PlanLifecycleEvent[]>([]);
  $effect(() => { builds = data.builds; metrics = data.metrics; lifecycle = data.lifecycle ?? []; });

  let busy = $state(false);
  let actionError = $state('');
  let closeNotes = $state('');

  // Build picker state
  let showBuildPicker = $state(false);
  let pickerProjects = $state<Project[]>([]);
  let pickerBuilds = $state<ProjectBuild[]>([]);
  let pickerProjectKey = $state('');
  let pickerFilter = $state('');
  let pickerProjectFilter = $state('');
  let pickerLoading = $state(false);

  // Close plan modal
  let showClose = $state(false);

  // Edit plan modal
  let showEditPlan = $state(false);
  let editPlanName = $state('');
  let editPlanVersion = $state('');
  let editPlanReleaseDate = $state('');
  let editPlanDescription = $state('');

  // Delete plan confirm
  let showDeletePlan = $state(false);

  const existingBuildIds = $derived(new Set(builds.map(b => b.buildId)));
  const reportPath = $derived(`/api/squads/${data.squadId}/plans/${data.planId}/report`);
  const reportFilename = $derived(`setara-release-plan-${data.squadId}-${data.planId}`);

  const canClose = $derived(
    data.plan?.status !== 'CLOSED' &&
    builds.length > 0 &&
    builds.every(b => b.status === 'VERIFIED')
  );

  const statusReadiness = $derived.by(() => {
    if (!metrics) return null;
    return metrics.totalBuilds > 0
      ? Math.round((metrics.verifiedBuilds / metrics.totalBuilds) * 100)
      : 0;
  });

  const trendChartData = $derived.by(() => {
    if (!builds.length) return null;
    const sorted = [...builds].sort((a, b) =>
      (a.initiatedAt ?? '').localeCompare(b.initiatedAt ?? '')
    );
    return {
      labels: sorted.map(b => b.buildName),
      datasets: [
        {
          label: 'Pass %',
          data: sorted.map(b => Math.round(b.metrics?.passPercentage ?? 0)),
          borderColor: '#00AFA5',
          backgroundColor: 'rgba(0,175,165,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#00AFA5'
        },
        {
          label: 'Coverage %',
          data: sorted.map(b => Math.round(b.metrics?.executionCoverage ?? 0)),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,0.06)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#7c3aed'
        }
      ]
    };
  });

  function buildStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'VERIFIED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'INITIATED': return 'neutral';
      default: return 'neutral';
    }
  }

  function planStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'CLOSED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'OPEN': return 'neutral';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatEventType(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function eventVariant(t: string): string {
    if (t === 'PLAN_CREATED') return 'create';
    if (t === 'BUILD_ADDED') return 'add';
    if (t === 'BUILD_REMOVED') return 'remove';
    if (t === 'STATUS_CHANGED') return 'status';
    return 'default';
  }

  async function openBuildPicker() {
    showBuildPicker = true;
    pickerProjects = [];
    pickerBuilds = [];
    pickerProjectKey = '';
    pickerFilter = '';
    pickerProjectFilter = '';
    pickerLoading = true;
    try {
      const result = await listProjects();
      pickerProjects = result.items ?? [];
    } catch {
      pickerProjects = [];
    } finally {
      pickerLoading = false;
    }
  }

  async function selectPickerProject(key: string) {
    pickerProjectKey = key;
    pickerBuilds = [];
    pickerFilter = '';
    pickerLoading = true;
    try {
      const page = await listBuilds(key);
      pickerBuilds = page.items ?? [];
    } catch {
      pickerBuilds = [];
    } finally {
      pickerLoading = false;
    }
  }

  const filteredPickerProjects = $derived(
    pickerProjectFilter.trim()
      ? pickerProjects.filter(p => `${p.name} ${p.projectKey}`.toLowerCase().includes(pickerProjectFilter.toLowerCase()))
      : pickerProjects
  );

  const filteredPickerBuilds = $derived(
    pickerBuilds.filter(b => {
      const text = `${b.buildKey} ${b.name} ${b.version ?? ''}`.toLowerCase();
      return text.includes(pickerFilter.toLowerCase()) && !existingBuildIds.has(b.id);
    })
  );

  async function addBuild(build: ProjectBuild) {
    busy = true;
    actionError = '';
    try {
      const added = await addSquadPlanBuild(data.squadId, data.planId, { buildId: build.id });
      builds = [...builds, added];
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function removeBuild(buildId: string) {
    busy = true;
    actionError = '';
    try {
      await removeSquadPlanBuild(data.squadId, data.planId, buildId);
      builds = builds.filter(b => b.buildId !== buildId);
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  function openEditPlan() {
    editPlanName = data.plan?.name ?? '';
    editPlanVersion = data.plan?.releaseVersion ?? '';
    editPlanReleaseDate = data.plan?.releaseDate ? (data.plan.releaseDate as string).slice(0, 10) : '';
    editPlanDescription = data.plan?.description ?? '';
    showEditPlan = true;
  }

  async function handleEditPlan() {
    busy = true;
    actionError = '';
    try {
      await updateSquadPlan(data.squadId, data.planId, {
        name: editPlanName || undefined,
        releaseVersion: editPlanVersion || null,
        releaseDate: editPlanReleaseDate || null,
        description: editPlanDescription || null,
        updatedBy: getValidSession()?.name ?? null
      });
      showEditPlan = false;
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function handleDeletePlan() {
    busy = true;
    actionError = '';
    try {
      await deleteSquadPlan(data.squadId, data.planId, getValidSession()?.name ?? null);
      await goto(`/squads/${data.squadId}/release-plans`);
    } catch (e) {
      actionError = (e as Error).message;
      showDeletePlan = false;
    } finally {
      busy = false;
    }
  }

  async function handleClose() {
    busy = true;
    actionError = '';
    try {
      await closeSquadPlan(data.squadId, data.planId, { notes: closeNotes || null });
      showClose = false;
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.plan?.name ?? 'Release Plan'} - {data.squad?.name ?? data.squadId} - Setara</title>
</svelte:head>

<div class="page">
  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/coverage-overview">Squads</a>
    <span class="sep">›</span>
    <a href="/squads/{data.squadId}/release-plans">{data.squad?.name ?? data.squadId}</a>
    <span class="sep">›</span>
    <span>Release Plans</span>
    <span class="sep">›</span>
    <span>{data.plan?.name ?? data.planId}</span>
  </nav>

  {#if data.error}
    <AppAlert tone="error">{data.error}</AppAlert>
  {:else if data.plan}
    <!-- Plan header -->
    <div class="plan-header">
      <div class="plan-header-left">
        <div class="plan-title-row">
          <h1 class="page-title">{data.plan.name}</h1>
          <Badge text={data.plan.status} variant={planStatusVariant(data.plan.status)} />
        </div>
        {#if data.plan.releaseVersion || data.plan.releaseDate}
          <div class="plan-meta">
            {#if data.plan.releaseVersion}<span>v{data.plan.releaseVersion}</span>{/if}
            {#if data.plan.releaseDate}<span>Release: {formatDate(data.plan.releaseDate as string)}</span>{/if}
            {#if data.squad?.tribeName}<span class="muted">{data.squad.tribeName} › {data.squad.name}</span>{/if}
          </div>
        {/if}
        {#if data.plan.description}
          <p class="plan-desc">{data.plan.description}</p>
        {/if}
      </div>
      <div class="plan-header-actions">
        <ReportExportMenu reportPath={reportPath} filenameBase={reportFilename} />
        {#if data.plan.status !== 'CLOSED'}
          <Button variant="secondary" onclick={openEditPlan} disabled={busy}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>'
          >Edit</Button>
        {/if}
        {#if data.plan.status === 'OPEN'}
          <Button variant="danger" onclick={() => { showDeletePlan = true; }} disabled={busy}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
          >Delete</Button>
        {/if}
        <Button variant="secondary" href="/squads/{data.squadId}/release-plans/{data.planId}/quality-map"
          icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10"/><path d="M2 12h20"/></svg>'
        >
          Quality Map
        </Button>
        {#if data.plan.status !== 'CLOSED'}
          <Button variant="primary" onclick={openBuildPicker} disabled={busy}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          >
            Add Build
          </Button>
          <Button
            variant="danger"
            onclick={() => { showClose = true; closeNotes = ''; }}
            disabled={!canClose || busy}
            icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>'
          >
            Close Plan
          </Button>
        {/if}
      </div>
    </div>

    {#if actionError}
      <AppAlert tone="error">{actionError}</AppAlert>
    {/if}

    <!-- Metrics row -->
    {#if metrics}
      <div class="metrics-row">
        <MetricCard
          label="Total Builds"
          value={String(metrics.totalBuilds)}
          sub={`${metrics.verifiedBuilds} verified`}
        />
        <MetricCard
          label="Verified"
          value={String(metrics.verifiedBuilds)}
          sub={metrics.totalBuilds > 0 ? `${Math.round(metrics.verifiedBuilds / metrics.totalBuilds * 100)}% readiness` : '-'}
          variant={metrics.totalBuilds > 0 && metrics.verifiedBuilds === metrics.totalBuilds ? 'success' : 'default'}
        />
        <MetricCard
          label="Projects"
          value={String(metrics.totalProjects)}
          sub="involved"
        />
        {#if metrics.totalScenarios > 0}
          <MetricCard
            label="Pass Rate"
            value={`${Math.round(metrics.scenarioPassRate)}%`}
            sub={`${metrics.passed}/${metrics.totalScenarios} scenarios`}
            variant={metrics.scenarioPassRate >= 90 ? 'success' : metrics.scenarioPassRate >= 70 ? 'warning' : 'danger'}
          />
        {/if}
      </div>
    {/if}

    {#if trendChartData && builds.length > 1}
      <section class="chart-section">
        <h2 class="chart-title">Build Trend</h2>
        <div class="chart-wrap">
          <LineChart chartData={trendChartData} height={180} />
        </div>
      </section>
    {/if}

    <section class="ai-review-section">
      <AiReviewPanel reviewUrl="/api/squads/{data.squadId}/plans/{data.planId}/ai-review" label="this release plan" />
    </section>

    <!-- Builds table -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">
          Builds
          <span class="section-count">{builds.length}</span>
        </h2>
      </div>

      {#if builds.length === 0}
        <EmptyState
          title="No builds added yet"
          hint="Add project builds from any squad to coordinate this release."
          minHeight="240px"
        >
          <svelte:fragment slot="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </svelte:fragment>
        </EmptyState>
      {:else}
        <div class="table-wrap">
          <DataTable>
            {#snippet head()}
              <tr>
                <th>Status</th>
                <th>Build</th>
                <th>Project</th>
                <th>Squad</th>
                <th>Created</th>
                <th>Verified</th>
                <th>Pass / Fail / Pending</th>
                <th>Added</th>
                <th></th>
              </tr>
            {/snippet}
            {#snippet body()}
              {#each builds as build (build.id)}
                <tr>
                  <td><Badge text={build.status} variant={buildStatusVariant(build.status)} /></td>
                  <td>
                    <div class="build-name-cell">
                      <a href="/projects/{build.projectKey}/builds/{build.buildId}" class="link">{build.buildName}</a>
                      <span class="build-key muted">{build.buildKey}</span>
                    </div>
                  </td>
                  <td>
                    <a href="/projects/{build.projectKey}" class="link-subtle">{build.projectName}</a>
                  </td>
                  <td class="muted">{build.squadName ?? '-'}</td>
                  <td class="nowrap muted">{formatDate(build.initiatedAt)}</td>
                  <td class="nowrap muted">{formatDate(build.verifiedAt)}</td>
                  <td class="results-cell">
                    {#if build.metrics.totalScenarios > 0}
                      <span class="res-pass" title="Passed">{build.metrics.passed}</span>
                      <span class="res-sep">/</span>
                      <span class="res-fail" title="Failed">{build.metrics.failed}</span>
                      <span class="res-sep">/</span>
                      <span class="res-pending" title="Not executed">{build.metrics.notExecuted}</span>
                      <span class="res-total muted">of {build.metrics.totalScenarios}</span>
                    {:else}
                      <span class="muted">-</span>
                    {/if}
                  </td>
                  <td class="nowrap muted">{formatDateTime(build.addedAt)}</td>
                  <td>
                    {#if data.plan?.status !== 'CLOSED'}
                      <button
                        class="remove-btn"
                        onclick={() => removeBuild(build.buildId)}
                        disabled={busy}
                        aria-label="Remove {build.buildName} from plan"
                      >✕</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            {/snippet}
          </DataTable>
        </div>
      {/if}
    </section>

    {#if data.issuesEnabled}
      <section class="section">
        <TrackedIssuesTable context="plan" squadId={data.squadId} planId={data.planId} enabled={data.issuesEnabled} />
      </section>
    {/if}

    <!-- Lifecycle -->
    <section class="section section--audit">
      <h2 class="section-title">Lifecycle</h2>
      {#if lifecycle.length === 0}
        <p class="empty-text">No lifecycle events recorded.</p>
      {:else}
        <div class="lc-timeline">
          {#each lifecycle as event}
            <div class="lc-row">
              <span class="lc-dot lc-dot--{eventVariant(event.eventType)}"></span>
              <div class="lc-body">
                <span class="lc-type">{formatEventType(event.eventType)}</span>
                {#if event.description}<span class="lc-desc">{event.description}</span>{/if}
              </div>
              <div class="lc-meta">
                {#if event.actor}<span class="lc-actor">{event.actor}</span>{/if}
                <span class="lc-date">{formatDateTime(event.occurredAt)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<!-- Build picker modal -->
<Modal open={showBuildPicker} title="Add Build to Plan" size="lg" onclose={() => { showBuildPicker = false; }}>
  <div class="picker-layout">
    <!-- Project list -->
    <div class="picker-col picker-col--projects">
      <h3 class="picker-col-title">Projects</h3>
      <div class="picker-search">
        <input
          class="field-input"
          type="search"
          placeholder="Filter projects…"
          bind:value={pickerProjectFilter}
          aria-label="Filter projects"
        />
      </div>
      {#if pickerLoading && pickerProjects.length === 0}
        <p class="picker-loading">Loading…</p>
      {:else if filteredPickerProjects.length === 0}
        <p class="picker-empty">{pickerProjects.length === 0 ? 'No projects found.' : 'No projects match filter.'}</p>
      {:else}
        <ul class="picker-list">
          {#each filteredPickerProjects as project (project.id)}
            <li>
              <button
                class="picker-item"
                class:picker-item--active={pickerProjectKey === project.projectKey}
                onclick={() => selectPickerProject(project.projectKey)}
              >
                <span class="picker-item-name">{project.name}</span>
                <span class="picker-item-meta">{project.projectKey}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Build list -->
    <div class="picker-col picker-col--builds">
      <div class="picker-search">
        <input
          class="field-input"
          type="search"
          placeholder="Search builds…"
          bind:value={pickerFilter}
          aria-label="Filter builds"
        />
      </div>
      {#if !pickerProjectKey}
        <p class="picker-empty">Select a project to browse builds.</p>
      {:else if pickerLoading}
        <p class="picker-loading">Loading builds…</p>
      {:else if filteredPickerBuilds.length === 0}
        <p class="picker-empty">No available builds for this project.</p>
      {:else}
        <ul class="picker-list">
          {#each filteredPickerBuilds as build (build.id)}
            <li>
              <button
                class="picker-build-item"
                onclick={() => { addBuild(build); showBuildPicker = false; }}
                disabled={busy}
              >
                <div class="pb-main">
                  <span class="pb-name">{build.name}</span>
                  <Badge text={build.status} variant={buildStatusVariant(build.status)} />
                </div>
                <span class="pb-key muted">{build.buildKey}{build.version ? ` · v${build.version}` : ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  {#if actionError}<p class="form-error">{actionError}</p>{/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={() => { showBuildPicker = false; }}>Close</Button>
  </div>
</Modal>

<!-- Edit plan modal -->
<Modal open={showEditPlan} title="Edit Release Plan" size="sm" onclose={() => { showEditPlan = false; }}>
  <div class="field">
    <label class="field-label" for="edit-plan-name">Name</label>
    <input id="edit-plan-name" class="field-input" bind:value={editPlanName} placeholder="Plan name" />
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-plan-version">Release Version</label>
    <input id="edit-plan-version" class="field-input" bind:value={editPlanVersion} placeholder="e.g. 2.4.0" />
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-plan-date">Release Date</label>
    <input id="edit-plan-date" class="field-input" type="date" bind:value={editPlanReleaseDate} />
  </div>
  <div class="field" style="margin-top:12px">
    <label class="field-label" for="edit-plan-desc">Description</label>
    <textarea id="edit-plan-desc" class="field-textarea" bind:value={editPlanDescription} rows={3}></textarea>
  </div>
  {#if actionError}<p class="form-error">{actionError}</p>{/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={() => { showEditPlan = false; }}>Cancel</Button>
    <Button variant="primary" size="sm" onclick={handleEditPlan} disabled={busy || !editPlanName.trim()}>
      {busy ? 'Saving…' : 'Save Changes'}
    </Button>
  </div>
</Modal>

<!-- Delete plan confirmation -->
<Modal open={showDeletePlan} title="Delete Release Plan" size="sm" onclose={() => { showDeletePlan = false; }}>
  <p class="close-confirm">
    Delete <strong>{data.plan?.name}</strong>? This cannot be undone. Only plans with no active builds can be deleted.
  </p>
  {#if actionError}<p class="form-error">{actionError}</p>{/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={() => { showDeletePlan = false; }}>Cancel</Button>
    <Button variant="danger" size="sm" onclick={handleDeletePlan} disabled={busy}>
      {busy ? 'Deleting…' : 'Delete Plan'}
    </Button>
  </div>
</Modal>

<!-- Close plan modal -->
<Modal open={showClose} title="Close Release Plan" size="sm" onclose={() => { showClose = false; }}>
  <p class="close-confirm">
    Closing this plan marks it as delivered. All {builds.length} build{builds.length !== 1 ? 's' : ''} are verified.
    This action cannot be undone.
  </p>
  <div class="field">
    <label class="field-label" for="close-notes">Sign-off Notes (optional)</label>
    <textarea id="close-notes" class="field-textarea" bind:value={closeNotes} placeholder="All builds verified and release approved." rows={3}></textarea>
  </div>
  {#if actionError}<p class="form-error">{actionError}</p>{/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={() => { showClose = false; }}>Cancel</Button>
    <Button variant="danger" size="sm" onclick={handleClose} disabled={busy}>
      {busy ? 'Closing…' : 'Close Plan'}
    </Button>
  </div>
</Modal>

<style>
  .page { max-width: min(100%); display: flex; flex-direction: column; gap: 0; min-height: calc(100vh - 80px); }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-title { font-size: clamp(1.25rem, 4vw, 1.5rem); font-weight: 700; margin: 0; }
  .plan-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .plan-header-left { display: flex; flex-direction: column; gap: 6px; }
  .plan-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .plan-meta { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; color: var(--color-text-muted); flex-wrap: wrap; }
  .plan-meta span:not(.muted)::before { content: ''; }
  .plan-desc { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; max-width: 640px; }
  .plan-header-actions { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
  :global(.page > .app-alert) { margin-bottom: 20px; }
  .metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .section { margin-bottom: 28px; }
  .section--audit { margin-bottom: 0; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .section-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; display: flex; align-items: center; gap: 8px; }
  .section-count { font-size: 0.75rem; background: var(--color-border); border-radius: 999px; padding: 1px 7px; color: var(--color-text-muted); }
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: var(--radius); }
  .build-name-cell { display: flex; flex-direction: column; gap: 2px; }
  .build-key { font-family: var(--font-mono); font-size: 0.72rem; }
  .muted { color: var(--color-text-muted); font-size: 0.875rem; }
  .nowrap { white-space: nowrap; }
  .link { color: var(--color-accent); font-size: 0.875rem; font-weight: 500; }
  .link-subtle { color: var(--color-text); font-size: 0.875rem; }
  .link-subtle:hover { color: var(--color-accent); }
  .remove-btn { font: inherit; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer; }
  .remove-btn:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); }
  .remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .results-cell { white-space: nowrap; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .res-pass { color: #15803d; font-weight: 600; }
  .res-fail { color: var(--color-danger); font-weight: 600; }
  .res-pending { color: var(--color-text-muted); }
  .res-sep { color: var(--color-text-muted); margin: 0 2px; }
  .res-total { font-size: 0.72rem; margin-left: 4px; }
  /* Lifecycle timeline */
  .lc-timeline { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
  .lc-row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
  .lc-row:last-child { border-bottom: none; }
  .lc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .lc-dot--create { background: #6366f1; }
  .lc-dot--add { background: #16a34a; }
  .lc-dot--remove { background: var(--color-danger, #dc2626); }
  .lc-dot--status { background: #f59e0b; }
  .lc-dot--default { background: var(--color-text-muted); }
  .lc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lc-type { font-size: 0.8rem; font-weight: 700; color: var(--color-text); text-transform: capitalize; }
  .lc-desc { font-size: 0.78rem; color: var(--color-text-muted); }
  .lc-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .lc-actor { font-size: 0.72rem; color: var(--color-text-muted); font-family: var(--font-mono); }
  .lc-date { font-size: 0.72rem; color: var(--color-text-muted); white-space: nowrap; }
  .empty-text { font-size: 0.85rem; color: var(--color-text-muted); margin: 0; }
  /* Build picker */
  .picker-layout { display: grid; grid-template-columns: 200px 1fr; gap: 16px; min-height: 320px; }
  .picker-col-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin: 0 0 8px; }
  .picker-col--projects { border-right: 1px solid var(--color-border); padding-right: 16px; overflow-y: auto; max-height: 400px; }
  .picker-col--builds { overflow-y: auto; max-height: 400px; }
  .picker-search { margin-bottom: 10px; }
  .picker-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .picker-item { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--color-text); font: inherit; }
  .picker-item:hover, .picker-item--active { background: color-mix(in srgb, var(--color-accent), transparent 92%); border-color: color-mix(in srgb, var(--color-accent), transparent 70%); }
  .picker-item-name { font-size: 0.8rem; font-weight: 500; }
  .picker-item-meta { font-size: 0.7rem; color: var(--color-text-muted); font-family: var(--font-mono); }
  .picker-build-item { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); cursor: pointer; font: inherit; }
  .picker-build-item:hover:not(:disabled) { border-color: var(--color-accent); }
  .picker-build-item:disabled { opacity: 0.5; cursor: not-allowed; }
  .pb-main { display: flex; align-items: center; gap: 8px; }
  .pb-name { font-size: 0.875rem; font-weight: 500; color: var(--color-text); flex: 1; }
  .pb-key { font-size: 0.72rem; font-family: var(--font-mono); }
  .picker-loading, .picker-empty { font-size: 0.8rem; color: var(--color-text-muted); padding: 12px 0; }
  /* Close modal */
  .close-confirm { font-size: 0.875rem; color: var(--color-text); margin: 0 0 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
  .field-input, .field-textarea { font: inherit; font-size: 0.875rem; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); width: 100%; box-sizing: border-box; }
  .field-input:focus, .field-textarea:focus { outline: none; border-color: var(--color-accent); }
  .field-textarea { resize: vertical; }
  .form-error { font-size: 0.8rem; color: var(--color-danger); margin: 4px 0 0; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; }

  @media (max-width: 800px) {
    .metrics-row { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .picker-layout { grid-template-columns: 1fr; }
    .picker-col--projects { border-right: none; border-bottom: 1px solid var(--color-border); padding-right: 0; padding-bottom: 12px; }
    .plan-header { flex-direction: column; }
    .plan-header-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      width: 100%;
      gap: 8px;
    }
    .plan-header-actions :global(.btn) { width: 100%; justify-content: center; }
  }
  @media (max-width: 480px) {
    .metrics-row { grid-template-columns: 1fr; }
  }
  .chart-section { margin: 20px 0; }
  .chart-title { font-size: 0.875rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 12px; }
  .chart-wrap { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px; }
  .ai-review-section { margin: 20px 0; }
</style>

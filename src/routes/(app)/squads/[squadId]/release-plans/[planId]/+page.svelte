<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {
    addSquadPlanBuild, removeSquadPlanBuild, closeSquadPlan,
    type PlanBuild, type ReleasePlan, type SquadPlanMetrics
  } from '$lib/api/squadPlans';
  import { listBuilds, type ProjectBuild } from '$lib/api/builds';
  import { listProjects, type Project } from '$lib/api/projects';

  let { data }: {
    data: {
      squadId: string;
      planId: string;
      squad: { id: string; name: string; tribeName?: string | null } | null;
      plan: ReleasePlan | null;
      builds: PlanBuild[];
      metrics: SquadPlanMetrics | null;
      error: string | null;
    }
  } = $props();

  let builds = $state<PlanBuild[]>(data.builds);
  let metrics = $state<SquadPlanMetrics | null>(data.metrics);

  let busy = $state(false);
  let actionError = $state('');
  let closeNotes = $state('');

  // Build picker state
  let showBuildPicker = $state(false);
  let pickerProjects = $state<Project[]>([]);
  let pickerBuilds = $state<ProjectBuild[]>([]);
  let pickerProjectKey = $state('');
  let pickerFilter = $state('');
  let pickerLoading = $state(false);

  // Close plan modal
  let showClose = $state(false);

  const existingBuildIds = $derived(new Set(builds.map(b => b.buildId)));

  const canClose = $derived(
    data.plan?.status !== 'CLOSED' &&
    builds.length > 0 &&
    builds.every(b => b.status === 'VERIFIED')
  );

  const statusReadiness = $derived(() => {
    if (!metrics) return null;
    const pct = metrics.totalBuilds > 0
      ? Math.round((metrics.verifiedBuilds / metrics.totalBuilds) * 100)
      : 0;
    return pct;
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
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function openBuildPicker() {
    showBuildPicker = true;
    pickerProjects = [];
    pickerBuilds = [];
    pickerProjectKey = '';
    pickerFilter = '';
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
    pickerLoading = true;
    try {
      pickerBuilds = await listBuilds(key);
    } catch {
      pickerBuilds = [];
    } finally {
      pickerLoading = false;
    }
  }

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
  <title>{data.plan?.name ?? 'Release Plan'} — {data.squad?.name ?? data.squadId} — Setara</title>
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
    <div class="error-banner" role="alert">{data.error}</div>
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
        {#if data.plan.status !== 'CLOSED'}
          <button class="btn btn--primary" onclick={openBuildPicker} disabled={busy}>
            + Add Build
          </button>
          <button
            class="btn btn--danger"
            onclick={() => { showClose = true; closeNotes = ''; }}
            disabled={!canClose || busy}
            title={!canClose ? 'All builds must be VERIFIED before closing' : 'Close this plan'}
          >
            Close Plan
          </button>
        {/if}
      </div>
    </div>

    {#if actionError}
      <div class="error-banner" role="alert">{actionError}</div>
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
          sub={metrics.totalBuilds > 0 ? `${Math.round(metrics.verifiedBuilds / metrics.totalBuilds * 100)}% readiness` : '—'}
          variant={metrics.totalBuilds > 0 && metrics.verifiedBuilds === metrics.totalBuilds ? 'success' : 'default'}
        />
        <MetricCard
          label="In Progress"
          value={String(metrics.inProgressBuilds)}
          sub={`${metrics.initiatedBuilds} initiated`}
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
            sub={`${metrics.passedScenarios}/${metrics.totalScenarios} scenarios`}
            variant={metrics.scenarioPassRate >= 90 ? 'success' : metrics.scenarioPassRate >= 70 ? 'warning' : 'danger'}
          />
        {/if}
      </div>
    {/if}

    <!-- Builds table -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">
          Builds
          <span class="section-count">{builds.length}</span>
        </h2>
      </div>

      {#if builds.length === 0}
        <div class="empty-state">
          <p class="empty-title">No builds added yet</p>
          <p class="empty-sub">Add project builds from any squad to coordinate this release.</p>
        </div>
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
                  <td class="muted">{build.squadName ?? '—'}</td>
                  <td class="nowrap muted">{formatDate(build.createdAt)}</td>
                  <td class="nowrap muted">{formatDate(build.verifiedAt)}</td>
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

    <!-- Lifecycle info -->
    <section class="section section--audit">
      <h2 class="section-title">Lifecycle</h2>
      <div class="lifecycle-grid">
        <div class="lc-item">
          <span class="lc-label">Opened</span>
          <span class="lc-value">{formatDateTime(data.plan.openedAt)}</span>
          {#if data.plan.openedBy}<span class="lc-actor">{data.plan.openedBy}</span>{/if}
        </div>
        {#if data.plan.inProgressAt}
          <div class="lc-item">
            <span class="lc-label">In Progress</span>
            <span class="lc-value">{formatDateTime(data.plan.inProgressAt)}</span>
            {#if data.plan.inProgressBy}<span class="lc-actor">{data.plan.inProgressBy}</span>{/if}
          </div>
        {/if}
        {#if data.plan.status === 'CLOSED' && data.plan.signedOffAt}
          <div class="lc-item">
            <span class="lc-label">Closed</span>
            <span class="lc-value">{formatDateTime(data.plan.signedOffAt)}</span>
            {#if data.plan.signedOffBy}<span class="lc-actor">{data.plan.signedOffBy}</span>{/if}
          </div>
        {/if}
        {#if data.plan.signOffNotes}
          <div class="lc-item lc-item--full">
            <span class="lc-label">Notes</span>
            <span class="lc-value">{data.plan.signOffNotes}</span>
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

<!-- Build picker modal -->
<Modal open={showBuildPicker} title="Add Build to Plan" size="lg" onclose={() => { showBuildPicker = false; }}>
  <div class="picker-layout">
    <!-- Project list -->
    <div class="picker-col picker-col--projects">
      <h3 class="picker-col-title">Projects</h3>
      {#if pickerLoading && pickerProjects.length === 0}
        <p class="picker-loading">Loading…</p>
      {:else if pickerProjects.length === 0}
        <p class="picker-empty">No projects found.</p>
      {:else}
        <ul class="picker-list">
          {#each pickerProjects as project (project.id)}
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
    <button class="btn btn--secondary" onclick={() => { showBuildPicker = false; }}>Close</button>
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
    <button class="btn btn--secondary" onclick={() => { showClose = false; }}>Cancel</button>
    <button class="btn btn--danger" onclick={handleClose} disabled={busy}>
      {busy ? 'Closing…' : 'Close Plan'}
    </button>
  </div>
</Modal>

<style>
  .page { max-width: min(1400px, 100%); display: flex; flex-direction: column; gap: 0; }
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
  .btn { font: inherit; font-size: 0.875rem; padding: 8px 16px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
  .btn--primary { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  .btn--primary:hover:not(:disabled) { opacity: 0.88; }
  .btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn--secondary { background: transparent; color: var(--color-text); border-color: var(--color-border); }
  .btn--secondary:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .btn--danger { background: transparent; color: var(--color-danger); border-color: var(--color-danger); }
  .btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger), transparent 90%); }
  .btn--danger:disabled { opacity: 0.4; cursor: not-allowed; }
  .error-banner { background: color-mix(in srgb, var(--color-danger), transparent 90%); color: var(--color-danger); border: 1px solid color-mix(in srgb, var(--color-danger), transparent 70%); border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 20px; }
  .metrics-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
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
  .empty-state { text-align: center; padding: 48px 24px; color: var(--color-text-muted); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .empty-title { font-size: 0.925rem; margin: 0 0 8px; color: var(--color-text); }
  .empty-sub { font-size: 0.8rem; opacity: 0.7; margin: 0; }
  /* Lifecycle */
  .lifecycle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .lc-item { display: flex; flex-direction: column; gap: 3px; }
  .lc-item--full { grid-column: 1 / -1; }
  .lc-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .lc-value { font-size: 0.875rem; color: var(--color-text); }
  .lc-actor { font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono); }
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

  @media (max-width: 640px) {
    .picker-layout { grid-template-columns: 1fr; }
    .picker-col--projects { border-right: none; border-bottom: 1px solid var(--color-border); padding-right: 0; padding-bottom: 12px; }
  }
</style>

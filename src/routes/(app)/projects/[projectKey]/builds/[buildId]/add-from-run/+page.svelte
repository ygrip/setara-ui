<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { listRunScenarios, addBuildScenario, updateBuildScenarioResult, type RunScenarioView } from '$lib/api/builds';
  import type { AutomationRun } from '$lib/api/runs';

  let { data } = $props();

  // Step 1: pick a run. Step 2: review scenarios.
  let step = $state<'pick' | 'review'>('pick');
  let runSearch = $state('');
  let selectedRun = $state<AutomationRun | null>(null);
  let runScenarios = $state<RunScenarioView[]>([]);
  let loadingScenarios = $state(false);
  let scenariosError = $state('');

  // Set of selected run scenario IDs (pre-selected = all)
  let selectedRunScenarioIds = $state<Set<string>>(new Set());

  let adding = $state(false);
  let addError = $state('');
  let addProgress = $state('');

  const filteredRuns = $derived.by(() => {
    const q = runSearch.toLowerCase();
    if (!q) return data.runs;
    return data.runs.filter((r: AutomationRun) => {
      const label = (r.jobName ?? r.runnerId) + ' ' + (r.branch ?? '');
      return label.toLowerCase().includes(q);
    });
  });

  async function selectRun(run: AutomationRun) {
    selectedRun = run;
    step = 'review';
    loadingScenarios = true;
    scenariosError = '';
    runScenarios = [];
    selectedRunScenarioIds = new Set();
    try {
      runScenarios = await listRunScenarios(data.projectKey, run.id);
      selectedRunScenarioIds = new Set(runScenarios.map(s => s.id));
    } catch (e) {
      scenariosError = (e as Error).message;
    } finally {
      loadingScenarios = false;
    }
  }

  function toggleScenario(id: string) {
    const next = new Set(selectedRunScenarioIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedRunScenarioIds = next;
  }

  const allScenariosSelected = $derived(
    runScenarios.length > 0 && runScenarios.every(s => selectedRunScenarioIds.has(s.id))
  );

  function toggleAll() {
    if (allScenariosSelected) {
      selectedRunScenarioIds = new Set();
    } else {
      selectedRunScenarioIds = new Set(runScenarios.map(s => s.id));
    }
  }

  async function handleAdd() {
    if (!selectedRun || adding) return;
    adding = true;
    addError = '';
    const selected = runScenarios.filter(s => selectedRunScenarioIds.has(s.id));
    const total = selected.length;
    let done = 0;
    try {
      for (const rs of selected) {
        if (!rs.scenarioId) { done++; continue; }
        addProgress = `Adding ${done + 1}/${total}…`;
        try {
          const added = await addBuildScenario(data.projectKey, data.buildId, {
            scenarioId: rs.scenarioId,
            source: 'AUTOMATION',
            addedBy: 'qa.user'
          });
          // Update status to match run result
          try {
            await updateBuildScenarioResult(data.projectKey, data.buildId, added.id, {
              status: rs.status,
              executedBy: 'qa.user'
            });
          } catch { /* best-effort */ }
        } catch { /* skip individual failures */ }
        done++;
      }
      addProgress = '';
      await goto(`/projects/${data.projectKey}/builds/${data.buildId}`, { replaceState: true });
    } catch (e) {
      addError = (e as Error).message;
    } finally {
      adding = false;
      addProgress = '';
    }
  }

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'PASSED': return 'success';
      case 'FAILED': return 'danger';
      case 'RUNNING': return 'info';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function durationMs(ms: number | null): string {
    if (ms == null) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }
</script>

<svelte:head>
  <title>Add from Run — {data.buildId} - Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}/builds">Builds</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}/builds/{data.buildId}">{data.build?.buildKey ?? data.buildId}</a>
    <span>›</span>
    {#if step === 'review' && selectedRun}
      <span>Add from Run › {selectedRun.jobName ?? selectedRun.runnerId}</span>
    {:else}
      <span>Add from Run</span>
    {/if}
  </nav>

  <h1 class="page-title">Add Scenarios from Automation Run</h1>

  {#if step === 'pick'}
    <!-- Step 1: Pick a run -->
    <p class="page-sub">Select an automation run to import its scenarios into this build.</p>

    <div class="search-wrap">
      <input class="search-input" type="search" bind:value={runSearch} placeholder="Search by job name, branch, or runner…" aria-label="Search runs" />
    </div>

    <div class="run-list">
      {#each filteredRuns as run (run.id)}
        <div class="run-card" role="button" tabindex="0"
          onclick={() => selectRun(run)}
          onkeydown={(e) => e.key === 'Enter' && selectRun(run)}>
          <div class="run-card-status">
            <Badge text={run.status} variant={statusVariant(run.status)} />
          </div>
          <div class="run-card-main">
            <strong class="run-job">{run.jobName ?? run.runnerId}</strong>
            <span class="run-branch">{run.branch ?? '—'}</span>
            <div class="run-stats">
              <span>{(run.passedScenarios ?? 0)}/{(run.totalScenarios ?? 0)} passed</span>
              <span class="run-date">{formatDate(run.startedAt)}</span>
            </div>
          </div>
          <div class="run-card-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      {/each}
      {#if filteredRuns.length === 0}
        <p class="empty">{runSearch ? 'No runs match your search.' : 'No automation runs available for this project.'}</p>
      {/if}
    </div>

  {:else if step === 'review' && selectedRun}
    <!-- Step 2: Review scenarios -->
    <div class="step2-header">
      <button class="back-link" onclick={() => { step = 'pick'; selectedRun = null; }}>
        ← Back to run list
      </button>
    </div>

    <!-- Run summary card -->
    <div class="run-summary-card">
      <Badge text={selectedRun.status} variant={statusVariant(selectedRun.status)} />
      <div>
        <strong>{selectedRun.jobName ?? selectedRun.runnerId}</strong>
        <span class="muted">{selectedRun.branch ?? '—'}</span>
      </div>
      <div class="muted">{(selectedRun.passedScenarios ?? 0)}/{(selectedRun.totalScenarios ?? 0)} passed</div>
      <div class="muted">{formatDate(selectedRun.startedAt)}</div>
    </div>

    <p class="instruction">All scenarios from this run are pre-selected. Uncheck any you don't want to add.</p>

    {#if addError}
      <div class="error">{addError}</div>
    {/if}

    {#if loadingScenarios}
      <p class="empty">Loading scenarios…</p>
    {:else if scenariosError}
      <div class="error">{scenariosError}</div>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th class="checkbox-col">
              <input type="checkbox" checked={allScenariosSelected} onchange={toggleAll} aria-label="Select all" />
            </th>
            <th>Status</th>
            <th>Key</th>
            <th>Name</th>
            <th>Feature</th>
            <th>Duration</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each runScenarios as rs (rs.id)}
            <tr>
              <td data-label="" class="checkbox-col">
                <input type="checkbox" checked={selectedRunScenarioIds.has(rs.id)} onchange={() => toggleScenario(rs.id)} />
              </td>
              <td data-label="Status"><Badge text={rs.status} variant={statusVariant(rs.status)} /></td>
              <td data-label="Key"><code class="mono">{rs.scenarioKey ?? '—'}</code></td>
              <td data-label="Name">{rs.scenarioName}</td>
              <td data-label="Feature" class="muted">{rs.featureName ?? '—'}</td>
              <td data-label="Duration" class="muted">—</td>
            </tr>
          {/each}
          {#if runScenarios.length === 0}
            <tr><td colspan="6" class="empty">No scenarios in this run.</td></tr>
          {/if}
        {/snippet}
      </DataTable>
    {/if}

    <!-- Sticky action bar -->
    <div class="action-bar">
      <span class="action-count">{selectedRunScenarioIds.size} of {runScenarios.length} scenarios selected</span>
      <div class="action-buttons">
        <Button variant="secondary" onclick={() => history.back()}>Cancel</Button>
        <Button variant="primary" disabled={adding || selectedRunScenarioIds.size === 0} onclick={handleAdd}>
          {adding ? (addProgress || 'Adding…') : 'Add to Build →'}
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 100%; margin: 0 auto; padding-bottom: 100px; }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .breadcrumb a:hover { text-decoration: underline; }
  .page-title { font-size: 1.5rem; margin: 0 0 8px; }
  .page-sub { color: var(--color-text-muted); margin: 0 0 20px; }
  .search-wrap { margin-bottom: 16px; max-width: 520px; }
  .search-input { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 9px 12px; background: var(--color-bg); color: var(--color-text); font: inherit; }

  /* Run cards */
  .run-list { display: flex; flex-direction: column; gap: 10px; }
  .run-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 14px;
    background: var(--color-surface);
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .run-card:hover { border-color: var(--color-accent); box-shadow: 0 2px 12px rgba(0,175,165,0.12); }
  .run-card-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .run-job { font-size: 0.9rem; display: block; }
  .run-branch { color: var(--color-text-muted); font-size: 0.8rem; }
  .run-stats { display: flex; gap: 16px; font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px; }
  .run-card-arrow { color: var(--color-text-muted); }
  .run-card:hover .run-card-arrow { color: var(--color-accent); }

  /* Step 2 */
  .step2-header { margin-bottom: 16px; }
  .back-link { color: var(--color-accent); font-size: 0.875rem; font-weight: 600; background: none; border: none; cursor: pointer; padding: 0; font: inherit; }
  .run-summary-card { display: flex; align-items: center; gap: 16px; border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; background: var(--color-surface); margin-bottom: 16px; flex-wrap: wrap; }
  .run-summary-card strong { font-size: 0.9rem; }
  .instruction { color: var(--color-text-muted); font-size: 0.875rem; margin: 0 0 16px; }
  .muted { color: var(--color-text-muted); }
  .mono { font-family: var(--font-mono, monospace); font-size: 0.75rem; }
  .checkbox-col { width: 36px; text-align: center; }
  .empty { color: var(--color-text-muted); font-size: 0.875rem; padding: 24px; text-align: center; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }

  /* Sticky action bar */
  .action-bar {
    position: sticky;
    bottom: 0;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 12px 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    z-index: 10;
    margin-top: 16px;
  }
  .action-count { font-size: 0.875rem; font-weight: 600; color: var(--color-text-muted); margin-right: auto; }
  .action-buttons { display: flex; gap: 10px; align-items: center; }
</style>

<script lang="ts">
  import { goto } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import { createBuild, type ProjectBuild } from '$lib/api/builds';

  let { data } = $props();

  let builds = $state<ProjectBuild[]>([]);
  let showCreate = $state(false);
  let creating = $state(false);
  let createError = $state('');
  let form = $state({ name: '', buildKey: '', version: '', description: '' });

  $effect(() => {
    builds = data.builds;
  });

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status) {
      case 'VERIFIED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'INITIATED': return 'warning';
      default: return 'neutral';
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function pct(value: number): string {
    return `${Number(value || 0).toFixed(0)}%`;
  }

  function buildDonut(build: ProjectBuild) {
    return {
      labels: ['Passed', 'Failed', 'Blocked', 'Skipped', 'Not executed'],
      datasets: [{
        data: [
          build.metrics.passed,
          build.metrics.failed,
          build.metrics.blocked,
          build.metrics.skipped,
          build.metrics.notExecuted
        ],
        backgroundColor: ['#16a34a', '#dc2626', '#d97706', '#64748b', '#cbd5e1'],
        borderWidth: 0
      }]
    };
  }

  async function submitCreate() {
    if (!form.name.trim()) return;
    creating = true;
    createError = '';
    try {
      const created = await createBuild(data.projectKey, {
        name: form.name.trim(),
        buildKey: form.buildKey.trim() || undefined,
        version: form.version.trim() || undefined,
        description: form.description.trim() || undefined
      });
      builds = [created, ...builds];
      showCreate = false;
      form = { name: '', buildKey: '', version: '', description: '' };
    } catch (error) {
      createError = error instanceof Error ? error.message : 'Unable to create build';
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Builds - {data.project?.name ?? data.projectKey} - Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span>›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span>›</span>
    <span>Builds</span>
  </nav>

  <header class="page-header">
    <div>
      <h1>Builds</h1>
      <p>Project verification units for automation and manual execution evidence.</p>
    </div>
    <button class="primary-btn" onclick={() => showCreate = true}>+ Build</button>
  </header>

  <section class="build-grid">
    {#each builds.slice(0, 3) as build}
      <button class="build-card" onclick={() => goto(`/projects/${data.projectKey}/builds/${build.id}`)}>
        <div class="build-card-top">
          <div>
            <strong>{build.name}</strong>
            <span>{build.buildKey}{build.version ? ` · ${build.version}` : ''}</span>
          </div>
          <Badge text={build.status} variant={statusVariant(build.status)} />
        </div>
        <div class="build-card-body">
          <DonutChart chartData={buildDonut(build)} size={180} />
          <div class="build-stats">
            <span><strong>{build.metrics.totalScenarios}</strong> scenarios</span>
            <span><strong>{pct(build.metrics.passPercentage)}</strong> pass</span>
            <span><strong>{pct(build.metrics.executionCoverage)}</strong> executed</span>
          </div>
        </div>
      </button>
    {/each}
  </section>

  <section class="section">
    <DataTable>
      {#snippet head()}
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Scenarios</th>
          <th>Pass</th>
          <th>Execution</th>
          <th>Created</th>
          <th>Verified</th>
          <th></th>
        </tr>
      {/snippet}
      {#snippet body()}
        {#each builds as build}
          <tr>
            <td>
              <strong>{build.name}</strong>
              <div class="muted">{build.buildKey}{build.version ? ` · ${build.version}` : ''}</div>
            </td>
            <td><Badge text={build.status} variant={statusVariant(build.status)} /></td>
            <td>{build.metrics.totalScenarios}</td>
            <td>{pct(build.metrics.passPercentage)}</td>
            <td>{pct(build.metrics.executionCoverage)}</td>
            <td>{formatDate(build.createdAt)}</td>
            <td>{formatDate(build.verifiedAt)}</td>
            <td><a class="link" href="/projects/{data.projectKey}/builds/{build.id}">Open →</a></td>
          </tr>
        {/each}
      {/snippet}
    </DataTable>
  </section>
</div>

<Modal open={showCreate} title="Create Build" onclose={() => showCreate = false}>
  <form class="form" onsubmit={(event) => { event.preventDefault(); submitCreate(); }}>
    {#if createError}<div class="error">{createError}</div>{/if}
    <label>Name<input bind:value={form.name} placeholder="Payment May RC2" /></label>
    <label>Build key<input bind:value={form.buildKey} placeholder="payment-rc2" /></label>
    <label>Version<input bind:value={form.version} placeholder="2026.05.2" /></label>
    <label>Description<textarea bind:value={form.description} rows="3"></textarea></label>
    <div class="modal-actions">
      <button type="button" class="secondary-btn" onclick={() => showCreate = false}>Cancel</button>
      <button type="submit" class="primary-btn" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
    </div>
  </form>
</Modal>

<style>
  .page { max-width: min(1560px, 100%); }
  .breadcrumb { display: flex; gap: 8px; color: var(--color-text-muted); font-size: 0.82rem; margin-bottom: 18px; }
  .breadcrumb a, .link { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
  .page-header h1 { font-size: 1.6rem; margin: 0 0 4px; }
  .page-header p, .muted { color: var(--color-text-muted); margin: 0; font-size: 0.84rem; }
  .build-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .build-card { text-align: left; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: var(--radius); padding: 18px; cursor: pointer; }
  .build-card:hover { border-color: var(--color-accent); }
  .build-card-top { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .build-card-top span { display: block; color: var(--color-text-muted); font-size: 0.78rem; margin-top: 4px; }
  .build-card-body { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 18px; }
  .build-stats { display: grid; gap: 10px; color: var(--color-text-muted); }
  .build-stats strong { color: var(--color-text); font-size: 1.15rem; }
  .section { margin-top: 16px; }
  .primary-btn, .secondary-btn { min-height: 38px; padding: 8px 14px; border-radius: 6px; font-weight: 800; cursor: pointer; }
  .primary-btn { border: 1px solid var(--color-accent); background: var(--color-accent); color: white; }
  .secondary-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
  .form { display: grid; gap: 14px; }
  .form label { display: grid; gap: 6px; color: var(--color-text-muted); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
  .form input, .form textarea { width: 100%; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); border-radius: 6px; padding: 10px 12px; font: inherit; text-transform: none; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .error { color: var(--color-danger); font-weight: 700; }
  @media (max-width: 720px) {
    .page-header, .build-card-top { flex-direction: column; }
    .build-card-body { grid-template-columns: 1fr; justify-items: start; }
  }
</style>

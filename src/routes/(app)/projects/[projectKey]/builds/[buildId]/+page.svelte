<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { verifyBuild, type ProjectBuild } from '$lib/api/builds';

  let { data } = $props();

  let build = $state<ProjectBuild | null>(null);
  let auditOpen = $state(false);
  let verifying = $state(false);
  let verifyError = $state('');

  $effect(() => {
    build = data.build;
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

  // Group scenarios by directory for tree map
  const directoryGroups = $derived.by(() => {
    const groups = new Map<string, { path: string; label: string; passed: number; failed: number; blocked: number; skipped: number; notExecuted: number; total: number }>();
    for (const s of data.scenarios) {
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

  async function handleVerify() {
    if (!build) return;
    verifying = true;
    verifyError = '';
    try {
      build = await verifyBuild(data.projectKey, build.id, { notes: 'Verified from UI' });
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
        <button class="secondary-btn" onclick={() => auditOpen = true}>Audit</button>
        <button class="primary-btn" disabled={verifying || build.status === 'VERIFIED'} onclick={handleVerify}>
          {verifying ? 'Verifying…' : 'Verify Build'}
        </button>
      </div>
    </header>

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
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Scenario</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Source</th>
            <th>Executed By</th>
            <th>Executed At</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each data.scenarios as scenario (scenario.id)}
            <tr>
              <td>
                <strong>{scenario.scenarioKey}</strong>
                <div class="muted">{scenario.name}</div>
              </td>
              <td><Badge text={scenario.expectedStatus} variant="neutral" /></td>
              <td><Badge text={scenario.latestStatus} variant={statusVariant(scenario.latestStatus)} /></td>
              <td>{scenario.source}</td>
              <td>{scenario.executedBy ?? '—'}</td>
              <td>{formatDate(scenario.executedAt)}</td>
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

<Modal open={auditOpen} title="Build Audit Trail" size="lg" onclose={() => auditOpen = false}>
  <ol class="audit-list">
    {#each data.audit as event}
      <li>
        <strong>{event.eventType.replaceAll('_', ' ')}</strong>
        <span>{formatDate(event.occurredAt)} · {event.actor ?? 'system'}</span>
        {#if event.metadata}
          <code>{JSON.stringify(event.metadata)}</code>
        {/if}
      </li>
    {/each}
  </ol>
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
  .primary-btn, .secondary-btn { min-height: 38px; padding: 8px 14px; border-radius: 6px; font-weight: 800; cursor: pointer; }
  .primary-btn { border: 1px solid var(--color-accent); background: var(--color-accent); color: white; }
  .secondary-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
  .primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .error { border: 1px solid #fecaca; background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: var(--radius); margin-bottom: 16px; }
  .audit-list { display: grid; gap: 14px; margin: 0; padding-left: 22px; }
  .audit-list li { padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
  .audit-list span { display: block; color: var(--color-text-muted); margin: 4px 0; }
  .audit-list code { display: block; overflow: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; padding: 8px; }
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

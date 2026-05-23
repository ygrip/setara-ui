<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Badge from '$lib/components/Badge.svelte';
  import { archivePlan, createPlan, updatePlan, type ReleasePlan } from '$lib/api/plans';

  let { data } = $props();

  let busy = $state(false);
  let actionError = $state('');
  let selectedPlanId = $state<string | null>(null);
  let initializedSelection = $state(false);
  let showCreate = $state(false);

  let name = $state('');
  let releaseVersion = $state('');
  let description = $state('');
  let passThreshold = $state(95);
  let coverageThreshold = $state(90);

  const selectedPlan = $derived(data.plans.find((plan: ReleasePlan) => plan.id === selectedPlanId) ?? data.plans[0] ?? null);

  $effect(() => {
    if (!initializedSelection) {
      selectedPlanId = data.plans[0]?.id ?? null;
      showCreate = data.plans.length === 0;
      initializedSelection = true;
    }
  });

  const statusDefs = [
    { status: 'DRAFT', color: 'neutral', desc: 'Plan is being configured.' },
    { status: 'ACTIVE', color: 'info', desc: 'Plan is live and tracking execution results.' },
    { status: 'READY', color: 'success', desc: 'Quality gate passed.' },
    { status: 'AT_RISK', color: 'warning', desc: 'Quality gate needs attention.' },
    { status: 'RELEASED', color: 'success', desc: 'Release has shipped.' },
    { status: 'ARCHIVED', color: 'neutral', desc: 'Plan has been archived.' }
  ];

  function statusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' {
    switch (status?.toUpperCase()) {
      case 'READY':
      case 'RELEASED':
        return 'success';
      case 'ACTIVE':
        return 'info';
      case 'AT_RISK':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
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

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await runAction(async () => {
      const plan = await createPlan(data.projectKey, {
        name: name.trim(),
        releaseVersion: releaseVersion.trim() || undefined,
        description: description.trim() || undefined,
        passThreshold,
        coverageThreshold
      });
      selectedPlanId = plan.id;
      showCreate = false;
      name = '';
      releaseVersion = '';
      description = '';
      passThreshold = 95;
      coverageThreshold = 90;
    });
  }

  async function setStatus(status: string) {
    if (!selectedPlan) return;
    await runAction(async () => {
      await updatePlan(data.projectKey, selectedPlan.id, { status });
    });
  }

  async function handleArchive() {
    if (!selectedPlan) return;
    await runAction(async () => {
      await archivePlan(data.projectKey, selectedPlan.id);
      selectedPlanId = null;
    });
  }
</script>

<svelte:head>
  <title>Release Plans — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <span>Release Plans</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Release Plans</h1>
      <p class="page-subtitle">Define quality gates and track release readiness.</p>
    </div>
    <button class="primary-btn" onclick={() => showCreate = !showCreate}>
      {showCreate ? 'Close' : '+ New Plan'}
    </button>
  </div>

  {#if data.error}
    <div class="error-banner">Could not load release plans — {data.error}</div>
  {/if}
  {#if actionError}
    <div class="error-banner">{actionError}</div>
  {/if}

  {#if showCreate}
    <form class="create-panel" onsubmit={handleCreate}>
      <div class="form-grid">
        <label>
          <span>Name</span>
          <input bind:value={name} placeholder="2026.05 Regression" disabled={busy} required />
        </label>
        <label>
          <span>Release Version</span>
          <input bind:value={releaseVersion} placeholder="2026.05" disabled={busy} />
        </label>
        <label>
          <span>Pass Threshold</span>
          <input type="number" min="0" max="100" bind:value={passThreshold} disabled={busy} />
        </label>
        <label>
          <span>Coverage Threshold</span>
          <input type="number" min="0" max="100" bind:value={coverageThreshold} disabled={busy} />
        </label>
        <label class="wide">
          <span>Description</span>
          <textarea bind:value={description} placeholder="Release scope and notes" disabled={busy}></textarea>
        </label>
      </div>
      <button type="submit" class="primary-btn" disabled={busy || !name.trim()}>Create Plan</button>
    </form>
  {/if}

  <div class="plans-layout">
    <section class="plans-list">
      <div class="section-header">
        <h2>Plans</h2>
        <span>{data.plans.length} active</span>
      </div>
      {#if data.plans.length === 0}
        <div class="empty-state">No release plans yet.</div>
      {:else}
        {#each data.plans as plan}
          <button
            class="plan-card"
            class:active={selectedPlan?.id === plan.id}
            onclick={() => selectedPlanId = plan.id}
          >
            <span class="card-top">
              <strong>{plan.name}</strong>
              <Badge text={plan.status} variant={statusVariant(plan.status)} />
            </span>
            <span class="card-meta">
              {plan.releaseVersion ?? 'No version'} · Created {formatDate(plan.createdAt)}
            </span>
            <span class="thresholds">
              Pass {plan.passThreshold}% · Coverage {plan.coverageThreshold}%
            </span>
          </button>
        {/each}
      {/if}
    </section>

    <aside class="plan-detail">
      {#if selectedPlan}
        <div class="detail-head">
          <div>
            <p class="eyebrow">{selectedPlan.releaseVersion ?? data.projectKey}</p>
            <h2>{selectedPlan.name}</h2>
          </div>
          <Badge text={selectedPlan.status} variant={statusVariant(selectedPlan.status)} />
        </div>

        {#if selectedPlan.description}
          <p class="description">{selectedPlan.description}</p>
        {/if}

        <div class="metric-grid">
          <div>
            <span>Pass Threshold</span>
            <strong>{selectedPlan.passThreshold}%</strong>
          </div>
          <div>
            <span>Coverage Threshold</span>
            <strong>{selectedPlan.coverageThreshold}%</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatDate(selectedPlan.updatedAt)}</strong>
          </div>
        </div>

        <div class="status-actions">
          {#each ['DRAFT', 'ACTIVE', 'READY', 'AT_RISK', 'RELEASED'] as status}
            <button class:active={selectedPlan.status === status} onclick={() => setStatus(status)} disabled={busy}>
              {status}
            </button>
          {/each}
        </div>

        <div class="integration-note">
          <strong>Contract ready:</strong>
          scenarios, execution selection, and metrics are exposed by the backend plan API. The next UI pass can add the detail screen for scenario scope and evidence selection.
        </div>

        <button class="danger-btn" onclick={handleArchive} disabled={busy}>Archive Plan</button>
      {:else}
        <div class="empty-state">Select a plan to view readiness.</div>
      {/if}
    </aside>
  </div>

  <div class="section">
    <h2 class="section-title">Plan Status Reference</h2>
    <div class="status-grid">
      {#each statusDefs as def}
        <div class="status-item">
          <span class="status-badge status-badge--{def.color}">{def.status}</span>
          <span class="status-desc">{def.desc}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .page { max-width: 1180px; }
  .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px; }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  button, input, textarea { font: inherit; }
  button { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 12px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
  button:hover:not(:disabled), button.active { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .primary-btn { background: var(--color-accent); color: white; border-color: var(--color-accent); }
  .primary-btn:hover:not(:disabled) { color: white; }
  .danger-btn { color: var(--color-danger); margin-top: 16px; }
  input, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); padding: 9px 10px; }
  textarea { min-height: 82px; resize: vertical; }
  label { display: grid; gap: 5px; font-size: 0.78rem; color: var(--color-text-muted); }
  .wide { grid-column: 1 / -1; }
  .error-banner { background: #fee2e2; color: var(--color-danger); border: 1px solid #fecaca; border-radius: var(--radius); padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }

  .create-panel, .plans-list, .plan-detail, .status-grid {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .create-panel { padding: 16px; margin-bottom: 18px; }
  .form-grid { display: grid; grid-template-columns: 1.2fr 1fr 140px 160px; gap: 12px; margin-bottom: 12px; }
  .plans-layout { display: grid; grid-template-columns: minmax(360px, 1fr) 420px; gap: 18px; margin-bottom: 28px; align-items: start; }
  .section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .section-header h2, .plan-detail h2 { margin: 0; font-size: 1rem; }
  .section-header span, .card-meta, .thresholds, .eyebrow, .description { color: var(--color-text-muted); font-size: 0.8rem; }
  .plan-card { width: calc(100% - 20px); display: grid; gap: 7px; text-align: left; margin: 10px; padding: 14px; }
  .card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .plan-detail { padding: 18px; }
  .detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
  .eyebrow { margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .description { line-height: 1.6; margin: 0 0 16px; }
  .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .metric-grid div { border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: var(--color-bg); }
  .metric-grid span { display: block; color: var(--color-text-muted); font-size: 0.72rem; margin-bottom: 4px; }
  .metric-grid strong { font-size: 0.92rem; }
  .status-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .integration-note { margin-top: 16px; padding: 12px; background: var(--color-accent-subtle); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-text-muted); font-size: 0.82rem; line-height: 1.5; }
  .empty-state { color: var(--color-text-muted); font-size: 0.875rem; padding: 42px 20px; text-align: center; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 1rem; font-weight: 600; margin-bottom: 14px; }
  .status-grid { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
  .status-item { display: flex; align-items: center; gap: 12px; }
  .status-badge { display: inline-flex; align-items: center; justify-content: center; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; min-width: 80px; }
  .status-badge--neutral { background: var(--color-accent-subtle); color: var(--color-text-muted); }
  .status-badge--info { background: #dbeafe; color: #1d4ed8; }
  .status-badge--success { background: #dcfce7; color: #15803d; }
  .status-badge--warning { background: #fef9c3; color: #92400e; }
  .status-desc { font-size: 0.8rem; color: var(--color-text-muted); }

  @media (max-width: 900px) {
    .plans-layout, .form-grid { grid-template-columns: 1fr; }
    .metric-grid { grid-template-columns: 1fr; }
  }
</style>

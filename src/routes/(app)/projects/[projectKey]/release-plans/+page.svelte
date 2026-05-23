<script lang="ts">
  let { data } = $props();

  const statusDefs = [
    { status: 'DRAFT', color: 'neutral', desc: 'Plan is being configured.' },
    { status: 'ACTIVE', color: 'info', desc: 'Plan is live and tracking execution results.' },
    { status: 'READY', color: 'success', desc: 'Quality gate passed — release approved.' },
    { status: 'AT_RISK', color: 'warning', desc: 'Quality gate at risk — nearing thresholds.' },
    { status: 'RELEASED', color: 'success', desc: 'Release has shipped.' },
    { status: 'ARCHIVED', color: 'neutral', desc: 'Plan has been archived.' }
  ];
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
      <p class="page-subtitle">Define quality gates and track release readiness</p>
    </div>
    <button class="btn-disabled" disabled title="Coming soon">+ New Plan</button>
  </div>

  <!-- Empty state -->
  <div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
    <h2 class="empty-title">No release plans yet</h2>
    <p class="empty-desc">
      Release plans let you monitor quality gates for a specific release.
      Define the scope of scenarios required, set pass percentage thresholds,
      and track go/no-go status as automation runs are executed.
    </p>
  </div>

  <!-- Plan status reference -->
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
  .page { max-width: 1100px; }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }

  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  .btn-disabled {
    padding: 8px 16px;
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .empty-state {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 56px 40px;
    text-align: center;
    margin-bottom: 32px;
    box-shadow: var(--shadow);
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  .empty-desc {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    line-height: 1.7;
    max-width: 520px;
    margin: 0 auto;
  }

  .section { margin-bottom: 28px; }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--color-text);
  }

  .status-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
    min-width: 80px;
    justify-content: center;
  }

  .status-badge--neutral { background: var(--color-accent-subtle); color: var(--color-text-muted); }
  .status-badge--info { background: #dbeafe; color: #1d4ed8; }
  .status-badge--success { background: #dcfce7; color: #15803d; }
  .status-badge--warning { background: #fef9c3; color: #92400e; }

  :global([data-theme="dark"]) .status-badge--info { background: #1e3a8a; color: #93c5fd; }
  :global([data-theme="dark"]) .status-badge--success { background: #14532d; color: #86efac; }
  :global([data-theme="dark"]) .status-badge--warning { background: #78350f; color: #fcd34d; }

  .status-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
</style>

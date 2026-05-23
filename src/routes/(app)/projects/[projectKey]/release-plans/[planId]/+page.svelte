<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Release Plan — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/release-plans">Release Plans</a>
    <span class="sep">›</span>
    <span class="mono">{data.planId.slice(0, 8)}</span>
  </nav>

  <div class="coming-soon">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
    <h1 class="coming-soon-title">Release Plan Detail — coming soon</h1>
    <p class="coming-soon-desc">The release plan detail view will be available once the backend plans API is implemented.</p>
    <a href="/projects/{data.projectKey}/release-plans" class="back-link">← Back to Release Plans</a>
  </div>
</div>

<style>
  .page { max-width: 800px; }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 32px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }
  .mono { font-family: ui-monospace, monospace; }

  .coming-soon {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 56px 40px;
    text-align: center;
    box-shadow: var(--shadow);
  }

  .coming-soon-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  .coming-soon-desc {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0 0 24px;
  }

  .back-link {
    color: var(--color-accent);
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>

<svelte:head>
  <title>Roles — Admin — Setara</title>
</svelte:head>

<div class="section-wrap">
  <div class="panel">
    <h2 class="panel-title">Role Management</h2>
    <div class="coming-soon">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <p class="coming-soon-text">Role management coming soon.</p>
    </div>

    <div class="roles-list">
      <h3 class="roles-subtitle">Current Roles</h3>
      <div class="role-item">
        <span class="role-badge">ADMIN</span>
        <span class="role-desc">Full access to all project settings, API keys, and member management.</span>
      </div>
      <div class="role-item">
        <span class="role-badge">QA</span>
        <span class="role-desc">Access to executions, test repository, release plans, and coverage views.</span>
      </div>
      <div class="role-item">
        <span class="role-badge">VIEWER</span>
        <span class="role-desc">Read-only access to dashboards and execution results.</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }

  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--color-text);
  }

  .coming-soon {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--color-bg);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius);
    margin-bottom: 24px;
  }

  .coming-soon-text {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  .roles-subtitle {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 12px;
  }

  .roles-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .role-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .role-item:last-child { border-bottom: none; }

  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    white-space: nowrap;
    min-width: 70px;
    justify-content: center;
  }

  .role-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
</style>

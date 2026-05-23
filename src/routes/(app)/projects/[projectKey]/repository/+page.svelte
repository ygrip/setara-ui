<script lang="ts">
  import { page } from '$app/state';

  const projectKey = $derived(page.params.projectKey);
</script>

<svelte:head>
  <title>Test Repository — {projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span class="sep">›</span>
    <span>Test Repository</span>
  </nav>

  <div class="page-header">
    <h1 class="page-title">Test Repository</h1>
  </div>

  <div class="notice-banner">
    Test case tree management will be fully implemented once the <code>/api/projects/{'{key}'}/tree</code> backend endpoint is complete.
  </div>

  <div class="repo-layout">
    <!-- Tree panel -->
    <aside class="tree-panel">
      <div class="tree-header">
        <span class="tree-title">Test Tree</span>
        <button class="tree-btn" disabled title="Coming soon">+ New Directory</button>
      </div>
      <div class="tree-body">
        <div class="tree-item tree-item--root">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span>/ (root)</span>
        </div>
        <div class="tree-item tree-item--placeholder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span>auth/</span>
        </div>
        <div class="tree-item tree-item--placeholder tree-item--indent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <span>login.feature</span>
        </div>
        <div class="tree-item tree-item--placeholder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span>checkout/</span>
        </div>
        <p class="tree-empty-note">Select a directory to browse scenarios</p>
      </div>
    </aside>

    <!-- Center panel -->
    <div class="center-panel">
      <div class="center-path">
        <span class="path-segment">{projectKey}</span>
        <span class="path-sep">›</span>
        <span class="path-hint">(select a directory)</span>
      </div>
      <div class="center-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <p>Select a directory from the tree to browse scenarios.</p>
      </div>
      <!-- Column headers -->
      <div class="scenario-header">
        <span class="col-key">Scenario Key</span>
        <span class="col-name">Name</span>
        <span class="col-priority">Priority</span>
        <span class="col-automation">Automation Status</span>
        <span class="col-last">Last Status</span>
      </div>
    </div>

    <!-- Right detail panel -->
    <aside class="detail-panel">
      <div class="detail-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
        </svg>
        <p>Select a scenario to view details.</p>
      </div>
    </aside>
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

  .page-header { margin-bottom: 12px; }
  .page-title { font-size: 1.5rem; font-weight: 700; }

  .notice-banner {
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 10px 16px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: 20px;
  }

  .notice-banner code {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    background: var(--color-border);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .repo-layout {
    display: grid;
    grid-template-columns: 260px 1fr 320px;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    min-height: 480px;
    background: var(--color-surface);
  }

  /* Tree panel */
  .tree-panel {
    background: var(--color-bg);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
  }

  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-border);
    gap: 8px;
  }

  .tree-title {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .tree-btn {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    cursor: not-allowed;
    color: var(--color-text-muted);
    opacity: 0.5;
  }

  .tree-body {
    flex: 1;
    padding: 8px 0;
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    font-size: 0.8rem;
    color: var(--color-text);
    cursor: default;
  }

  .tree-item--root {
    font-weight: 600;
    color: var(--color-accent);
  }

  .tree-item--placeholder {
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .tree-item--indent {
    padding-left: 30px;
  }

  .tree-empty-note {
    margin: 12px 14px 0;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Center panel */
  .center-panel {
    display: flex;
    flex-direction: column;
  }

  .center-path {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.8rem;
  }

  .path-segment {
    font-weight: 600;
    color: var(--color-text);
  }

  .path-sep {
    color: var(--color-text-muted);
    opacity: 0.5;
  }

  .path-hint {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .center-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
    color: var(--color-text-muted);
  }

  .center-empty p { margin: 10px 0 0; font-size: 0.875rem; }

  .scenario-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .col-key { width: 100px; flex-shrink: 0; }
  .col-name { flex: 1; }
  .col-priority { width: 70px; flex-shrink: 0; }
  .col-automation { width: 130px; flex-shrink: 0; }
  .col-last { width: 90px; flex-shrink: 0; }

  /* Detail panel */
  .detail-panel {
    border-left: 1px solid var(--color-border);
    background: var(--color-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-empty {
    text-align: center;
    padding: 24px;
    color: var(--color-text-muted);
  }

  .detail-empty p { margin: 8px 0 0; font-size: 0.8rem; }

  /* Responsive: stack on mobile */
  @media (max-width: 768px) {
    .repo-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }

    .tree-panel {
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }

    .detail-panel {
      border-left: none;
      border-top: 1px solid var(--color-border);
      min-height: 120px;
    }
  }
</style>

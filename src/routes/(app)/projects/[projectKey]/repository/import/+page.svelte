<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    executeImport,
    getImportJob,
    importErrorReportUrl,
    importTemplateUrl,
    listImportJobs,
    validateImport,
    type ImportIssue,
    type ImportJobView,
    type ImportResult,
    type ImportValidationResult
  } from '$lib/api/testcases';
  import AppSkeleton from '$lib/ui/display/AppSkeleton.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import AppProgress from '$lib/ui/feedback/AppProgress.svelte';
  import AppSpinner from '$lib/ui/loading/AppSpinner.svelte';
  import AppStepper, { type AppStep } from '$lib/ui/navigation/AppStepper.svelte';

  let { data } = $props();

  type Step = 'upload' | 'validated' | 'importing' | 'done';

  // ── Wizard state ──────────────────────────────────────────────────
  let step = $state<Step>('upload');
  let file = $state<File | null>(null);
  let duplicateStrategy = $state('SKIP_EXISTING');
  let defaultStatus = $state('DRAFT');
  let isDragOver = $state(false);
  let busy = $state(false);
  let error = $state('');
  let validation = $state<ImportValidationResult | null>(null);
  let result = $state<ImportResult | null>(null);
  let issueFilter = $state<'ALL' | 'ERROR' | 'WARNING'>('ALL');

  // ── Async polling ─────────────────────────────────────────────────
  let pollingJobId = $state<string | null>(null);
  let polledJob = $state<ImportJobView | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // ── History ───────────────────────────────────────────────────────
  let history = $state<ImportJobView[]>([]);
  let historyLoading = $state(false);
  let historyError = $state('');

  const filteredIssues = $derived(
    (validation?.issues ?? result?.issues ?? polledJob?.issues ?? []).filter(
      (i: ImportIssue) => issueFilter === 'ALL' || i.severity === issueFilter
    )
  );

  const stepLabels = ['Upload', 'Review', 'Import', 'Done'];
  const stepMap: Record<Step, number> = { upload: 0, validated: 1, importing: 2, done: 3 };
  const workflowSteps = $derived(stepLabels.map((label, index) => ({
    id: label.toLowerCase(),
    label,
    state: stepMap[step] > index ? 'complete' : stepMap[step] === index ? 'active' : 'pending'
  } satisfies AppStep)));

  // Load history on mount
  $effect(() => {
    loadHistory();
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function loadHistory() {
    historyLoading = true;
    historyError = '';
    try {
      history = await listImportJobs(data.projectKey);
    } catch (e) {
      historyError = (e as Error).message;
    } finally {
      historyLoading = false;
    }
  }

  function startPolling(importId: string) {
    pollingJobId = importId;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        polledJob = await getImportJob(data.projectKey, importId);
        if (polledJob.status === 'COMPLETED' || polledJob.status === 'FAILED') {
          stopPolling();
          step = 'done';
          loadHistory();
        }
      } catch (e) {
        stopPolling();
        error = 'Lost connection while polling import status.';
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) pickFile(input.files[0]);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }

  function pickFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      error = 'Only .xlsx and .xls files are supported.';
      return;
    }
    file = f;
    error = '';
    step = 'upload';
    validation = null;
    result = null;
    polledJob = null;
  }

  async function handleValidate() {
    if (!file) return;
    busy = true;
    error = '';
    try {
      validation = await validateImport(data.projectKey, file, duplicateStrategy);
      step = 'validated';
      issueFilter = 'ALL';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function handleExecute() {
    if (!file) return;
    busy = true;
    error = '';
    step = 'importing';
    try {
      result = await executeImport(data.projectKey, file, duplicateStrategy, defaultStatus);
      if (result.status === 'QUEUED') {
        // Large file — switch to polling mode
        startPolling(result.importId);
      } else {
        step = 'done';
        issueFilter = 'ALL';
        loadHistory();
      }
    } catch (e) {
      error = (e as Error).message;
      step = 'validated';
    } finally {
      busy = false;
    }
  }

  function reset() {
    stopPolling();
    step = 'upload';
    file = null;
    validation = null;
    result = null;
    polledJob = null;
    pollingJobId = null;
    error = '';
    issueFilter = 'ALL';
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  function statusBadgeClass(s: string): string {
    switch (s) {
      case 'COMPLETED': return 'badge-success';
      case 'FAILED':    return 'badge-danger';
      case 'QUEUED':    return 'badge-neutral';
      case 'PROCESSING': return 'badge-info';
      default:          return 'badge-neutral';
    }
  }

  // The effective job for the done step — either async polled or sync result
  const doneJob = $derived(polledJob ?? (result && step === 'done' ? {
    importId: result.importId,
    status: result.status,
    fileName: file?.name ?? null,
    duplicateStrategy,
    defaultStatus,
    totalRows: result.totalRows,
    processedRows: result.totalRows,
    successCount: result.createdCount + result.updatedCount,
    warningCount: result.issues.filter(i => i.severity === 'WARNING').length,
    errorCount: result.failedCount,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    issues: result.issues
  } as ImportJobView : null));
</script>

<svelte:head>
  <title>Import Scenarios — {data.projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}">{data.projectKey}</a>
    <span class="sep">›</span>
    <a href="/projects/{data.projectKey}/repository">Test Repository</a>
    <span class="sep">›</span>
    <span>Import Scenarios</span>
  </nav>

  <div class="page-header">
    <div>
      <h1 class="page-title">Import Scenarios</h1>
      <p class="page-subtitle">Bulk-create scenarios from an Excel file. Each row becomes one scenario.</p>
    </div>
    <a class="btn-outline" href="/projects/{data.projectKey}/repository">← Repository</a>
  </div>

  <AppStepper steps={workflowSteps} />

  {#if error}
    <AppAlert tone="error">{error}</AppAlert>
  {/if}

  <!-- ── Step 1: Upload ────────────────────────────────────────── -->
  {#if step === 'upload'}
    <div class="wizard-layout">
      <div class="wizard-main glass">
        <h2 class="section-title">Select File</h2>

        <label
          class="dropzone"
          class:drag-over={isDragOver}
          class:has-file={file !== null}
          ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
          ondragleave={() => isDragOver = false}
          ondrop={handleDrop}
        >
          <input type="file" accept=".xlsx,.xls" onchange={handleFileInput} class="file-input" />
          {#if file}
            <div class="file-info">
              <span class="file-icon">📊</span>
              <div>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </div>
              <button class="remove-file" type="button" onclick={(e) => { e.preventDefault(); file = null; }}>✕</button>
            </div>
          {:else}
            <div class="drop-hint">
              <span class="drop-icon">⬆</span>
              <strong>Drop your Excel file here</strong>
              <small>or click to browse · .xlsx or .xls · up to 20 MB</small>
            </div>
          {/if}
        </label>

        <h2 class="section-title top-gap">Import Options</h2>

        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="dup-strategy">Duplicate Strategy</label>
            <select id="dup-strategy" bind:value={duplicateStrategy} class="select">
              <option value="SKIP_EXISTING">Skip existing</option>
              <option value="UPDATE_EXISTING">Update existing</option>
              <option value="FAIL_ON_DUPLICATE">Fail on duplicate</option>
            </select>
            <p class="option-hint">How to handle scenarios that already exist in this project.</p>
          </div>
          <div class="option-group">
            <label class="option-label" for="def-status">Default Scenario Status</label>
            <select id="def-status" bind:value={defaultStatus} class="select">
              <option value="DRAFT">Draft — requires review</option>
              <option value="ACTIVE">Active — publish immediately</option>
            </select>
            <p class="option-hint">Applied when the row has no <code>status</code> column.</p>
          </div>
        </div>

        <div class="step-actions">
          <button class="btn-primary" onclick={handleValidate} disabled={!file || busy}>
            {busy ? 'Validating…' : 'Validate File'}
          </button>
        </div>
      </div>

      <div class="wizard-side">
        <div class="info-card glass">
          <h3>Download Template</h3>
          <p>Get the official .xlsx template with column definitions, examples, and allowed values.</p>
          <a class="btn-outline full" href={importTemplateUrl(data.projectKey)} download="setara-import-template.xlsx">
            ⬇ Download Template
          </a>
        </div>
        <div class="info-card glass">
          <h3>Column Guide</h3>
          <dl class="col-guide">
            <dt>path <span class="req">required</span></dt>
            <dd>Folder path, <code>/</code>-separated.<br/><code>Checkout/Payment/VA</code></dd>
            <dt>scenarioTitle <span class="req">required</span></dt>
            <dd>The scenario name.</dd>
            <dt>steps</dt>
            <dd>Newlines, numbered, bullets, semicolons, or pipes. Cucumber keywords auto-detected.</dd>
            <dt>status</dt>
            <dd><code>DRAFT</code> or <code>ACTIVE</code> per row.</dd>
            <dt>priority</dt>
            <dd>CRITICAL · HIGH · MEDIUM · LOW</dd>
            <dt>tags</dt>
            <dd>Comma-separated. <code>checkout, payment</code></dd>
          </dl>
        </div>
      </div>
    </div>
  {/if}

  <!-- ── Step 2: Validated ──────────────────────────────────────── -->
  {#if step === 'validated' && validation}
    <div class="wizard-layout">
      <div class="wizard-main">
        <div class="glass">
          <h2 class="section-title">Validation Result</h2>
          <p class="file-badge">📊 {file?.name}</p>

          <div class="stats-row">
            <div class="stat"><span class="stat-value">{validation.totalRows}</span><span class="stat-label">Rows</span></div>
            <div class="stat accent"><span class="stat-value">{validation.newScenarioCount}</span><span class="stat-label">New</span></div>
            <div class="stat neutral"><span class="stat-value">{validation.existingScenarioCount}</span><span class="stat-label">Existing</span></div>
            <div class="stat"><span class="stat-value">{validation.parsedStepCount}</span><span class="stat-label">Steps</span></div>
            <div class="stat {validation.errorCount > 0 ? 'danger' : 'success'}"><span class="stat-value">{validation.errorCount}</span><span class="stat-label">Errors</span></div>
            <div class="stat {validation.warningCount > 0 ? 'warning' : 'success'}"><span class="stat-value">{validation.warningCount}</span><span class="stat-label">Warnings</span></div>
          </div>

          {#if validation.totalRows > 500}
            <div class="callout info">
              <strong>Large file detected ({validation.totalRows} rows).</strong>
              Import will run asynchronously in the background — you'll see a live progress status below.
            </div>
          {/if}

          {#if validation.errorCount > 0}
            <div class="callout danger"><strong>Cannot import:</strong> {validation.errorCount} rows have errors that must be fixed first.</div>
          {:else if validation.warningCount > 0}
            <div class="callout warning"><strong>{validation.warningCount} warnings</strong> found — you can still import.</div>
          {:else}
            <div class="callout success"><strong>All rows look good!</strong> Ready to import {validation.newScenarioCount} new scenarios.</div>
          {/if}

          {#if validation.issues.length > 0}
            <div class="issue-header">
              <h3>Issues</h3>
              <div class="segmented">
                <button class:active={issueFilter === 'ALL'} onclick={() => issueFilter = 'ALL'}>All ({validation.issues.length})</button>
                <button class:active={issueFilter === 'ERROR'} onclick={() => issueFilter = 'ERROR'}>Errors ({validation.errorCount})</button>
                <button class:active={issueFilter === 'WARNING'} onclick={() => issueFilter = 'WARNING'}>Warnings ({validation.warningCount})</button>
              </div>
            </div>
            <div class="issue-list">
              {#each filteredIssues as issue}
                <div class="issue-row {issue.severity.toLowerCase()}">
                  <span class="issue-badge">{issue.severity}</span>
                  <span class="issue-row-num">Row {issue.rowNumber}</span>
                  <span class="issue-code">{issue.code}</span>
                  <span class="issue-msg">{issue.message}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="step-actions">
          <button class="btn-ghost" onclick={reset}>← Change File</button>
          <button class="btn-primary" onclick={handleExecute} disabled={validation.errorCount > 0 || busy}>
            Import {validation.newScenarioCount} Scenario{validation.newScenarioCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      <div class="wizard-side">
        <div class="info-card glass">
          <h3>Import Settings</h3>
          <dl class="settings-summary">
            <dt>Strategy</dt><dd>{duplicateStrategy.replace(/_/g, ' ')}</dd>
            <dt>Default status</dt><dd>{defaultStatus}</dd>
            <dt>File</dt><dd class="truncate">{file?.name}</dd>
          </dl>
          <button class="btn-ghost full" onclick={reset}>Change settings</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ── Step 3: Importing ─────────────────────────────────────── -->
  {#if step === 'importing'}
    <div class="importing-state glass">
      {#if pollingJobId}
        <!-- Async: polling -->
        <AppSpinner mode="progress" size={72} label="Import queued" />
        <h2>Import queued</h2>
        <p>Your file has <strong>more than 500 rows</strong> and is being processed in the background.</p>
        {#if polledJob}
          <div class="poll-progress">
            <div class="poll-row">
              <span class="stat-label">Status</span>
              <span class="badge {statusBadgeClass(polledJob.status)}">{polledJob.status}</span>
            </div>
            <div class="poll-row">
              <span class="stat-label">Rows processed</span>
              <strong>{polledJob.processedRows} / {polledJob.totalRows}</strong>
            </div>
            {#if polledJob.totalRows > 0}
              <AppProgress
                value={polledJob.processedRows}
                max={polledJob.totalRows}
                tone={polledJob.status === 'FAILED' ? 'error' : 'info'}
                showValue
              />
            {/if}
          </div>
        {:else}
          <p class="muted">Waiting for worker to pick up the job…</p>
        {/if}
      {:else}
        <!-- Sync: regular processing -->
        <AppSpinner mode="progress" size={72} label="Importing scenarios" />
        <h2>Importing scenarios…</h2>
        <p>Creating directories, parsing steps, and saving scenarios. This may take a moment.</p>
      {/if}
    </div>
  {/if}

  <!-- ── Step 4: Done ──────────────────────────────────────────── -->
  {#if step === 'done' && doneJob}
    <div class="wizard-layout">
      <div class="wizard-main">
        <div class="glass">
          <div class="result-icon {doneJob.status === 'COMPLETED' ? 'success' : 'partial'}">
            {doneJob.status === 'COMPLETED' ? '✓' : '⚠'}
          </div>
          <h2 class="section-title center">
            {doneJob.status === 'COMPLETED' ? 'Import complete' : 'Import finished with errors'}
          </h2>

          <div class="stats-row">
            <div class="stat accent"><span class="stat-value">{doneJob.successCount}</span><span class="stat-label">Succeeded</span></div>
            <div class="stat {doneJob.errorCount > 0 ? 'danger' : 'success'}"><span class="stat-value">{doneJob.errorCount}</span><span class="stat-label">Failed rows</span></div>
            <div class="stat neutral"><span class="stat-value">{doneJob.totalRows}</span><span class="stat-label">Total rows</span></div>
          </div>

          {#if doneJob.issues.length > 0}
            <div class="issue-header">
              <h3>Issues</h3>
              <div class="actions-right">
                <a class="btn-outline small" href={importErrorReportUrl(data.projectKey, doneJob.importId)} download>
                  ⬇ Download Error Report
                </a>
                <div class="segmented">
                  <button class:active={issueFilter === 'ALL'} onclick={() => issueFilter = 'ALL'}>All</button>
                  <button class:active={issueFilter === 'ERROR'} onclick={() => issueFilter = 'ERROR'}>Errors</button>
                  <button class:active={issueFilter === 'WARNING'} onclick={() => issueFilter = 'WARNING'}>Warnings</button>
                </div>
              </div>
            </div>
            <div class="issue-list">
              {#each filteredIssues as issue}
                <div class="issue-row {issue.severity.toLowerCase()}">
                  <span class="issue-badge">{issue.severity}</span>
                  <span class="issue-row-num">Row {issue.rowNumber}</span>
                  <span class="issue-code">{issue.code}</span>
                  <span class="issue-msg">{issue.message}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="step-actions">
          <button class="btn-ghost" onclick={reset}>Import Another File</button>
          <a class="btn-primary" href="/projects/{data.projectKey}/repository">View Repository</a>
        </div>
      </div>

      <div class="wizard-side">
        <div class="info-card glass">
          <h3>Summary</h3>
          <dl class="settings-summary">
            <dt>Total rows</dt><dd>{doneJob.totalRows}</dd>
            <dt>Succeeded</dt><dd>{doneJob.successCount}</dd>
            <dt>Errors</dt><dd>{doneJob.errorCount}</dd>
            <dt>Warnings</dt><dd>{doneJob.warningCount}</dd>
            <dt>Strategy</dt><dd>{doneJob.duplicateStrategy.replace(/_/g, ' ')}</dd>
            <dt>Default status</dt><dd>{doneJob.defaultStatus}</dd>
          </dl>
          {#if doneJob.errorCount > 0 || doneJob.warningCount > 0}
            <a class="btn-outline full" href={importErrorReportUrl(data.projectKey, doneJob.importId)} download>
              ⬇ Download Error Report
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- ── Import History ─────────────────────────────────────────── -->
  <div class="history-section">
    <div class="history-header">
      <h2 class="section-title">Import History</h2>
      <button class="btn-ghost small" onclick={loadHistory} disabled={historyLoading}>
        {historyLoading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>

    {#if historyError}
      <AppAlert tone="error">{historyError}</AppAlert>
    {:else if historyLoading && history.length === 0}
      <div class="history-skeleton" aria-label="Loading import history">
        <AppSkeleton height="2.75rem" lines={3} />
      </div>
    {:else if history.length === 0 && !historyLoading}
      <div class="empty-history">No imports yet for this project.</div>
    {:else}
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Succeeded</th>
              <th>Errors</th>
              <th>Strategy</th>
              <th>Default status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each history as job}
              <tr>
                <td class="file-cell" data-label="File" title={job.fileName ?? ''}>{job.fileName ?? '—'}</td>
                <td data-label="Status"><span class="badge {statusBadgeClass(job.status)}">{job.status}</span></td>
                <td data-label="Rows">{job.totalRows}</td>
                <td class="success-cell" data-label="OK">{job.successCount}</td>
                <td class="{job.errorCount > 0 ? 'error-cell' : ''}" data-label="Errors">{job.errorCount}</td>
                <td class="muted col-hide-mobile" data-label="Strategy">{job.duplicateStrategy.replace(/_/g, ' ')}</td>
                <td class="muted col-hide-mobile" data-label="Default">{job.defaultStatus}</td>
                <td class="muted date-cell" data-label="Date">{formatDate(job.createdAt)}</td>
                <td data-label="">
                  {#if job.errorCount > 0 || job.warningCount > 0}
                    <a class="table-link" href={importErrorReportUrl(data.projectKey, job.importId)} download title="Download error report">⬇</a>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .page { max-width: min(1520px, 100%); margin: 0 auto; padding: 2rem 1.5rem; }

  .breadcrumb { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1.5rem; flex-wrap: wrap; }
  .breadcrumb a { color: var(--color-accent); text-decoration: none; }
  .breadcrumb a:hover { text-decoration: underline; }
  .sep { opacity: 0.4; }

  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .page-title { font-family: var(--font-sans); font-size: 1.6rem; font-weight: 700; color: var(--color-text); margin: 0 0 0.25rem; }
  .page-subtitle { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }

  :global(.page > .app-stepper) { margin-bottom: 2rem; }

  /* Layout */
  .wizard-layout { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }
  @media (max-width: 768px) {
    .wizard-layout { grid-template-columns: 1fr; }
    .page { padding: 1.25rem 1rem; }
    .page-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; margin-bottom: 1.25rem; }
    :global(.page > .app-stepper) { margin-bottom: 1.25rem; }
    .glass { padding: 1rem; }
    .stats-row { gap: 0.5rem; }
    .stat { min-width: 56px; }
    .stat-value { font-size: 1.25rem; }
    .step-actions { flex-direction: column-reverse; }
    .step-actions .btn-primary,
    .step-actions .btn-ghost { width: 100%; justify-content: center; }
  }
  .wizard-main, .wizard-side { display: flex; flex-direction: column; gap: 1rem; }

  /* Glass */
  .glass { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; }

  .section-title { font-family: var(--font-sans); font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0 0 1rem; }
  .section-title.center { text-align: center; }
  .top-gap { margin-top: 1.75rem; }

  /* Dropzone */
  .dropzone { display: block; border: 2px dashed var(--color-border); border-radius: 10px; padding: 2.5rem 2rem; cursor: pointer; transition: border-color 0.2s, background 0.2s; text-align: center; }
  .dropzone:hover, .dropzone.drag-over { border-color: var(--color-accent); background: var(--color-accent-subtle); }
  .dropzone.has-file { border-style: solid; border-color: var(--color-accent); background: var(--color-accent-subtle); }
  .file-input { display: none; }
  .drop-hint { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--color-text-muted); }
  .drop-icon { font-size: 2.5rem; }
  .drop-hint strong { color: var(--color-text); }
  .drop-hint small { font-size: 0.8rem; }
  .file-info { display: flex; align-items: center; gap: 1rem; text-align: left; }
  .file-icon { font-size: 2rem; }
  .file-info div { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
  .file-info strong { color: var(--color-text); }
  .file-info small { color: var(--color-text-muted); font-size: 0.8rem; }
  .remove-file { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 1rem; padding: 0.25rem; border-radius: 4px; }
  .remove-file:hover { color: var(--color-status-failed); background: rgba(239,68,68,0.1); }

  /* Options */
  .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  @media (max-width: 600px) { .options-grid { grid-template-columns: 1fr; } }
  .option-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .option-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text); }
  .select { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-family: var(--font-body); cursor: pointer; }
  .select:focus { outline: 2px solid var(--color-accent); border-color: transparent; }
  .option-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; }
  .option-hint code { font-family: var(--font-mono); background: var(--color-border); padding: 0.1em 0.35em; border-radius: 3px; }

  /* Buttons */
  .step-actions { display: flex; align-items: center; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; flex-wrap: wrap; }
  .btn-primary { background: var(--color-accent); color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.15s; display: inline-flex; align-items: center; }
  .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-outline { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent); border-radius: 8px; padding: 0.55rem 1.25rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: background 0.15s; display: inline-flex; align-items: center; }
  .btn-outline:hover { background: var(--color-accent-subtle); }
  .btn-outline.full { display: block; text-align: center; margin-top: 0.75rem; }
  .btn-outline.small { padding: 0.3rem 0.7rem; font-size: 0.75rem; }
  .btn-ghost { background: transparent; border: 1px solid var(--color-border); color: var(--color-text); border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
  .btn-ghost:hover:not(:disabled) { background: var(--color-surface); }
  .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost.full { display: block; width: 100%; text-align: center; margin-top: 0.5rem; }
  .btn-ghost.small { padding: 0.3rem 0.75rem; font-size: 0.75rem; }

  /* Info card */
  .info-card h3 { font-size: 0.85rem; font-weight: 600; margin: 0 0 0.6rem; color: var(--color-text); }
  .info-card p { font-size: 0.8rem; color: var(--color-text-muted); margin: 0 0 0.75rem; }
  .col-guide { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.75rem; font-size: 0.77rem; }
  .col-guide dt { font-weight: 600; color: var(--color-text); padding-top: 0.5rem; }
  .col-guide dd { margin: 0; color: var(--color-text-muted); padding-top: 0.5rem; }
  .col-guide code { font-family: var(--font-mono); background: var(--color-border); padding: 0.1em 0.3em; border-radius: 3px; }
  .req { color: var(--color-accent); font-size: 0.7rem; font-weight: 400; margin-left: 0.25rem; }

  /* Stats row */
  .stats-row { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
  .stat { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; min-width: 70px; }
  .stat-value { font-size: 1.6rem; font-weight: 700; font-family: var(--font-sans); color: var(--color-text); }
  .stat-label { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .stat.accent .stat-value { color: var(--color-accent); }
  .stat.success .stat-value { color: var(--color-status-passed); }
  .stat.danger .stat-value { color: var(--color-status-failed); }
  .stat.warning .stat-value { color: var(--color-status-blocked); }
  .stat.neutral .stat-value { color: var(--color-text-muted); }

  /* Callouts */
  .callout { border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; margin: 0.75rem 0; }
  .callout.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--color-status-passed); }
  .callout.warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: var(--color-status-blocked); }
  .callout.danger  { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.3);  color: var(--color-status-failed); }
  .callout.info    { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: var(--color-status-running); }

  /* Issue list */
  .issue-header { display: flex; align-items: center; justify-content: space-between; margin-top: 1.25rem; flex-wrap: wrap; gap: 0.5rem; }
  .issue-header h3 { font-size: 0.875rem; font-weight: 600; margin: 0; }
  .actions-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .segmented { display: flex; border: 1px solid var(--color-border); border-radius: 6px; overflow: hidden; }
  .segmented button { background: none; border: none; border-right: 1px solid var(--color-border); color: var(--color-text-muted); padding: 0.3rem 0.75rem; font-size: 0.75rem; cursor: pointer; font: inherit; }
  .segmented button:last-child { border-right: none; }
  .segmented button.active { background: var(--color-accent); color: #fff; }
  .segmented button:hover:not(.active) { background: var(--color-surface); }
  .issue-list { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.75rem; max-height: 360px; overflow-y: auto; }
  .issue-row { display: grid; grid-template-columns: 70px 60px 160px 1fr; gap: 0.5rem; align-items: center; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; }
  .issue-row.error   { background: rgba(239,68,68,0.07); }
  .issue-row.warning { background: rgba(245,158,11,0.07); }
  .issue-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15em 0.5em; border-radius: 4px; text-transform: uppercase; }
  .issue-row.error   .issue-badge { background: rgba(239,68,68,0.2);  color: var(--color-status-failed); }
  .issue-row.warning .issue-badge { background: rgba(245,158,11,0.2); color: var(--color-status-blocked); }
  .issue-row-num { color: var(--color-text-muted); font-family: var(--font-mono); font-size: 0.75rem; }
  .issue-code { font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-text-muted); }
  .issue-msg { color: var(--color-text); }
  @media (max-width: 600px) {
    .issue-row { grid-template-columns: 60px 1fr; }
    .issue-row-num, .issue-code { display: none; }
  }

  /* Validation summary */
  .file-badge { font-size: 0.8rem; color: var(--color-text-muted); margin: 0 0 1rem; }
  .settings-summary { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.3rem 0.75rem; font-size: 0.8rem; }
  .settings-summary dt { font-weight: 600; color: var(--color-text-muted); }
  .settings-summary dd { margin: 0; color: var(--color-text); }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }

  /* Importing state */
  .importing-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; padding: 4rem 2rem; max-width: 520px; margin: 0 auto; }
  .importing-state h2 { font-family: var(--font-sans); font-size: 1.25rem; font-weight: 600; margin: 0; }
  .importing-state p { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }
  /* Poll progress */
  .poll-progress { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 360px; margin-top: 0.5rem; }
  .poll-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
  .progress-bar-wrap { height: 6px; background: var(--color-border); border-radius: 99px; overflow: hidden; }
  .progress-bar { height: 100%; background: var(--color-accent); border-radius: 99px; transition: width 0.4s ease; }

  /* Result icon */
  .result-icon { width: 3.5rem; height: 3.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; margin: 0 auto 1rem; }
  .result-icon.success { background: rgba(34,197,94,0.15); color: var(--color-status-passed); }
  .result-icon.partial { background: rgba(245,158,11,0.15); color: var(--color-status-blocked); }

  /* Badges */
  .badge { font-size: 0.72rem; font-weight: 700; padding: 0.2em 0.6em; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
  .badge-success { background: rgba(34,197,94,0.15);  color: var(--color-status-passed); }
  .badge-danger  { background: rgba(239,68,68,0.15);  color: var(--color-status-failed); }
  .badge-neutral { background: var(--color-border);   color: var(--color-text-muted); }
  .badge-info    { background: rgba(59,130,246,0.15); color: var(--color-status-running); }

  /* History */
  .history-section { margin-top: 3rem; }
  .history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .empty-history { color: var(--color-text-muted); font-size: 0.875rem; padding: 2rem; text-align: center; border: 1px dashed var(--color-border); border-radius: 8px; }
  .history-skeleton { padding: 1rem; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
  .history-table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
  .history-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .history-table th { text-align: left; padding: 0.6rem 1rem; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); background: var(--color-bg); }
  .history-table td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; }
  .history-table tbody tr:last-child td { border-bottom: none; }
  .history-table tbody tr:hover { background: var(--color-accent-subtle); }
  .file-cell { font-family: var(--font-mono); font-size: 0.75rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .success-cell { color: var(--color-status-passed); font-weight: 600; }
  .error-cell { color: var(--color-status-failed); font-weight: 600; }
  .muted { color: var(--color-text-muted); }
  .date-cell { white-space: nowrap; font-size: 0.75rem; }
  .table-link { color: var(--color-accent); text-decoration: none; font-size: 1rem; padding: 0.2rem 0.4rem; border-radius: 4px; }
  .table-link:hover { background: var(--color-accent-subtle); }

  /* ── Mobile: history table card layout ───────────────────────── */
  @media (max-width: 640px) {
    .history-table-wrap { border: none; background: none; overflow-x: visible; }
    .history-table,
    .history-table tbody,
    .history-table tr,
    .history-table td { display: block; }
    .history-table thead {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .history-table tbody { display: flex; flex-direction: column; gap: 8px; padding: 0; }
    .history-table tr {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      overflow: hidden;
    }
    .history-table tr:hover { background: var(--color-accent-subtle); }
    .history-table td {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid var(--color-border); font-size: 0.82rem;
    }
    .history-table td:last-child { border-bottom: none; }
    .history-table td::before {
      content: attr(data-label);
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      color: var(--color-text-muted); min-width: 64px; flex-shrink: 0;
    }
    .history-table td[data-label=""]::before { display: none; }
    .history-table td[data-label=""] { justify-content: flex-end; }
    .col-hide-mobile { display: none !important; }
    .file-cell { max-width: none; white-space: normal; word-break: break-all; }
  }
</style>

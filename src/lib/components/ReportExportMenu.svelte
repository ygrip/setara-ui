<script lang="ts">
  import { downloadReport, type ReportFormat } from '$lib/api/reports';
  import { isMockMode } from '$lib/mock/client';
  import { notify } from '$lib/ui/feedback/notify';

  let {
    reportPath,
    filenameBase,
    label = 'Export'
  }: {
    reportPath: string;
    filenameBase: string;
    label?: string;
  } = $props();

  let open = $state(false);
  let busy = $state<ReportFormat | null>(null);
  const previewMode = isMockMode();

  const exportIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
  const pdfIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h1.5a1.5 1.5 0 0 1 0 3H8v-5"/><path d="M13 16v-5h1.5a2.5 2.5 0 0 1 0 5H13"/><path d="M18 11h-2v5"/></svg>';
  const sheetIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>';

  function formatLabel(format: ReportFormat): string {
    return format === 'xlsx' ? 'Excel' : 'PDF';
  }

  function showExportError(message: string, format?: ReportFormat) {
    notify.error(message, {
      title: format ? `Could not export ${formatLabel(format)}` : 'Report export unavailable',
      timeoutMs: 7000
    });
  }

  async function handleExport(format: ReportFormat) {
    if (busy) return;
    if (previewMode) {
      open = false;
      showExportError('Connect a live Setara backend to download reports.');
      return;
    }
    busy = format;
    try {
      await downloadReport(reportPath, format, filenameBase);
      open = false;
    } catch (e) {
      open = false;
      showExportError(e instanceof Error ? e.message : 'Unable to export report.', format);
    } finally {
      busy = null;
    }
  }
</script>

<div class="export-menu-wrap">
  <button
    class="export-trigger"
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    disabled={!!busy}
    title={previewMode ? 'Connect a live Setara backend to download reports' : undefined}
    onclick={() => { open = !open; }}
  >
    <span class="trigger-icon">{@html exportIcon}</span>
    <span>{busy ? `Exporting ${busy.toUpperCase()}…` : label}</span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="menu-dismiss" onclick={() => open = false}></div>
    <div class="export-menu" role="menu">
      <button type="button" role="menuitem" class="export-option" onclick={() => handleExport('pdf')} disabled={!!busy}>
        <span class="option-icon">{@html pdfIcon}</span>
        <span><strong>PDF</strong><small>Shareable release report</small></span>
      </button>
      <button type="button" role="menuitem" class="export-option" onclick={() => handleExport('xlsx')} disabled={!!busy}>
        <span class="option-icon">{@html sheetIcon}</span>
        <span><strong>Excel</strong><small>Spreadsheet for analysis</small></span>
      </button>
    </div>
  {/if}
</div>

<style>
  .export-menu-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .export-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 38px;
    padding: 8px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .export-trigger:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 90%);
  }

  .export-trigger:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .export-trigger:disabled {
    opacity: 0.62;
    cursor: wait;
  }

  .trigger-icon,
  .option-icon {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .menu-dismiss {
    position: fixed;
    inset: 0;
    z-index: 58;
  }

  .export-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 59;
    display: grid;
    gap: 4px;
    min-width: 230px;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }

  .export-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .export-option:hover:not(:disabled),
  .export-option:focus-visible {
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    outline: none;
  }

  .export-option:disabled {
    opacity: 0.58;
    cursor: wait;
  }

  .export-option strong,
  .export-option small {
    display: block;
  }

  .export-option strong {
    font-size: 0.84rem;
  }

  .export-option small {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  @media (max-width: 560px) {
    .export-menu-wrap,
    .export-trigger {
      width: 100%;
    }

    .export-menu {
      left: 0;
      right: auto;
      width: min(280px, 100%);
    }
  }
</style>

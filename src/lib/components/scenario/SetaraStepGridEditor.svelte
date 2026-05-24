<script lang="ts">
  /**
   * SetaraStepGridEditor
   *
   * Spreadsheet-like step editor backed by RevoGrid.
   * - Edit mode: RevoGrid table (keyword / step text / description / expectation)
   * - Preview mode: Markdown-rendered step list with highlight.js syntax highlighting
   * - Toolbar: + Row, Paste & Parse, Normalize, Move Up, Move Down, Duplicate, Delete
   * - Local draft state — changes do NOT auto-save; parent receives steps via `onchange`
   */

  import { untrack } from 'svelte';
  import type { ColumnRegular, EditorBase, EditorCtr, ColumnDataSchemaModel, EditCell } from '@revolist/revogrid';
  import { RevoGrid } from '@revolist/svelte-datagrid';
  import StepPasteParseDialog from './StepPasteParseDialog.svelte';
  import { renderMarkdown } from '$lib/markdown';
  import {
    type StepGridRow,
    type BackendStep,
    fromBackendSteps,
    toBackendSteps,
    emptyRow,
    validateRows,
    reorder
  } from './step-grid.types';
  import { normalizeKeywords } from '$lib/features/steps/step-parser';

  // ── Props ─────────────────────────────────────────────────────
  interface Props {
    /** Current steps from backend (read on mount / when scenario changes) */
    steps: BackendStep[];
    /** Set to true to disable all edits */
    readonly?: boolean;
    /** Called whenever local draft changes */
    onchange: (steps: BackendStep[]) => void;
  }

  let { steps, readonly = false, onchange }: Props = $props();

  // ── Local state ───────────────────────────────────────────────
  let rows = $state<StepGridRow[]>([]);
  let mode = $state<'edit' | 'preview'>('edit');
  let focusedRowIndex = $state<number>(-1);
  let showPasteDialog = $state(false);
  let gridWrap = $state<HTMLDivElement | undefined>();
  /** Row height in px — user-adjustable via toolbar */
  let rowSize = $state(34);
  let errorCount = $derived(rows.filter((r) => r._error).length);
  let warningCount = $derived(
    rows.filter((r) => !r._error && r.text.trim() === '' && rows.indexOf(r) < rows.length - 1)
      .length
  );

  // ── Sync from parent when steps prop changes ──────────────────
  // Use untrack to read current `rows` without making it a dependency,
  // then only reinitialise when the incoming steps are genuinely different
  // from what we last pushed via onchange (preventing the feedback loop
  // where onchange → parent updates `steps` → effect resets rows).
  $effect(() => {
    const incoming = steps; // reactive dependency
    untrack(() => {
      const current = toBackendSteps(rows); // read rows without tracking
      const same =
        incoming.length === current.length &&
        incoming.every(
          (s, i) =>
            s.name === current[i]?.name &&
            s.keyword === current[i]?.keyword &&
            (s.description ?? '') === (current[i]?.description ?? '') &&
            (s.expectation ?? '') === (current[i]?.expectation ?? '') &&
            (s.sequenceNo ?? i + 1) === (current[i]?.sequenceNo ?? i + 1)
        );
      if (same) return; // our own feedback — skip reinit
      rows = incoming.length > 0 ? fromBackendSteps(incoming) : [emptyRow(1)];
      rows = validateRows(rows);
    });
  });

  // ── RevoGrid columns ──────────────────────────────────────────
  const KEYWORD_VALUES = ['', 'GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'];
  const KW_COLORS: Record<string, string> = {
    GIVEN: '#8b5cf6',
    WHEN: '#d97706',
    THEN: '#0d9488',
    AND: '#64748b',
    BUT: '#64748b'
  };

  const keywordSelectEditor: EditorCtr = (_column: ColumnDataSchemaModel, save: (value?: unknown, preventFocus?: boolean) => void): EditorBase => {
    let selectEl: HTMLSelectElement | null = null;
    const editor: EditorBase = {
      element: null,
      editCell: undefined,
      componentDidRender() {
        selectEl?.focus();
      },
      beforeDisconnect() {
        selectEl?.blur();
      },
      getValue() {
        return selectEl?.value ?? '';
      },
      render(h) {
        const editCell = editor.editCell as (EditCell & { val?: string }) | undefined;
        const value = editCell?.val ?? '';
        return h(
          'select',
          {
            class: 'keyword-select-editor',
            value,
            ref: (el: HTMLSelectElement) => {
              selectEl = el;
            },
            onChange: (event: Event) => {
              save((event.currentTarget as HTMLSelectElement).value, false);
            },
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === 'Escape') selectEl?.blur();
            }
          },
          KEYWORD_VALUES.map((keyword) =>
            h('option', { value: keyword, selected: keyword === value }, keyword || 'Unset')
          )
        );
      }
    };
    return editor;
  };

  const gridEditors = { keywordSelect: keywordSelectEditor };

  const gridColumns: ColumnRegular[] = [
    {
      prop: 'order',
      name: '#',
      size: 52,
      readonly: true,
      columnType: 'numeric',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cellProperties: (() => ({ style: { fontSize: '0.74rem', color: '#64748b', textAlign: 'center' } })) as any
    },
    {
      prop: 'keyword',
      name: 'Keyword',
      size: 110,
      editor: 'keywordSelect',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cellProperties: ((props: any) => {
        const kw: string = props?.model?.keyword ?? '';
        const color = KW_COLORS[kw] ?? '#64748b';
        return { style: { fontSize: '0.77rem', fontWeight: '800', letterSpacing: '0.04em', color, textTransform: 'uppercase' } };
      }) as any
    },
    {
      prop: 'text',
      name: 'Step Text',
      size: 330,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cellProperties: ((props: any) => {
        const hasError = !!props?.model?._error;
        return hasError ? { style: { borderLeft: '3px solid var(--color-danger, #ef4444)', paddingLeft: '8px' } } : {};
      }) as any
    },
    {
      prop: 'description',
      name: 'Description',
      size: 250
    },
    {
      prop: 'expectation',
      name: 'Expected Result',
      size: 250
    }
  ];

  // ── RevoGrid source (plain objects — no Svelte proxies) ────────
  const gridSource = $derived(rows.map((r) => ({ ...r })));

  // ── RevoGrid event wiring via DOM listener ────────────────────
  $effect(() => {
    const el = gridWrap;
    if (!el) return;

    function handleAfterEdit(evt: Event) {
      const { prop, val, rowIndex } = (evt as CustomEvent<{ prop: string; val: unknown; rowIndex: number; model: Record<string, unknown> }>).detail;
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      rows = validateRows(
        rows.map((r, i) =>
          i === rowIndex ? { ...r, [prop as keyof StepGridRow]: val } : r
        )
      );
      onchange(toBackendSteps(rows));
    }

    function handleAfterFocus(evt: Event) {
      const { rowIndex } = (evt as CustomEvent<{ rowIndex: number }>).detail ?? {};
      if (rowIndex != null) focusedRowIndex = rowIndex;
    }

    el.addEventListener('afteredit', handleAfterEdit);
    el.addEventListener('afterfocus', handleAfterFocus);
    return () => {
      el.removeEventListener('afteredit', handleAfterEdit);
      el.removeEventListener('afterfocus', handleAfterFocus);
    };
  });

  // ── Effective focused row (defaults to 0 when nothing is focused) ──────────
  // This allows toolbar buttons to operate on row 0 even before user clicks a cell.
  function eff() { return focusedRowIndex >= 0 ? focusedRowIndex : 0; }

  // ── Toolbar operations ────────────────────────────────────────
  function addRow() {
    const insertAt = focusedRowIndex >= 0 ? focusedRowIndex + 1 : rows.length;
    const updated = [...rows];
    updated.splice(insertAt, 0, emptyRow(0));
    rows = validateRows(reorder(updated));
    onchange(toBackendSteps(rows));
  }

  function deleteRow() {
    if (rows.length <= 1) return;
    const idx = eff();
    const updated = rows.filter((_, i) => i !== idx);
    rows = validateRows(reorder(updated.length > 0 ? updated : [emptyRow(1)]));
    focusedRowIndex = Math.min(idx, rows.length - 1);
    onchange(toBackendSteps(rows));
  }

  function moveUp() {
    const idx = eff();
    if (idx <= 0 || idx >= rows.length) return;
    const updated = [...rows];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    rows = validateRows(reorder(updated));
    focusedRowIndex = idx - 1;
    onchange(toBackendSteps(rows));
  }

  function moveDown() {
    const idx = eff();
    if (idx >= rows.length - 1) return;
    const updated = [...rows];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    rows = validateRows(reorder(updated));
    focusedRowIndex = idx + 1;
    onchange(toBackendSteps(rows));
  }

  function duplicateRow() {
    const idx = eff();
    if (idx >= rows.length) return;
    const src = rows[idx];
    const dupe: StepGridRow = {
      ...src,
      _id: crypto.randomUUID(),
      order: 0
    };
    const updated = [...rows];
    updated.splice(idx + 1, 0, dupe);
    rows = validateRows(reorder(updated));
    focusedRowIndex = idx + 1;
    onchange(toBackendSteps(rows));
  }

  function normalize() {
    rows = validateRows(reorder(normalizeKeywords(rows)));
    onchange(toBackendSteps(rows));
  }

  function insertParsed(newRows: StepGridRow[]) {
    const insertAt = focusedRowIndex >= 0 ? focusedRowIndex + 1 : rows.length;
    const updated = [...rows];
    updated.splice(insertAt, 0, ...newRows);
    rows = validateRows(reorder(updated));
    onchange(toBackendSteps(rows));
  }

  // ── Keyword color helper for preview mode ─────────────────────
  function kwStyle(kw: string) {
    return `color: ${KW_COLORS[kw] ?? '#64748b'}`;
  }
</script>

<div class="step-editor">
  <!-- Toolbar -->
  {#if !readonly}
    <div class="toolbar">
      <div class="toolbar-group">
        <button title="Add row after focused" onclick={addRow}>+ Row</button>
        <button
          title="Delete focused row (or row 0 if none selected)"
          onclick={deleteRow}
          disabled={rows.length <= 1}
          class="danger-text"
        >Delete</button>
        <span class="divider"></span>
        <button title="Move row up" onclick={moveUp} disabled={eff() <= 0}>↑ Up</button>
        <button
          title="Move row down"
          onclick={moveDown}
          disabled={eff() >= rows.length - 1}
        >↓ Down</button>
        <button title="Duplicate focused row (or row 0 if none selected)" onclick={duplicateRow}
          >Duplicate</button
        >
        <span class="divider"></span>
        <button title="Normalize keywords (capitalize and assign AND)" onclick={normalize}
          >Normalize</button
        >
        <button title="Paste and parse text into steps" onclick={() => (showPasteDialog = true)}
          >Paste & Parse</button
        >
      </div>

      <div class="toolbar-right">
        <select
          class="height-select"
          title="Row height"
          bind:value={rowSize}
          aria-label="Row height"
        >
          <option value={28}>Compact</option>
          <option value={34}>Normal</option>
          <option value={50}>Spacious</option>
        </select>
        <div class="segmented">
          <button class:active={mode === 'edit'} onclick={() => (mode = 'edit')}>Edit</button>
          <button class:active={mode === 'preview'} onclick={() => (mode = 'preview')}
            >Preview</button
          >
        </div>
      </div>
    </div>
  {:else}
    <div class="toolbar readonly-bar">
      <span class="readonly-label">Read-only</span>
      <div class="toolbar-right">
        <select
          class="height-select"
          title="Row height"
          bind:value={rowSize}
          aria-label="Row height"
        >
          <option value={28}>Compact</option>
          <option value={34}>Normal</option>
          <option value={50}>Spacious</option>
        </select>
        <div class="segmented">
          <button class:active={mode === 'edit'} onclick={() => (mode = 'edit')}>Table</button>
          <button class:active={mode === 'preview'} onclick={() => (mode = 'preview')}>Preview</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Grid or Preview -->
  {#if mode === 'edit'}
    <div class="grid-wrap" bind:this={gridWrap}>
      <RevoGrid
        source={gridSource}
        columns={gridColumns}
        editors={gridEditors}
        theme="compact"
        rowSize={rowSize}
        resize={true}
        readonly={readonly}
        externalSourceChanged={gridSource}
      />
    </div>
  {:else}
    <!-- Markdown preview -->
    <div class="preview-wrap">
      {#if rows.filter((r) => r.text.trim()).length === 0}
        <div class="empty-preview">No steps yet. Switch to Edit mode to add steps.</div>
      {:else}
        <ol class="step-preview-list">
          {#each rows.filter((r) => r.text.trim()) as row, i}
            <li class="step-card">
              <div class="step-card-header">
                <span class="step-num">{i + 1}</span>
                {#if row.keyword}
                  <span class="step-kw" style={kwStyle(row.keyword)}>{row.keyword}</span>
                {/if}
              </div>
              <div class="step-card-body">
                <div class="step-text-preview md-content">
                  {@html renderMarkdown(row.text)}
                </div>
                {#if row.description?.trim()}
                  <div class="step-section">
                    <span class="step-section-label">Description</span>
                    <div class="md-content">{@html renderMarkdown(row.description)}</div>
                  </div>
                {/if}
                {#if row.expectation?.trim()}
                  <div class="step-section">
                    <span class="step-section-label">Expected Result</span>
                    <div class="md-content md-expectation">{@html renderMarkdown(row.expectation)}</div>
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  {/if}

  <!-- Footer validation summary -->
  <div class="footer">
    <span class="footer-count">{rows.length} step{rows.length !== 1 ? 's' : ''}</span>
    {#if errorCount > 0}
      <span class="footer-errors">· {errorCount} error{errorCount !== 1 ? 's' : ''}</span>
    {/if}
    {#if warningCount > 0}
      <span class="footer-warnings">· {warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
    {/if}
    {#if focusedRowIndex >= 0}
      <span class="footer-focus">· Row {focusedRowIndex + 1} selected</span>
    {/if}
  </div>
</div>

<!-- Paste & Parse dialog -->
<StepPasteParseDialog
  open={showPasteDialog}
  onclose={() => (showPasteDialog = false)}
  oninsert={insertParsed}
/>

<style>
  .step-editor {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-surface);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-wrap: wrap;
  }
  .readonly-bar { justify-content: space-between; }
  .readonly-label { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600; }
  .toolbar-group { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .toolbar-right { display: flex; align-items: center; gap: 8px; }
  .divider { width: 1px; height: 18px; background: var(--color-border); margin: 0 3px; }

  button {
    font: inherit;
    font-size: 0.78rem;
    padding: 5px 9px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.danger-text { color: var(--color-danger, #ef4444); }
  button.danger-text:hover:not(:disabled) { border-color: var(--color-danger, #ef4444); }
  button.active { background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent), transparent 55%); }

  .height-select {
    font: inherit;
    font-size: 0.75rem;
    padding: 4px 7px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    width: auto;
  }
  .segmented { display: flex; border: 1px solid var(--color-border); border-radius: 5px; overflow: hidden; }
  .segmented button { border: 0; border-radius: 0; padding: 5px 10px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .segmented button.active { background: color-mix(in srgb, var(--color-accent), transparent 85%); color: var(--color-accent); }

  /* Grid */
  .grid-wrap {
    min-height: 240px;
    max-height: 480px;
    overflow: hidden;
  }

  /* Tells RevoGrid to fill the wrapper */
  .grid-wrap :global(revo-grid) {
    height: 100%;
    min-height: 240px;
    max-height: 480px;
    --revo-theme-background: var(--color-surface);
    --revo-theme-header-background: var(--color-bg);
    --revo-theme-border-color: var(--color-border);
    --revo-theme-focus-color: var(--color-accent);
    --revo-theme-selection-color: color-mix(in srgb, var(--color-accent), transparent 80%);
    --revo-theme-text-color: var(--color-text);
  }

  .grid-wrap :global(.keyword-select-editor) {
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    padding: 0 8px;
    outline: none;
  }

  /* Preview */
  .preview-wrap { padding: 16px; max-height: 480px; overflow-y: auto; }
  .empty-preview { font-size: 0.85rem; color: var(--color-text-muted); padding: 24px 0; text-align: center; }

  .step-preview-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .step-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg);
  }
  .step-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: color-mix(in srgb, var(--color-surface), transparent 30%);
    border-bottom: 1px solid var(--color-border);
  }
  .step-num { font-size: 0.72rem; font-weight: 800; color: var(--color-text-muted); min-width: 20px; }
  .step-kw { font-size: 0.73rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .step-card-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
  .step-text-preview { font-size: 0.9rem; font-weight: 600; }
  .step-section { display: flex; flex-direction: column; gap: 3px; border-left: 2px solid var(--color-border); padding-left: 10px; }
  .step-section-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .md-expectation { color: var(--color-success, #0d9488); }

  /* Markdown content */
  .md-content :global(p) { margin: 0 0 6px; font-size: 0.87rem; line-height: 1.55; }
  .md-content :global(p:last-child) { margin-bottom: 0; }
  .md-content :global(code) { font-family: ui-monospace, monospace; font-size: 0.8em; background: color-mix(in srgb, var(--color-accent), transparent 88%); border-radius: 3px; padding: 1px 4px; }
  .md-content :global(pre) { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; margin: 4px 0; overflow-x: auto; }
  .md-content :global(pre code) { background: transparent; padding: 0; font-size: 0.82em; }
  .md-content :global(strong) { font-weight: 700; }
  .md-content :global(em) { font-style: italic; }

  /* Footer */
  .footer {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }
  .footer-errors { color: var(--color-danger, #ef4444); font-weight: 700; }
  .footer-warnings { color: #d97706; font-weight: 600; }
  .footer-focus { opacity: 0.7; }
</style>

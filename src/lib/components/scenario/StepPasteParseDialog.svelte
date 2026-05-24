<script lang="ts">
  import { parseStepsFromText } from '$lib/features/steps/step-parser';
  import type { StepGridRow } from './step-grid.types';
  import Modal from '$lib/components/Modal.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    oninsert: (rows: StepGridRow[]) => void;
  }

  let { open, onclose, oninsert }: Props = $props();

  let rawText = $state('');
  const preview = $derived(rawText.trim() ? parseStepsFromText(rawText) : []);
  const kwColor: Record<string, string> = {
    GIVEN: '#8b5cf6',
    WHEN: '#d97706',
    THEN: '#0d9488',
    AND: '#64748b',
    BUT: '#64748b'
  };

  function handleInsert() {
    if (preview.length === 0) return;
    oninsert(preview);
    rawText = '';
    onclose();
  }

  function handleClose() {
    rawText = '';
    onclose();
  }
</script>

<Modal {open} title="Paste & Parse Steps" onclose={handleClose}>
  <div class="pp-form">
    <p class="hint">
      Paste plain text, Gherkin steps, numbered lists, or bullet lists. Setara will detect the
      format and split into step rows.
    </p>

    <label>
      <span>Text to parse</span>
      <textarea
        bind:value={rawText}
        rows="10"
        placeholder="Given user has an unpaid order&#10;When user selects BCA VA&#10;Then VA number is generated"
      ></textarea>
    </label>

    {#if preview.length > 0}
      <div class="preview-block">
        <p class="preview-title">{preview.length} step{preview.length !== 1 ? 's' : ''} detected</p>
        <ol class="preview-list">
          {#each preview as row}
            <li class="preview-row">
              {#if row.keyword}
                <span class="kw-chip" style="color: {kwColor[row.keyword] ?? '#64748b'}"
                  >{row.keyword}</span
                >
              {/if}
              <span class="step-text">{row.text}</span>
            </li>
          {/each}
        </ol>
      </div>
    {:else if rawText.trim()}
      <p class="hint muted">Nothing detected yet.</p>
    {/if}

    <div class="actions">
      <button onclick={handleClose}>Cancel</button>
      <button class="primary-btn" onclick={handleInsert} disabled={preview.length === 0}>
        Insert {preview.length > 0 ? preview.length : ''} Step{preview.length !== 1 ? 's' : ''}
      </button>
    </div>
  </div>
</Modal>

<style>
  .pp-form { display: flex; flex-direction: column; gap: 14px; }
  .hint { font-size: 0.83rem; color: var(--color-text-muted); margin: 0; }
  .hint.muted { opacity: 0.65; }
  label { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; font-weight: 600; }
  textarea { font: inherit; font-family: ui-monospace, monospace; font-size: 0.82rem; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); resize: vertical; min-height: 140px; }
  textarea:focus { outline: none; border-color: var(--color-accent); }
  .preview-block { background: color-mix(in srgb, var(--color-accent), transparent 92%); border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%); border-radius: 8px; padding: 12px 14px; }
  .preview-title { font-size: 0.78rem; font-weight: 700; color: var(--color-accent); margin: 0 0 8px; }
  .preview-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .preview-row { display: flex; align-items: flex-start; gap: 7px; font-size: 0.83rem; list-style: decimal; }
  .kw-chip { font-size: 0.73rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; flex-shrink: 0; padding-top: 1px; }
  .step-text { color: var(--color-text); line-height: 1.45; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { font: inherit; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); border-radius: 6px; padding: 8px 14px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .primary-btn { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  .primary-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent), #000 12%); color: #fff; }
</style>

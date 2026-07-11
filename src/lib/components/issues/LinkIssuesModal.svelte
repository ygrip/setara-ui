<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { linkIssues, type LinkIssuesResult } from '$lib/api/issues';
  import { notify } from '$lib/ui/feedback/notify';

  let {
    open,
    onclose,
    onlinked,
    planId,
    buildId,
    executionId
  }: {
    open: boolean;
    onclose: () => void;
    onlinked: () => void;
    planId?: string;
    buildId?: string;
    executionId?: string;
  } = $props();

  let rawKeys = $state('');
  let busy = $state(false);
  let error = $state('');
  let result = $state<LinkIssuesResult | null>(null);

  function parseKeys(text: string): string[] {
    return [...new Set(text.split(/[\s,]+/).map((k) => k.trim().toUpperCase()).filter(Boolean))];
  }

  async function handleSubmit() {
    const keys = parseKeys(rawKeys);
    if (keys.length === 0) {
      error = 'Enter at least one issue key';
      return;
    }
    busy = true;
    error = '';
    result = null;
    try {
      const res = await linkIssues({ issueKeys: keys, planId, buildId, executionId });
      result = res;
      if (res.linked.length > 0) {
        onlinked();
        notify.success(`Linked ${res.linked.length} issue${res.linked.length === 1 ? '' : 's'}`);
      }
      if (res.failed.length === 0) {
        rawKeys = '';
      } else {
        notify.error(res.failed.map((f) => `${f.issueKey}: ${f.reason}`).join('; '));
      }
    } catch (e) {
      error = (e as Error).message;
      notify.error(error);
    } finally {
      busy = false;
    }
  }

  function handleClose() {
    rawKeys = '';
    error = '';
    result = null;
    onclose();
  }
</script>

<Modal {open} title="Link Issues" size="sm" onclose={handleClose}>
  <p class="hint">Paste issue keys separated by commas, spaces, or new lines.</p>
  <textarea class="keys-input" bind:value={rawKeys} rows="4" placeholder="QA-101, QA-102"></textarea>
  {#if error}<p class="form-error">{error}</p>{/if}
  {#if result}
    <div class="result">
      {#if result.linked.length > 0}
        <p class="result-ok">Linked: {result.linked.map((l) => l.issueKey).join(', ')}</p>
      {/if}
      {#if result.alreadyLinked.length > 0}
        <p class="result-info">Already linked: {result.alreadyLinked.join(', ')}</p>
      {/if}
      {#if result.failed.length > 0}
        <p class="result-fail">Failed: {result.failed.map((f) => `${f.issueKey} (${f.reason})`).join(', ')}</p>
      {/if}
    </div>
  {/if}
  <div class="modal-actions">
    <Button variant="secondary" size="sm" onclick={handleClose}>Close</Button>
    <Button variant="primary" size="sm" onclick={handleSubmit} disabled={busy || !rawKeys.trim()}>
      {busy ? 'Linking…' : 'Link issues'}
    </Button>
  </div>
</Modal>

<style>
  .hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin-bottom: 8px;
  }

  .keys-input {
    width: 100%;
    resize: vertical;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
  }

  .form-error {
    color: var(--color-danger);
    font-size: 0.8125rem;
    margin-top: 8px;
  }

  .result {
    margin-top: 12px;
    font-size: 0.8125rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-ok {
    color: var(--color-success);
  }

  .result-info {
    color: var(--color-text-muted);
  }

  .result-fail {
    color: var(--color-danger);
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 16px;
  }
</style>

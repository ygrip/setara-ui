<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';

  let {
    open = false,
    keyName = '',
    mode = 'rotate',
    onconfirm,
    onclose
  }: {
    open?: boolean;
    keyName?: string;
    mode?: 'rotate' | 'revoke';
    onconfirm?: () => void;
    onclose?: () => void;
  } = $props();
</script>

<Modal {open} title={mode === 'revoke' ? 'Revoke API key' : 'Rotate API key'} {onclose}>
  <div class="api-key-modal">
    {#if mode === 'revoke'}
      <p>Revoke <strong>{keyName}</strong>? Automation runners using this key will stop sending results.</p>
    {:else}
      <p>Rotate <strong>{keyName}</strong>? The old key will stop working immediately and the new raw key will be shown once.</p>
    {/if}
    <div class="api-key-modal__actions">
      <Button variant="secondary" onclick={onclose}>Cancel</Button>
      <Button variant={mode === 'revoke' ? 'danger' : 'primary'} onclick={onconfirm}>
        {mode === 'revoke' ? 'Revoke Key' : 'Rotate Key'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .api-key-modal {
    display: grid;
    gap: 16px;
  }

  .api-key-modal p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }

  .api-key-modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  @media (max-width: 520px) {
    .api-key-modal__actions {
      flex-direction: column-reverse;
    }

    .api-key-modal__actions :global(.btn) {
      width: 100%;
    }
  }
</style>


<script lang="ts">
  import AppToast from './AppToast.svelte';
  import { dismiss, toasts } from './notify';
</script>

{#if $toasts.length > 0}
  <section class="app-toast-viewport" aria-label="Notifications">
    {#each $toasts as toast (toast.id)}
      <AppToast
        tone={toast.tone}
        title={toast.title}
        message={toast.message}
        onclose={() => dismiss(toast.id)}
      />
    {/each}
  </section>
{/if}

<style>
  .app-toast-viewport {
    position: fixed;
    right: max(16px, env(safe-area-inset-right));
    bottom: max(16px, env(safe-area-inset-bottom));
    z-index: 320;
    display: grid;
    gap: 10px;
    width: min(380px, calc(100vw - 32px));
    pointer-events: none;
  }

  .app-toast-viewport :global(.app-toast) {
    pointer-events: auto;
  }

  @media (max-width: 520px) {
    .app-toast-viewport {
      right: 12px;
      left: 12px;
      bottom: 12px;
      width: auto;
    }
  }
</style>


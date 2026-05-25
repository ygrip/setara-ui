<script lang="ts">
  import SetaraLoader from './SetaraLoader.svelte';

  let {
    active = false,
    label = 'Loading',
    delay = false
  }: {
    active?: boolean;
    label?: string;
    delay?: boolean;
  } = $props();
</script>

{#if active}
  <div class="loading-overlay" class:loading-overlay--delay={delay} role="status" aria-live="polite">
    <div class="loading-panel">
      <SetaraLoader mode="progress" size={72} label={label} />
      <span>{label}</span>
    </div>
  </div>
{/if}

<style>
  .loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 260;
    display: grid;
    place-items: center;
    padding: 24px;
    background: color-mix(in srgb, var(--color-bg), transparent 18%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .loading-overlay--delay {
    animation: reveal 0.18s ease both;
    animation-delay: 0.18s;
  }

  .loading-panel {
    display: grid;
    justify-items: center;
    gap: 12px;
    min-width: 172px;
    padding: 22px 24px;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-surface), transparent 8%);
    box-shadow: var(--shadow-md);
  }

  .loading-panel span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
    font-weight: 700;
  }

  @keyframes reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>

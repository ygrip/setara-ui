<script lang="ts">
  export type AppTab = {
    id: string;
    label: string;
    disabled?: boolean;
  };

  let {
    tabs,
    active,
    onchange
  }: {
    tabs: AppTab[];
    active: string;
    onchange?: (id: string) => void;
  } = $props();
</script>

<div class="app-tabs" role="tablist">
  {#each tabs as tab}
    <button
      type="button"
      role="tab"
      aria-selected={active === tab.id}
      disabled={tab.disabled}
      class:active={active === tab.id}
      onclick={() => onchange?.(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .app-tabs {
    display: flex;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    scrollbar-width: thin;
  }

  .app-tabs button {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 7px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-weight: 800;
    white-space: nowrap;
  }

  .app-tabs button.active {
    background: var(--color-surface);
    color: var(--color-accent);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
  }

  .app-tabs button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>


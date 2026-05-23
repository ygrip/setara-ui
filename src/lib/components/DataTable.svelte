<script lang="ts">
  let {
    head,
    body
  }: {
    head?: import('svelte').Snippet;
    body?: import('svelte').Snippet;
  } = $props();
</script>

<div class="table-wrap">
  <table class="table">
    <thead>
      {@render head?.()}
    </thead>
    <tbody>
      {@render body?.()}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .table :global(th) {
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .table :global(td) {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
    vertical-align: middle;
  }

  .table :global(tr:last-child td) {
    border-bottom: none;
  }

  .table :global(tr:hover td) {
    background: var(--color-accent-subtle);
  }

  .table :global(.sort-button) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-transform: inherit;
    letter-spacing: inherit;
    cursor: pointer;
  }

  .table :global(.sort-button:hover) {
    color: var(--color-accent);
  }

  .table :global(.sort-indicator) {
    color: var(--color-accent);
    font-size: 0.72rem;
  }
</style>

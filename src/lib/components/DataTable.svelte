<script lang="ts">
  let {
    head,
    body,
    /** When true, rows collapse to stacked key-value cards on mobile.
     *  Each <td> must have a data-label attribute for the column name. */
    mobileCards = false
  }: {
    head?: import('svelte').Snippet;
    body?: import('svelte').Snippet;
    mobileCards?: boolean;
  } = $props();
</script>

<div class="table-wrap" class:table-wrap--cards={mobileCards}>
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
    /* Subtle scroll shadow — indicates more content to the right */
    background:
      linear-gradient(to right, var(--color-surface) 20px, transparent 60px) left center / 60px 100% no-repeat,
      linear-gradient(to left,  var(--color-surface) 20px, transparent 60px) right center / 60px 100% no-repeat,
      linear-gradient(to right, rgba(0,0,0,0.04) 0px, transparent 14px) left center / 14px 100% no-repeat,
      linear-gradient(to left,  rgba(0,0,0,0.04) 0px, transparent 14px) right center / 14px 100% no-repeat;
    background-attachment: local, local, scroll, scroll;
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

  /* ── Mobile card mode ─────────────────────────────────────────── */
  /* When mobileCards=true: each <tr> becomes an independent card,
     <thead> is visually hidden but kept for screen readers,
     <td> shows its data-label as a leading label. */
  @media (max-width: 640px) {
    .table-wrap--cards {
      border: none;
      background: none;
      overflow-x: visible;
    }

    .table-wrap--cards .table {
      display: block;
    }

    .table-wrap--cards .table :global(thead) {
      /* visually hidden — keep for a11y */
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

    .table-wrap--cards .table :global(tbody) {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .table-wrap--cards .table :global(tr) {
      display: block;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }

    .table-wrap--cards .table :global(tr:hover td) {
      background: transparent;
    }

    .table-wrap--cards .table :global(tr:hover) {
      border-color: var(--color-accent);
    }

    .table-wrap--cards .table :global(td) {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.875rem;
    }

    .table-wrap--cards .table :global(td:last-child) {
      border-bottom: none;
    }

    /* Show column label from data-label attribute */
    .table-wrap--cards .table :global(td[data-label]::before) {
      content: attr(data-label);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      flex-shrink: 0;
      min-width: 80px;
      padding-top: 2px;
    }

    /* Hide empty-label cells' ::before (e.g. action column) */
    .table-wrap--cards .table :global(td[data-label=""]::before) {
      display: none;
    }
    .table-wrap--cards .table :global(td[data-label=""]) {
      justify-content: flex-end;
    }
  }
</style>

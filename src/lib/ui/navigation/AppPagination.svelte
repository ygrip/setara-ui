<script lang="ts">
  let {
    page = 1,
    totalPages = 1,
    onpage
  }: {
    page?: number;
    totalPages?: number;
    onpage?: (page: number) => void;
  } = $props();

  let safePage = $derived(Math.min(Math.max(1, page), Math.max(1, totalPages)));
</script>

<nav class="app-pagination" aria-label="Pagination">
  <button type="button" disabled={safePage <= 1} onclick={() => onpage?.(safePage - 1)}>Previous</button>
  <span>Page {safePage} of {Math.max(1, totalPages)}</span>
  <button type="button" disabled={safePage >= totalPages} onclick={() => onpage?.(safePage + 1)}>Next</button>
</nav>

<style>
  .app-pagination {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .app-pagination span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
    font-weight: 700;
  }

  .app-pagination button {
    min-height: 34px;
    padding: 7px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    font-weight: 700;
  }

  .app-pagination button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>


<script lang="ts">
  let { children }: { children?: import('svelte').Snippet } = $props();
</script>

<div class="card">
  {@render children?.()}
</div>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
  }
</style>

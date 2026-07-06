<script lang="ts">
  import type { DashboardAttentionItem } from '$lib/api/dashboard';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { AppSkeleton } from '$lib/ui/display';
  import AttentionItem from './AttentionItem.svelte';

  let {
    items,
    loading = false,
    unavailable = false
  }: {
    items: DashboardAttentionItem[];
    loading?: boolean;
    unavailable?: boolean;
  } = $props();
</script>

<section class="attention-panel surface-card" aria-labelledby="attention-title">
  <div class="attention-header">
    <div>
      <h2 id="attention-title">Needs attention</h2>
      <p>Projects that may need a closer look.</p>
    </div>
    {#if items.length > 0}<span class="attention-total">{items.length}</span>{/if}
  </div>

  {#if loading}
    <div class="attention-loading" role="status" aria-label="Loading attention items">
      {#each Array(3) as _}
        <div class="attention-skeleton"><AppSkeleton height="54px" /></div>
      {/each}
    </div>
  {:else if unavailable}
    <EmptyState
      title="Quality signals unavailable"
      hint="Attention signals will appear when dashboard history is available."
      minHeight="224px"
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
        </svg>
      </svelte:fragment>
    </EmptyState>
  {:else if items.length === 0}
    <EmptyState
      title="No urgent issues"
      hint="Active projects are within the current quality thresholds."
      minHeight="224px"
    >
      <svelte:fragment slot="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l7 3v5c0 4.6-2.9 8.3-7 10-4.1-1.7-7-5.4-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>
        </svg>
      </svelte:fragment>
    </EmptyState>
  {:else}
    <div class="attention-list" role="list">
      {#each items as item (`${item.projectId}:${item.type}`)}
        <div role="listitem"><AttentionItem {item} /></div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .attention-panel {
    min-width: 0;
    padding: 18px;
    border-radius: var(--radius);
  }

  .attention-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 750;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .attention-total {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    border-radius: 999px;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning), transparent 87%);
    font-size: 0.72rem;
    font-weight: 800;
  }

  .attention-list > :global(div:first-child .attention-item) {
    border-top: 0;
  }

  .attention-loading {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }

  .attention-skeleton {
    padding-top: 8px;
    border-top: 1px solid color-mix(in srgb, var(--color-border), transparent 35%);
  }

</style>

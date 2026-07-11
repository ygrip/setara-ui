<script lang="ts">
  import type { DashboardAttentionItem } from '$lib/api/dashboard';
  import QualityStatusBadge from './QualityStatusBadge.svelte';

  let { item }: { item: DashboardAttentionItem } = $props();

  const severityLabel = $derived.by(() => {
    if (item.severity === 'CRITICAL') return 'Critical issue';
    if (item.severity === 'HIGH') return 'High priority';
    if (item.severity === 'MEDIUM') return 'Needs review';
    return 'Low priority';
  });
</script>

<a class="attention-item" href="/projects/{item.projectKey}">
  <span class="attention-icon attention-icon--{item.severity.toLowerCase()}" aria-label={severityLabel}>!</span>
  <span class="attention-copy">
    <span class="attention-title-row">
      <span class="attention-title">{item.title}</span>
      <QualityStatusBadge status={item.status} />
    </span>
    <span class="attention-description">{item.description}</span>
  </span>
  <span class="attention-meta">
    {#if item.affectedCount !== null && item.affectedLabel}
      <span class="attention-count">{item.affectedCount} {item.affectedLabel}</span>
    {/if}
    <span class="attention-arrow" aria-hidden="true">→</span>
  </span>
</a>

<style>
  .attention-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 11px;
    align-items: center;
    padding: 14px 0;
    color: inherit;
    text-decoration: none;
    border-top: 1px solid color-mix(in srgb, var(--color-border), transparent 35%);
  }

  .attention-item:hover .attention-title,
  .attention-item:focus-visible .attention-title {
    color: var(--color-accent);
  }

  .attention-item:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .attention-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    font-size: 0.78rem;
    font-weight: 850;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-border), transparent 60%);
  }

  .attention-icon--critical,
  .attention-icon--high {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger), transparent 87%);
  }

  .attention-icon--medium {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning), transparent 87%);
  }

  .attention-copy {
    min-width: 0;
  }

  .attention-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .attention-title {
    color: var(--color-text);
    font-size: 0.84rem;
    font-weight: 750;
    transition: color 0.14s ease;
  }

  .attention-description {
    display: block;
    margin-top: 3px;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    line-height: 1.4;
  }

  .attention-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-muted);
  }

  .attention-count {
    max-width: 92px;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.25;
    text-align: right;
  }

  .attention-arrow {
    color: var(--color-accent);
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    .attention-item {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .attention-meta {
      grid-column: 2;
      justify-content: flex-start;
    }

    .attention-count {
      max-width: none;
      text-align: left;
    }
  }
</style>

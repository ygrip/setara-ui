<script lang="ts">
  import type { AppTone } from '$lib/ui/types';

  export type AppTimelineItem = {
    id: string;
    title: string;
    detail?: string;
    meta?: string;
    tone?: AppTone;
  };

  let {
    items
  }: {
    items: AppTimelineItem[];
  } = $props();
</script>

<ol class="app-timeline">
  {#each items as item}
    <li class="app-timeline__item app-timeline__item--{item.tone ?? 'neutral'}">
      <span class="app-timeline__dot" aria-hidden="true"></span>
      <div class="app-timeline__content">
        <div class="app-timeline__top">
          <strong>{item.title}</strong>
          {#if item.meta}<span>{item.meta}</span>{/if}
        </div>
        {#if item.detail}<p>{item.detail}</p>{/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .app-timeline {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .app-timeline__item {
    --timeline-accent: var(--color-text-muted);
    position: relative;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 10px;
    min-width: 0;
    padding: 0 0 14px;
  }

  .app-timeline__item:not(:last-child)::before {
    content: "";
    position: absolute;
    top: 17px;
    bottom: -1px;
    left: 8px;
    width: 2px;
    background: color-mix(in srgb, var(--timeline-accent), transparent 74%);
  }

  .app-timeline__dot {
    z-index: 1;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    border: 3px solid color-mix(in srgb, var(--timeline-accent), transparent 64%);
    border-radius: 999px;
    background: var(--color-surface);
    box-shadow: 0 0 0 3px var(--color-surface);
  }

  .app-timeline__content {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .app-timeline__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .app-timeline__top strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .app-timeline__top span,
  .app-timeline__content p {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .app-timeline__content p {
    margin: 0;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .app-timeline__item--success { --timeline-accent: var(--color-success); }
  .app-timeline__item--error { --timeline-accent: var(--color-danger); }
  .app-timeline__item--warning { --timeline-accent: var(--color-warning); }
  .app-timeline__item--info { --timeline-accent: var(--color-info); }
  .app-timeline__item--neutral { --timeline-accent: var(--color-text-muted); }

  @media (max-width: 520px) {
    .app-timeline__top {
      display: grid;
      gap: 2px;
    }
  }
</style>


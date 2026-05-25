<script lang="ts">
  import { renderMarkdown } from '$lib/markdown';

  let {
    value,
    collapsedHeight = 220
  }: {
    value: string | null | undefined;
    collapsedHeight?: number;
  } = $props();

  let expanded = $state(false);
  const needsCollapse = $derived((value?.length ?? 0) > 900 || (value?.split('\n').length ?? 0) > 14);
</script>

{#if value?.trim()}
  <div class="markdown-block" class:markdown-block--collapsed={needsCollapse && !expanded}>
    <div class="markdown-content" style={needsCollapse && !expanded ? `max-height:${collapsedHeight}px` : undefined}>
      {@html renderMarkdown(value)}
    </div>
    {#if needsCollapse}
      <button class="markdown-toggle" type="button" onclick={() => (expanded = !expanded)}>
        {expanded ? 'Collapse' : 'Expand'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .markdown-block {
    position: relative;
    min-width: 0;
  }

  .markdown-content {
    overflow: auto;
    border-radius: 8px;
  }

  .markdown-block--collapsed .markdown-content {
    border-bottom: 1px solid var(--color-border);
  }

  .markdown-block--collapsed::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 34px;
    height: 44px;
    pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--color-bg));
  }

  .markdown-toggle {
    margin-top: 6px;
    border: 0;
    background: transparent;
    color: var(--color-accent);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
    padding: 2px 0;
  }

  .markdown-toggle:hover {
    text-decoration: underline;
  }

  .markdown-content :global(p) {
    margin: 0 0 6px;
    line-height: 1.55;
  }

  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .markdown-content :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.84em;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border-radius: 4px;
    padding: 1px 4px;
  }

  .markdown-content :global(pre) {
    max-height: 360px;
    overflow: auto;
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid color-mix(in srgb, var(--color-border), #000 20%);
    border-radius: 8px;
    padding: 12px 14px;
    margin: 6px 0;
  }

  .markdown-content :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.82rem;
    white-space: pre;
  }

  .markdown-content :global(table) {
    display: block;
    width: max-content;
    max-width: 100%;
    max-height: 320px;
    overflow: auto;
    border-collapse: collapse;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin: 6px 0;
    font-size: 0.82rem;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border-bottom: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    padding: 7px 10px;
    text-align: left;
    vertical-align: top;
    white-space: pre-wrap;
  }

  .markdown-content :global(th) {
    background: var(--color-accent-subtle);
    color: var(--color-text);
    font-weight: 800;
  }
</style>

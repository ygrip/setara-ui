<script lang="ts">
  let {
    availableTags = [] as { sanitized: string; display: string }[],
    selectedTags = [] as string[],
    tagMode = 'ANY' as 'ANY' | 'ALL',
    onchange = (_tags: string[], _mode: string) => {}
  } = $props();

  let showDropdown = $state(false);

  function toggleTag(sanitized: string) {
    const next = selectedTags.includes(sanitized)
      ? selectedTags.filter(t => t !== sanitized)
      : [...selectedTags, sanitized];
    onchange(next, tagMode);
  }

  function toggleMode() {
    const next = tagMode === 'ANY' ? 'ALL' : 'ANY';
    onchange(selectedTags, next);
  }

  function clearAll() {
    onchange([], tagMode);
  }

  const hasSelection = $derived(selectedTags.length > 0);
</script>

<div class="tag-filter-bar">
  <div class="tag-filter-trigger" onclick={() => showDropdown = !showDropdown} onkeydown={(e) => e.key === 'Enter' && (showDropdown = !showDropdown)} role="button" tabindex="0" aria-label="Filter by tags">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
    <span>Tags</span>
    {#if hasSelection}
      <span class="tag-filter-count">{selectedTags.length}</span>
    {/if}
  </div>

  {#if hasSelection}
    <div class="tag-filter-selected">
      {#each selectedTags as tag}
        <span class="tag-filter-chip" onclick={() => toggleTag(tag)} onkeydown={(e) => e.key === 'Enter' && toggleTag(tag)} role="button" tabindex="0">
          {tag} ×
        </span>
      {/each}
      <button class="tag-filter-mode" onclick={toggleMode} title={tagMode === 'ANY' ? 'Match ANY tag' : 'Match ALL tags'}>
        {tagMode}
      </button>
      <button class="tag-filter-clear" onclick={clearAll}>Clear</button>
    </div>
  {/if}

  {#if showDropdown}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tag-filter-backdrop" onclick={() => showDropdown = false}></div>
    <div class="tag-filter-dropdown">
      {#if availableTags.length === 0}
        <p class="tag-filter-empty">No tags available in this project.</p>
      {:else}
        {#each availableTags as tag}
          <label class="tag-filter-option">
            <input
              type="checkbox"
              checked={selectedTags.includes(tag.sanitized)}
              onchange={() => toggleTag(tag.sanitized)}
            />
            <span class="tag-option-label">{tag.display}</span>
            <span class="tag-option-sanitized">{tag.sanitized}</span>
          </label>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-filter-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }
  .tag-filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  .tag-filter-trigger:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .tag-filter-count {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--color-accent);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0 4px;
  }
  .tag-filter-selected {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag-filter-chip {
    display: inline-flex;
    padding: 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent), transparent 86%);
    color: var(--color-accent);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }
  .tag-filter-chip:hover {
    background: color-mix(in srgb, var(--color-accent), transparent 75%);
  }
  .tag-filter-mode {
    padding: 3px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 800;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tag-filter-mode:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .tag-filter-clear {
    padding: 3px 8px;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    text-decoration: underline;
  }
  .tag-filter-backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
  }
  .tag-filter-dropdown {
    position: absolute;
    top: 100%;
    left: 16px;
    right: 0;
    z-index: 50;
    min-width: 220px;
    max-width: min(320px, calc(100vw - 32px));
    max-height: 240px;
    overflow-y: auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag-filter-empty {
    padding: 12px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    margin: 0;
  }
  .tag-filter-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .tag-filter-option:hover {
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
  }
  .tag-option-label {
    flex: 1;
    font-weight: 600;
  }
  .tag-option-sanitized {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }
</style>

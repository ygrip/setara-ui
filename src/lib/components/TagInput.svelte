<script lang="ts">
  import type { TagView, TagInput as TagInputType } from '$lib/api/testcases';

  type TagSuggestion = { sanitized: string; display: string };

  let {
    tags = [] as TagView[],
    suggestions = [] as TagSuggestion[],
    onchange = (_tags: TagInputType[]) => {},
    maxTags = 20,
    disabled = false,
    readonly = false
  } = $props();

  let inputValue = $state('');
  let showDropdown = $state(false);

  const remaining = $derived(maxTags - tags.length);

  const filteredSuggestions = $derived(
    inputValue.trim().length >= 1
      ? suggestions
          .filter(s => {
            const label = (s.display || s.sanitized).toLowerCase();
            const q = inputValue.trim().toLowerCase();
            return label.startsWith(q) && !tags.some(t => t.sanitized === s.sanitized);
          })
          .slice(0, 8)
      : suggestions
          .filter(s => !tags.some(t => t.sanitized === s.sanitized))
          .slice(0, 8)
  );
  const showSuggestionDropdown = $derived(showDropdown && filteredSuggestions.length > 0 && !disabled && !readonly && remaining > 0);

  function addFromSuggestion(suggestion: TagSuggestion) {
    if (remaining <= 0 || disabled || readonly) return;
    if (tags.some(t => t.sanitized === suggestion.sanitized)) return;
    onchange([...tags.map(t => ({ sanitized: t.sanitized, display: t.display })), { sanitized: suggestion.sanitized, display: suggestion.display }]);
    inputValue = '';
  }

  function addTag(display: string) {
    const trimmed = display.trim();
    if (!trimmed || remaining <= 0 || disabled || readonly) return;
    if (tags.some(t => t.display.toLowerCase() === trimmed.toLowerCase())) return;
    const newTags = [...tags.map(t => ({ sanitized: t.sanitized, display: t.display })), { display: trimmed }];
    onchange(newTags);
    inputValue = '';
  }

  function removeTag(index: number) {
    if (disabled || readonly) return;
    const newTags = tags.filter((_, i) => i !== index).map(t => ({ sanitized: t.sanitized, display: t.display }));
    onchange(newTags);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }
</script>

<div class="tag-input-wrap" class:disabled class:readonly>
  <div class="tag-chips">
    {#each tags as tag, i}
      <span class="tag-chip">
        <span class="tag-text">{tag.display}</span>
        {#if !readonly && !disabled}
          <button class="tag-remove" onclick={() => removeTag(i)} aria-label="Remove tag">×</button>
        {/if}
      </span>
    {/each}
  </div>
  {#if !readonly}
    <div class="tag-input-row">
      <input
        class="tag-input"
        type="text"
        placeholder={remaining > 0 ? `Add tag… (${remaining} left)` : 'Max tags reached'}
        bind:value={inputValue}
        onkeydown={handleKeydown}
        onfocus={() => showDropdown = true}
        onblur={() => setTimeout(() => showDropdown = false, 150)}
        disabled={disabled || remaining <= 0}
        maxlength={128}
        aria-label="Add tag"
      />
      {#if showSuggestionDropdown}
        <ul class="tag-suggestions" role="listbox">
          {#each filteredSuggestions as sug}
            <li class="tag-suggestion-item" role="option" aria-selected="false">
              <button
                type="button"
                class="tag-suggestion-btn"
                onmousedown={(e) => { e.preventDefault(); addFromSuggestion(sug); }}
              >
                {sug.display || sug.sanitized}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if inputValue.trim()}
        <button class="tag-add-btn" onclick={() => addTag(inputValue)} disabled={remaining <= 0}>
          + Add
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-input-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent), transparent 86%);
    color: var(--color-accent);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .tag-text {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag-remove {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-accent), transparent 50%);
    color: #fff;
    font-size: 0.7rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .tag-remove:hover {
    background: var(--color-accent);
  }
  .tag-input-row {
    display: flex;
    gap: 4px;
    align-items: center;
    position: relative;
  }
  .tag-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.82rem;
  }
  .tag-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }
  .tag-add-btn {
    padding: 6px 12px;
    border: 1px solid var(--color-accent);
    border-radius: 6px;
    background: transparent;
    color: var(--color-accent);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .tag-add-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-accent), transparent 90%);
  }
  .tag-add-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .disabled { opacity: 0.6; }
  .tag-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    list-style: none;
    margin: 0;
    padding: 4px;
    max-height: 220px;
    overflow-y: auto;
  }
  .tag-suggestion-item { margin: 0; }
  .tag-suggestion-btn {
    width: 100%;
    text-align: left;
    padding: 7px 12px;
    border: 0;
    background: transparent;
    border-radius: 6px;
    font: inherit;
    font-size: 0.82rem;
    color: var(--color-text);
    cursor: pointer;
  }
  .tag-suggestion-btn:hover {
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    color: var(--color-accent);
  }
</style>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { mockProjects } from '$lib/mock/data';

  let {
    open,
    onclose
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  type NavPage = { label: string; href: string; type: 'page'; icon: string };
  type ProjectResult = { label: string; href: string; type: 'project'; key: string; icon: string };
  type Result = NavPage | ProjectResult;

  const pages: NavPage[] = [
    { label: 'Dashboard', href: '/dashboard', type: 'page', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { label: 'Projects', href: '/projects', type: 'page', icon: 'M3 7h18M3 12h18M3 17h18' },
    { label: 'Settings', href: '/admin', type: 'page', icon: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z' },
    { label: 'Workspace', href: '/workspace', type: 'page', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ];

  let query = $state('');
  let activeIndex = $state(0);
  let hintIndex = $state(0);

  const hints = [
    'Search projects, pages…',
    'Find test scenarios…',
    'Jump to executions…',
    'Search by run status…',
    'Go to release plans…',
    'Find coverage reports…',
  ];

  $effect(() => {
    if (!open) return;
    const id = setInterval(() => {
      hintIndex = (hintIndex + 1) % hints.length;
    }, 2600);
    return () => clearInterval(id);
  });

  const filteredResults: Result[] = $derived(
    (() => {
      const q = query.toLowerCase().trim();
      if (!q) return pages.slice(0, 5) as Result[];

      const matchedPages = pages.filter(p => p.label.toLowerCase().includes(q));
      const matchedProjects: ProjectResult[] = mockProjects
        .filter(p => p.name.toLowerCase().includes(q) || p.projectKey.toLowerCase().includes(q))
        .map(p => ({
          label: p.name,
          href: `/projects/${p.projectKey}`,
          type: 'project' as const,
          key: p.projectKey,
          icon: 'M3 7h18M3 12h18M3 17h18'
        }));

      return [...matchedPages, ...matchedProjects].slice(0, 5) as Result[];
    })()
  );

  $effect(() => {
    if (open) {
      query = '';
      activeIndex = 0;
    }
  });

  function navigate(href: string) {
    onclose();
    goto(href);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filteredResults.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      const item = filteredResults[activeIndex];
      if (item) navigate(item.href);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="palette-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    tabindex="-1"
  >
    <div class="palette-panel">
      <!-- Search row -->
      <div class="palette-search-row">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <div class="palette-input-wrap">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="palette-input"
            type="text"
            placeholder=" "
            bind:value={query}
            autofocus
            autocomplete="off"
            spellcheck="false"
          />
          {#if !query}
            {#key hintIndex}
              <span class="palette-hint" aria-hidden="true">{hints[hintIndex]}</span>
            {/key}
          {/if}
        </div>
        <kbd class="palette-esc-hint">Esc</kbd>
      </div>

      <!-- Results -->
      <div class="palette-results">
        {#if filteredResults.length === 0}
          <p class="palette-empty">No results for "{query}"</p>
        {:else}
          {#each filteredResults as result, i (result.href)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              role="option"
              aria-selected={i === activeIndex}
              tabindex="-1"
              class="palette-result-item"
              class:palette-result-item--active={i === activeIndex}
              onclick={() => navigate(result.href)}
              onmouseenter={() => activeIndex = i}
            >
              <span class="result-icon-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d={result.icon}/>
                </svg>
              </span>
              <span class="result-label">{result.label}</span>
              {#if result.type === 'project'}
                <span class="result-badge">{result.key}</span>
              {:else}
                <span class="result-type">Page</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .palette-panel {
    max-width: 580px;
    width: 90%;
    margin: 12vh auto 0;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(28px) saturate(200%);
    -webkit-backdrop-filter: blur(28px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  :global([data-theme="dark"]) .palette-panel {
    background: rgba(11, 18, 32, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .palette-search-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .palette-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .palette-input {
    width: 100%;
    background: none;
    border: none;
    outline: none;
    font-size: 17px;
    font-weight: 400;
    color: var(--color-text);
    font-family: inherit;
    position: relative;
    z-index: 1;
  }

  .palette-hint {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 17px;
    font-weight: 400;
    color: var(--color-text-muted);
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    animation: hint-cycle 2.6s ease forwards;
  }

  @keyframes hint-cycle {
    0%   { opacity: 0; transform: translateY(calc(-50% + 6px)); }
    12%  { opacity: 0.55; transform: translateY(-50%); }
    75%  { opacity: 0.55; transform: translateY(-50%); }
    100% { opacity: 0; transform: translateY(calc(-50% - 6px)); }
  }

  .palette-esc-hint {
    font-size: 0.72rem;
    font-family: inherit;
    background: var(--color-accent-subtle);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2px 6px;
    flex-shrink: 0;
  }

  .palette-results {
    padding: 8px;
    max-height: 360px;
    overflow-y: auto;
  }

  .palette-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  .palette-result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.08s;
  }

  .palette-result-item--active {
    background: var(--color-accent-subtle);
  }

  .result-icon-wrap {
    color: var(--color-text-muted);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .palette-result-item--active .result-icon-wrap {
    color: var(--color-accent);
  }

  .result-label {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .result-type {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .result-badge {
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-radius: 4px;
    padding: 1px 6px;
  }
</style>

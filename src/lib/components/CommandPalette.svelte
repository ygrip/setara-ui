<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { listProjects, type Project } from '$lib/api/projects';
  import { listScenarios, type Scenario } from '$lib/api/testcases';
  import { listBuilds, type ProjectBuild } from '$lib/api/builds';
  import { lockBodyScroll } from '$lib/scroll-lock';

  let {
    open,
    onclose
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  // ── Types ──────────────────────────────────────────────────
  type Intent = 'global' | 'project' | 'scenario' | 'build';
  interface ResultItem {
    id: string;
    href: string;
    label: string;
    sublabel?: string;
    badge?: string;
    group: string;
    iconPath: string;
  }
  interface RecentPage { href: string; label: string; }

  // ── Icons (SVG inner HTML, matches sidebar) ────────────────
  const ICON_PROJECT  = '<path d="M3 7h18M3 12h18M3 17h18"/>';
  const ICON_SCENARIO = '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/>';
  const ICON_BUILD    = '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>';
  const ICON_PAGE     = '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>';
  const ICON_CLOCK    = '<path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/>';

  const NAV_PAGES: ResultItem[] = [
    { id: 'p-dashboard', href: '/dashboard',          label: 'Dashboard',         group: 'Pages', iconPath: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { id: 'p-projects',  href: '/projects',            label: 'Projects',          group: 'Pages', iconPath: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
    { id: 'p-plans',     href: '/plans',               label: 'Plans',             group: 'Pages', iconPath: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>' },
    { id: 'p-overview',  href: '/coverage-overview',   label: 'Coverage Overview', group: 'Pages', iconPath: '<path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 5-7"/>' },
    { id: 'p-settings',  href: '/admin',               label: 'Settings',          group: 'Pages', iconPath: '<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' },
  ];

  // ── State ──────────────────────────────────────────────────
  let searchQuery = $state('');
  let activeIntent = $state<Intent>('global');
  let intentLabel = $state('');
  let activeIndex = $state(0);
  let loading = $state(false);
  let resultGroups = $state<{ group: string; items: ResultItem[] }[]>([]);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let inputEl = $state<HTMLInputElement | null>(null);

  // ── Hints cycling ─────────────────────────────────────────
  const hints = ['Search projects, scenarios, builds…', 'Type "p: name" for projects…', 'Type "s: name" for scenarios…', 'Type "b: name" for builds…'];
  let hintIndex = $state(0);
  $effect(() => {
    if (!open) return;
    const id = setInterval(() => { hintIndex = (hintIndex + 1) % hints.length; }, 3000);
    return () => clearInterval(id);
  });

  // ── Body scroll lock ──────────────────────────────────────
  $effect(() => {
    if (!open) return;
    return lockBodyScroll();
  });

  // ── Reset on open ─────────────────────────────────────────
  $effect(() => {
    if (open) {
      searchQuery = '';
      activeIntent = 'global';
      intentLabel = '';
      activeIndex = 0;
      loadEmpty();
      setTimeout(() => inputEl?.focus(), 0);
    }
  });

  // ── Intent prefix detection ────────────────────────────────
  const PROJECT_RE  = /^(project|projects|p):\s*/i;
  const SCENARIO_RE = /^(scenario|scenarios|s):\s*/i;
  const BUILD_RE    = /^(build|builds|b):\s*/i;

  function detectPrefix(val: string): { intent: Intent; clean: string; label: string } | null {
    if (PROJECT_RE.test(val))  return { intent: 'project',  clean: val.replace(PROJECT_RE, ''),  label: 'Project'  };
    if (SCENARIO_RE.test(val)) return { intent: 'scenario', clean: val.replace(SCENARIO_RE, ''), label: 'Scenario' };
    if (BUILD_RE.test(val))    return { intent: 'build',    clean: val.replace(BUILD_RE, ''),    label: 'Build'    };
    return null;
  }

  function handleInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const val = el.value;
    const detected = detectPrefix(val);
    if (detected) {
      activeIntent = detected.intent;
      intentLabel = detected.label;
      searchQuery = detected.clean;
      el.value = detected.clean; // strip prefix from visible input immediately
    } else {
      searchQuery = val;
    }
  }

  // ── Recent pages ──────────────────────────────────────────
  function loadRecent(): RecentPage[] {
    try {
      return (JSON.parse(localStorage.getItem('setara:recent') ?? '[]') as RecentPage[]).slice(0, 6);
    } catch { return []; }
  }

  function recentToResults(pages: RecentPage[]): ResultItem[] {
    return pages.map(p => ({
      id: 'recent-' + p.href,
      href: p.href,
      label: p.label,
      group: 'Recent',
      iconPath: ICON_CLOCK
    }));
  }

  // ── Empty state ───────────────────────────────────────────
  function loadEmpty() {
    const recent = loadRecent();
    const groups: { group: string; items: ResultItem[] }[] = [];
    if (recent.length) groups.push({ group: 'Recent', items: recentToResults(recent) });
    groups.push({ group: 'Pages', items: NAV_PAGES });
    resultGroups = groups;
  }

  // ── Search effect ─────────────────────────────────────────
  $effect(() => {
    const q = searchQuery.trim();
    const intent = activeIntent;

    if (searchTimer) clearTimeout(searchTimer);

    if (!q) {
      loadEmpty();
      loading = false;
      return;
    }

    loading = true;
    searchTimer = setTimeout(async () => {
      try {
        await runSearch(intent, q);
      } finally {
        loading = false;
      }
    }, 250);
  });

  const projectKey = $derived(page.params.projectKey ?? null);

  async function runSearch(intent: Intent, q: string) {
    const groups: { group: string; items: ResultItem[] }[] = [];

    if (intent === 'project' || intent === 'global') {
      try {
        const res = await listProjects(undefined, 8, undefined, undefined, q);
        if (res.items.length) {
          groups.push({
            group: 'Projects',
            items: res.items.map(p => ({
              id: 'proj-' + p.id,
              href: '/projects/' + p.projectKey,
              label: p.name,
              badge: p.projectKey,
              sublabel: p.description ?? undefined,
              group: 'Projects',
              iconPath: ICON_PROJECT
            }))
          });
        }
      } catch {}
    }

    if (intent === 'scenario') {
      if (!projectKey) {
        groups.push({ group: 'Scenarios', items: [{ id: 'hint-no-project', href: '', label: 'Open a project to search scenarios', group: 'Scenarios', iconPath: ICON_SCENARIO }] });
      } else {
        try {
          const res = await listScenarios(projectKey, null, 'ACTIVE', undefined, undefined, undefined, undefined, undefined, 8, q);
          if (res.items.length) {
            groups.push({
              group: `Scenarios in ${projectKey}`,
              items: res.items.map(s => ({
                id: 'scn-' + s.id,
                href: `/projects/${projectKey}/repository?scenario=${s.id}`,
                label: s.name,
                badge: s.scenarioKey,
                sublabel: s.featureName ?? undefined,
                group: 'Scenarios',
                iconPath: ICON_SCENARIO
              }))
            });
          } else {
            groups.push({ group: 'Scenarios', items: [] });
          }
        } catch {}
      }
    }

    if (intent === 'build') {
      if (!projectKey) {
        groups.push({ group: 'Builds', items: [{ id: 'hint-no-project-build', href: '', label: 'Open a project to search builds', group: 'Builds', iconPath: ICON_BUILD }] });
      } else {
        try {
          const res = await listBuilds(projectKey, undefined, undefined, 8, q);
          if (res.items.length) {
            groups.push({
              group: `Builds in ${projectKey}`,
              items: res.items.map(b => ({
                id: 'build-' + b.id,
                href: `/projects/${projectKey}/builds/${b.id}`,
                label: b.name,
                badge: b.buildKey,
                sublabel: b.version ? `v${b.version} · ${b.status}` : b.status,
                group: 'Builds',
                iconPath: ICON_BUILD
              }))
            });
          } else {
            groups.push({ group: 'Builds', items: [] });
          }
        } catch {}
      }
    }

    // Always include page matches when not in specific intent
    if (intent === 'global') {
      const matchedPages = NAV_PAGES.filter(p => p.label.toLowerCase().includes(q.toLowerCase()));
      if (matchedPages.length) groups.push({ group: 'Pages', items: matchedPages });
    }

    if (!groups.length || groups.every(g => g.items.length === 0)) {
      groups.push({ group: '__empty__', items: [] });
    }

    resultGroups = groups;
    activeIndex = 0;
  }

  // ── Flat results for keyboard nav ─────────────────────────
  const allNavigable = $derived(
    resultGroups
      .flatMap(g => g.items)
      .filter(r => r.href !== '')
  );

  // ── Navigation ────────────────────────────────────────────
  function navigate(item: ResultItem) {
    if (!item.href) return;
    onclose();
    goto(item.href);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
      return;
    }
    if (e.key === 'Backspace' && searchQuery === '' && activeIntent !== 'global') {
      activeIntent = 'global';
      intentLabel = '';
      loadEmpty();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, allNavigable.length - 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }
    if (e.key === 'Enter') {
      const item = allNavigable[activeIndex];
      if (item) navigate(item);
      return;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  // ── Active item tracking ──────────────────────────────────
  const activeItemId = $derived(allNavigable[activeIndex]?.id ?? null);

  const intentColors: Record<string, string> = {
    project:  'var(--color-accent)',
    scenario: '#10b981',
    build:    '#f59e0b',
  };
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    tabindex="-1"
  >
    <div class="panel">

      <!-- Search row -->
      <div class="search-row">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>

        {#if activeIntent !== 'global'}
          <span class="intent-badge" style="--badge-color: {intentColors[activeIntent]}">
            {intentLabel}
            <button class="intent-clear" onclick={() => { activeIntent = 'global'; intentLabel = ''; searchQuery = ''; loadEmpty(); inputEl?.focus(); }} aria-label="Clear filter">×</button>
          </span>
        {/if}

        <div class="input-wrap">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:this={inputEl}
            class="palette-input"
            type="text"
            placeholder=" "
            value={searchQuery}
            oninput={handleInput}
            autocomplete="off"
            spellcheck="false"
            autofocus
          />
          {#if !searchQuery}
            {#key hintIndex}
              <span class="input-hint" aria-hidden="true">{hints[hintIndex]}</span>
            {/key}
          {/if}
        </div>

        {#if loading}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          <kbd class="esc-hint">Esc</kbd>
        {/if}
      </div>

      <!-- Results -->
      <div class="results" role="listbox">
        {#each resultGroups as group}
          {#if group.group === '__empty__'}
            <p class="empty-msg">No results for "{searchQuery}"</p>
          {:else if group.items.length > 0}
            <div class="group">
              <div class="group-label">{group.group}</div>
              {#each group.items as item}
                {#if item.href}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    role="option"
                    aria-selected={activeItemId === item.id}
                    tabindex="-1"
                    class="result-item"
                    class:result-item--active={activeItemId === item.id}
                    onclick={() => navigate(item)}
                    onmouseenter={() => { const idx = allNavigable.findIndex(r => r.id === item.id); if (idx >= 0) activeIndex = idx; }}
                  >
                    <span class="result-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        {@html item.iconPath}
                      </svg>
                    </span>
                    <span class="result-body">
                      <span class="result-label">{item.label}</span>
                      {#if item.sublabel}
                        <span class="result-sub">{item.sublabel}</span>
                      {/if}
                    </span>
                    {#if item.badge}
                      <span class="result-badge">{item.badge}</span>
                    {/if}
                  </div>
                {:else}
                  <div class="result-hint">
                    <span class="result-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
                        <path d={item.iconPath}/>
                      </svg>
                    </span>
                    <span class="result-label result-label--muted">{item.label}</span>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        {/each}
      </div>

      <!-- Footer hints -->
      <div class="footer">
        <span class="footer-hint"><kbd>↑↓</kbd> navigate</span>
        <span class="footer-hint"><kbd>↵</kbd> open</span>
        <span class="footer-hint"><kbd>Esc</kbd> close</span>
        <span class="footer-sep"></span>
        <span class="footer-hint footer-hint--dim">p: projects · s: scenarios · b: builds</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10vh 16px 16px;
  }

  .panel {
    width: 100%;
    max-width: 600px;
    max-height: min(72vh, calc(100dvh - 80px));
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Search row ── */
  .search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .intent-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: color-mix(in srgb, var(--badge-color) 14%, transparent);
    color: var(--badge-color);
    border: 1px solid color-mix(in srgb, var(--badge-color) 30%, transparent);
    flex-shrink: 0;
  }

  .intent-clear {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    font-size: 0.85rem;
    line-height: 1;
    opacity: 0.7;
    display: flex;
    align-items: center;
  }

  .intent-clear:hover { opacity: 1; }

  .input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .palette-input {
    width: 100%;
    background: none;
    border: none;
    outline: none;
    font-size: 16px;
    color: var(--color-text);
    font-family: inherit;
    position: relative;
    z-index: 1;
  }

  .input-hint {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: var(--color-text-muted);
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    opacity: 0;
    animation: hint-fade 3s ease forwards;
  }

  @keyframes hint-fade {
    0%   { opacity: 0; transform: translateY(calc(-50% + 5px)); }
    10%  { opacity: 0.5; transform: translateY(-50%); }
    75%  { opacity: 0.5; transform: translateY(-50%); }
    100% { opacity: 0; transform: translateY(calc(-50% - 4px)); }
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .esc-hint {
    font-size: 0.7rem;
    font-family: inherit;
    background: var(--color-bg);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2px 6px;
    flex-shrink: 0;
  }

  /* ── Results ── */
  .results {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px 8px 4px;
  }

  .group {
    margin-bottom: 4px;
  }

  .group-label {
    padding: 6px 12px 3px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
  }

  .result-item, .result-hint {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.08s;
    min-width: 0;
  }

  .result-hint { cursor: default; opacity: 0.6; }

  .result-item--active {
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  }

  .result-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .result-item--active .result-icon { color: var(--color-accent); }

  .result-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .result-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-label--muted { color: var(--color-text-muted); font-style: italic; }

  .result-sub {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    color: var(--color-accent);
    flex-shrink: 0;
    letter-spacing: 0.04em;
  }

  .empty-msg {
    text-align: center;
    padding: 28px 16px;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  /* ── Footer ── */
  .footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .footer-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .footer-hint kbd {
    font-family: inherit;
    font-size: 0.65rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 1px 4px;
  }

  .footer-sep { flex: 1; }
  .footer-hint--dim { opacity: 0.5; font-size: 0.65rem; }

  @media (max-width: 640px) {
    .overlay { padding: 6vh 8px 8px; }
    .panel { border-radius: 10px; max-height: min(82vh, calc(100dvh - 40px)); }
    .search-row { padding: 12px 12px; }
    .footer { display: none; }
  }
</style>

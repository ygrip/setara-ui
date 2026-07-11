<script lang="ts">
  import type {
    ProjectHealthStatus,
    ProjectOverviewOrder,
    ProjectOverviewSort
  } from '$lib/api/projects';

  type ViewMode = 'grid' | 'list';
  type SortOption = { value: string; label: string; sort: ProjectOverviewSort; order: ProjectOverviewOrder };

  let {
    search,
    status,
    domain,
    sort,
    order,
    view,
    domains,
    onSearch,
    onStatus,
    onDomain,
    onSort,
    onView
  }: {
    search: string;
    status: ProjectHealthStatus | '';
    domain: string;
    sort: ProjectOverviewSort;
    order: ProjectOverviewOrder;
    view: ViewMode;
    domains: string[];
    onSearch: (value: string) => void;
    onStatus: (value: ProjectHealthStatus | '') => void;
    onDomain: (value: string) => void;
    onSort: (sort: ProjectOverviewSort, order: ProjectOverviewOrder) => void;
    onView: (value: ViewMode) => void;
  } = $props();

  const sortOptions: SortOption[] = [
    { value: 'lastActivity:desc', label: 'Last activity', sort: 'lastActivity', order: 'desc' },
    { value: 'name:asc', label: 'Name', sort: 'name', order: 'asc' },
    { value: 'scenarios:desc', label: 'Most scenarios', sort: 'scenarios', order: 'desc' },
    { value: 'coverage:asc', label: 'Lowest coverage', sort: 'coverage', order: 'asc' },
    { value: 'passRate:asc', label: 'Lowest pass rate', sort: 'passRate', order: 'asc' },
    { value: 'failures:desc', label: 'Most failures', sort: 'failures', order: 'desc' }
  ];

  function selectSort(value: string) {
    const option = sortOptions.find((item) => item.value === value);
    if (option) onSort(option.sort, option.order);
  }
</script>

<div class="project-toolbar" aria-label="Project controls">
  <label class="search-field">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <span class="sr-only">Search projects</span>
    <input
      type="search"
      value={search}
      placeholder="Search by name, key, or domain"
      oninput={(event) => onSearch(event.currentTarget.value)}
    />
  </label>

  <label>
    <span>Status</span>
    <select value={status} onchange={(event) => onStatus(event.currentTarget.value as ProjectHealthStatus | '')}>
      <option value="">All statuses</option>
      <option value="HEALTHY">Healthy</option>
      <option value="NEEDS_REVIEW">Needs review</option>
      <option value="HIGH_RISK">High risk</option>
      <option value="CRITICAL">Critical</option>
      <option value="NO_RUNS">No runs</option>
    </select>
  </label>

  {#if domains.length > 0}
    <label>
      <span>Domain</span>
      <select value={domain} onchange={(event) => onDomain(event.currentTarget.value)}>
        <option value="">All domains</option>
        {#each domains as option}<option value={option}>{option}</option>{/each}
      </select>
    </label>
  {/if}

  <label>
    <span>Sort</span>
    <select value={`${sort}:${order}`} onchange={(event) => selectSort(event.currentTarget.value)}>
      {#each sortOptions as option}<option value={option.value}>{option.label}</option>{/each}
    </select>
  </label>

  <div class="view-toggle" role="group" aria-label="Project view">
    <button class="button-icon" type="button" aria-label="Grid view" aria-pressed={view === 'grid'} onclick={() => onView('grid')}>
      <div class="icon">
<svg viewBox="0 0 24 24" fill="none">
<path d="M6.75 3C3.88235 3 3 3.88235 3 6.75C3 9.61765 3.88235 10.5 6.75 10.5C9.61765 10.5 10.5 9.61765 10.5 6.75C10.5 3.88235 9.61765 3 6.75 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.75 13.5C3.88235 13.5 3 14.3824 3 17.25C3 20.1176 3.88235 21 6.75 21C9.61765 21 10.5 20.1176 10.5 17.25C10.5 14.3824 9.61765 13.5 6.75 13.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17.25 13.5C14.3824 13.5 13.5 14.3824 13.5 17.25C13.5 20.1176 14.3824 21 17.25 21C20.1176 21 21 20.1176 21 17.25C21 14.3824 20.1176 13.5 17.25 13.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17.25 3C14.3824 3 13.5 3.88235 13.5 6.75C13.5 9.61765 14.3824 10.5 17.25 10.5C20.1176 10.5 21 9.61765 21 6.75C21 3.88235 20.1176 3 17.25 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
      </div>
    </button>
    <button class="button-icon" type="button" aria-label="List view" aria-pressed={view === 'list'} onclick={() => onView('list')}>
      <div class="icon">
        <svg  viewBox="0 0 16 16" fill="none">
<path d="M3 1H1V3H3V1Z" fill="currentColor"/>
<path d="M3 5H1V7H3V5Z" fill="currentColor"/>
<path d="M1 9H3V11H1V9Z" fill="currentColor"/>
<path d="M3 13H1V15H3V13Z" fill="currentColor"/>
<path d="M15 1H5V3H15V1Z" fill="currentColor"/>
<path d="M15 5H5V7H15V5Z" fill="currentColor"/>
<path d="M5 9H15V11H5V9Z" fill="currentColor"/>
<path d="M15 13H5V15H15V13Z" fill="currentColor"/>
</svg>
      </div>
    </button>
  </div>
</div>

<style>
  .project-toolbar {
    display: grid;
    grid-template-columns: minmax(17rem, 1fr) auto auto auto auto;
    align-items: end;
    gap: 0.75rem;
    padding: 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 0.875rem);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .button-icon .icon {
    width: 1.25em;  /* Scales perfectly relative to the text size */
    height: 1.25em;
    fill: currentColor;
  }

  label { display: grid; gap: 0.28rem; color: var(--color-text-muted); font-size: 0.68rem; font-weight: 700; }
  input, select { min-height: 2.35rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.8rem; font-weight: 500; }
  input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .search-field { position: relative; }
  .search-field input { width: 100%; padding: 0 0.75rem 0 2rem; }
  .search-icon { position: absolute; bottom: 0.75rem; left: 0.7rem; color: var(--color-text-muted); font-size: 1rem; }
  select { padding: 0 2rem 0 0.65rem; }
  .view-toggle { 
  display: inline-flex; /* 1. Prevents button container from stretching full-width */
  overflow: hidden; 
  border: 1px solid var(--color-border); 
  border-radius: 0.5rem; 
}

.view-toggle button { 
  display: flex;        /* 2. Centers the internal SVG vertically and horizontally */
  align-items: center; 
  justify-content: center; 
  width: 2.35rem; 
  height: 2.35rem;      /* 3. Forces strict square aspect ratios for icons */
  padding: 0;           /* 4. Removes default browser button padding */
  border: 0; 
  background: transparent; 
  color: var(--color-text-muted); 
  cursor: pointer; 
}

.view-toggle button + button { 
  border-left: 1px solid var(--color-border); 
}

.view-toggle button[aria-pressed='true'] { 
  background: var(--color-accent-subtle); 
  color: var(--color-accent); 
}

.sr-only { 
  position: absolute; 
  width: 1px; 
  height: 1px; 
  padding: 0;           /* 5. Modernizes the screen-reader utility */
  margin: -1px; 
  overflow: hidden; 
  clip: rect(0, 0, 0, 0); 
  white-space: nowrap; 
  border: 0; 
}
  @media (max-width: 900px) {
    .project-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .search-field { grid-column: 1 / -1; }
    .view-toggle { justify-self: start; }
  }

  @media (max-width: 600px) {
    .project-toolbar { grid-template-columns: 1fr; }
    .search-field { grid-column: auto; }
    .view-toggle { width: 100%; }
    .view-toggle button { flex: 1; }
  }
</style>

<script lang="ts">
  import { goto } from '$app/navigation';
  import InlineProgress from '$lib/components/dashboard/InlineProgress.svelte';
  import QualityStatusBadge from '$lib/components/dashboard/QualityStatusBadge.svelte';
  import type { SquadQualityProject } from '$lib/api/statistics';

  type SortKey = 'project' | 'coverage' | 'scenarios' | 'passrate';

  let {
    items,
    total,
    hasNext,
    loading,
    sort,
    dir,
    search,
    status,
    onSort,
    onSearch,
    onStatus,
    onLoadMore
  }: {
    items: SquadQualityProject[];
    total: number;
    hasNext: boolean;
    loading: boolean;
    sort: SortKey;
    dir: 'asc' | 'desc';
    search: string;
    status: string;
    onSort: (sort: SortKey, dir: 'asc' | 'desc') => void;
    onSearch: (q: string) => void;
    onStatus: (status: string) => void;
    onLoadMore: () => void;
  } = $props();

  let sentinel = $state<HTMLElement | null>(null);
  let searchInput = $state('');
  let searchTimer: ReturnType<typeof setTimeout>;

  $effect(() => { searchInput = search; });

  function toggleSort(key: SortKey) {
    if (sort === key) {
      onSort(key, dir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, key === 'project' ? 'asc' : 'desc');
    }
  }

  function handleSearchInput(value: string) {
    searchInput = value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => onSearch(value), 350);
  }

  function activity(value: string | null) {
    if (!value) return 'Never';
    const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
    return days === 0 ? 'Today' : `${days}d ago`;
  }

  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !loading) onLoadMore();
      },
      { rootMargin: '160px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<section class="projects-section">
  <div class="heading">
    <h2>Project quality</h2>
    <span class="count">{total} project{total !== 1 ? 's' : ''}</span>
  </div>

  <div class="filters">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
      <input
        class="search-input"
        type="search"
        placeholder="Search by name or key…"
        value={searchInput}
        oninput={(e) => handleSearchInput(e.currentTarget.value)}
        aria-label="Search projects"
      />
    </div>
    <select
      class="status-filter"
      value={status}
      onchange={(e) => onStatus(e.currentTarget.value)}
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      <option value="HEALTHY">Healthy</option>
      <option value="NEEDS_REVIEW">Needs review</option>
      <option value="HIGH_RISK">High risk</option>
      <option value="CRITICAL">Critical</option>
      <option value="NO_RUNS">No runs</option>
    </select>
  </div>

  <div class="table-shell">
    <table>
      <thead>
        <tr>
          <th>
            <button class="sort-btn" class:active={sort === 'project'} onclick={() => toggleSort('project')}>
              Project
              {#if sort === 'project'}<span class="sort-arrow" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>{/if}
            </button>
          </th>
          <th>
            <button class="sort-btn" class:active={sort === 'scenarios'} onclick={() => toggleSort('scenarios')}>
              Scenarios
              {#if sort === 'scenarios'}<span class="sort-arrow" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>{/if}
            </button>
          </th>
          <th>Automated</th>
          <th>
            <button class="sort-btn" class:active={sort === 'coverage'} onclick={() => toggleSort('coverage')}>
              Coverage
              {#if sort === 'coverage'}<span class="sort-arrow" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>{/if}
            </button>
          </th>
          <th>
            <button class="sort-btn" class:active={sort === 'passrate'} onclick={() => toggleSort('passrate')}>
              Pass rate
              {#if sort === 'passrate'}<span class="sort-arrow" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>{/if}
            </button>
          </th>
          <th>Failures</th>
          <th>Status</th>
          <th>Last activity</th>
        </tr>
      </thead>
      <tbody>
        {#each items as project (project.id)}
          <tr onclick={() => goto(`/projects/${project.key}`)}>
            <td class="project-cell">
              <strong>{project.name}</strong>
              <span class="project-key">{project.key}</span>
            </td>
            <td>{project.totalScenarios}</td>
            <td>{project.automatedScenarios}</td>
            <td>
              {#if project.coveragePercent != null}
                <InlineProgress value={project.coveragePercent} label="{project.name} coverage" />
              {:else}
                <span class="na">N/A</span>
              {/if}
            </td>
            <td>
              {#if project.passRatePercent != null}
                <InlineProgress value={Number(project.passRatePercent)} label="{project.name} pass rate" />
              {:else}
                <span class="na">No runs</span>
              {/if}
            </td>
            <td>{project.openFailures ?? '-'}</td>
            <td><QualityStatusBadge status={project.status} /></td>
            <td title={project.lastExecutionAt ? new Date(project.lastExecutionAt).toLocaleString() : 'No execution data'}>
              {activity(project.lastExecutionAt)}
            </td>
          </tr>
        {:else}
          <tr><td colspan="8" class="empty">
            {loading ? 'Loading projects…' : search || status ? 'No projects match these filters.' : 'No projects in this squad.'}
          </td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="sentinel" bind:this={sentinel} aria-hidden="true">
    {#if loading}
      <span class="loading-hint">Loading…</span>
    {:else if hasNext}
      <span class="loading-hint">Showing {items.length} of {total} · scroll for more</span>
    {:else if items.length > 0}
      <span class="loading-hint">{items.length} of {total} projects</span>
    {/if}
  </div>
</section>

<style>
  .projects-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .heading {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .count {
    font-size: 0.76rem;
    color: var(--color-text-muted);
  }

  .filters {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 180px;
    max-width: 360px;
  }

  .search-icon {
    position: absolute;
    left: 0.55rem;
    top: 50%;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 2rem;
    padding: 0 0.6rem 0 1.8rem;
    border: 1px solid var(--color-border);
    border-radius: 0.4rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.76rem;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .status-filter {
    height: 2rem;
    padding: 0 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 0.4rem;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .table-shell {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
  }

  table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
    background: var(--color-surface);
  }

  th, td {
    padding: 0.72rem 0.85rem;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    font-size: 0.76rem;
  }

  th {
    color: var(--color-text-muted);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--color-bg);
  }

  tr:last-child td { border-bottom: 0; }

  tbody tr:hover td {
    background: color-mix(in srgb, var(--color-accent) 4%, transparent);
    cursor: pointer;
  }

  .sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    padding: 0;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.1s;
  }

  .sort-btn:hover, .sort-btn.active {
    color: var(--color-accent);
  }

  .sort-arrow {
    font-size: 0.7rem;
  }

  .project-cell {
    display: grid;
    gap: 0.1rem;
  }

  .project-cell strong {
    color: var(--color-accent);
  }

  .project-key {
    color: var(--color-text-muted);
    font-size: 0.65rem;
    font-weight: 500;
  }

  .na {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .empty {
    color: var(--color-text-muted);
    text-align: center;
    padding: 2rem;
  }

  .sentinel {
    display: flex;
    justify-content: center;
    padding: 0.5rem;
    min-height: 1.5rem;
  }

  .loading-hint {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
</style>

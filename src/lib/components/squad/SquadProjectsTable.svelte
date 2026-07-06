<script lang="ts">
  import { onMount } from 'svelte';
  import InlineProgress from '$lib/components/dashboard/InlineProgress.svelte';
  import QualityStatusBadge from '$lib/components/dashboard/QualityStatusBadge.svelte';
  import type { SquadQualityProject } from '$lib/api/statistics';
  import { formatPercent } from '$lib/utils/format';

  let { projects }: { projects: SquadQualityProject[] } = $props();

  type SortKey = 'project' | 'coverage' | 'scenarios';
  type SortDir = 'asc' | 'desc';

  let sort = $state<SortKey>('coverage');
  let dir = $state<SortDir>('asc');
  let visibleCount = $state(15);
  let sentinel = $state<HTMLElement | null>(null);

  const sorted = $derived.by(() => {
    return [...projects].sort((a, b) => {
      let diff = 0;
      if (sort === 'project') {
        diff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sort === 'coverage') {
        diff = (a.coveragePercent ?? -1) - (b.coveragePercent ?? -1);
      } else {
        diff = a.totalScenarios - b.totalScenarios;
      }
      return dir === 'asc' ? diff : -diff;
    });
  });

  const rows = $derived(sorted.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < sorted.length);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      dir = dir === 'asc' ? 'desc' : 'asc';
    } else {
      sort = key;
      dir = key === 'project' ? 'asc' : 'desc';
    }
    visibleCount = 15;
  }

  function activity(value: string | null) {
    if (!value) return 'Never';
    const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
    return days === 0 ? 'Today' : `${days}d ago`;
  }

  $effect(() => {
    projects;
    visibleCount = 15;
  });

  onMount(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          visibleCount += 10;
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<section class="projects-section">
  <div class="heading">
    <h2>Project quality</h2>
    <span class="count">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
  </div>

  <div class="table-shell">
    <table>
      <thead>
        <tr>
          <th>
            <button class="sort-btn" class:active={sort === 'project'} onclick={() => toggleSort('project')}>
              Project
              <span class="sort-arrow" aria-hidden="true">{sort === 'project' ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </th>
          <th>
            <button class="sort-btn" class:active={sort === 'scenarios'} onclick={() => toggleSort('scenarios')}>
              Scenarios
              <span class="sort-arrow" aria-hidden="true">{sort === 'scenarios' ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </th>
          <th>Automated</th>
          <th>
            <button class="sort-btn" class:active={sort === 'coverage'} onclick={() => toggleSort('coverage')}>
              Coverage
              <span class="sort-arrow" aria-hidden="true">{sort === 'coverage' ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </th>
          <th>Pass rate</th>
          <th>Failures</th>
          <th>Status</th>
          <th>Last activity</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as project (project.id)}
          <tr>
            <td>
              <a href="/projects/{project.key}" class="project-link">
                <strong>{project.name}</strong>
                <span class="project-key">{project.key}</span>
              </a>
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
            <td>{project.openFailures ?? '—'}</td>
            <td><QualityStatusBadge status={project.status} /></td>
            <td title={project.lastExecutionAt ? new Date(project.lastExecutionAt).toLocaleString() : 'No execution data'}>
              {activity(project.lastExecutionAt)}
            </td>
          </tr>
        {:else}
          <tr><td colspan="8" class="empty">No projects in this squad.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if hasMore}
    <div class="sentinel" bind:this={sentinel} aria-hidden="true">
      <span class="loading-hint">Showing {rows.length} of {sorted.length} · scroll for more</span>
    </div>
  {/if}
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
    font-style: normal;
    font-size: 0.7rem;
  }

  .project-link {
    display: grid;
    gap: 0.1rem;
    color: var(--color-accent);
    text-decoration: none;
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
    padding: 0.6rem;
  }

  .loading-hint {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
</style>

<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { AppSkeleton } from '$lib/ui/display';
  import {
    getSquadQualityOverview,
    getSquadProjects,
    type SquadQualityOverview,
    type SquadQualityProject
  } from '$lib/api/statistics';
  import OverallCoveragePanel from '$lib/components/squad/OverallCoveragePanel.svelte';
  import SquadHeader from '$lib/components/squad/SquadHeader.svelte';
  import SquadMetricStrip from '$lib/components/squad/SquadMetricStrip.svelte';
  import SquadNeedsAttention from '$lib/components/squad/SquadNeedsAttention.svelte';
  import SquadProjectsTable from '$lib/components/squad/SquadProjectsTable.svelte';
  import SquadTrendPanel, { type SquadRange } from '$lib/components/squad/SquadTrendPanel.svelte';

  let { data } = $props();
  let overview = $state<SquadQualityOverview | null>(null);
  let error = $state<string | null>(null);
  let initialized = $state(false);
  let loading = $state(false);
  let range = $state<SquadRange>('custom');
  let group = $state<'daily' | 'weekly' | 'monthly'>('daily');
  let start = $state('');
  let end = $state('');
  let requestSequence = 0;

  // Project table state
  let projectItems = $state<SquadQualityProject[]>([]);
  let projectTotal = $state(0);
  let projectHasNext = $state(false);
  let projectLoading = $state(false);
  let projectPage = $state(0);
  let projectSort = $state<'project' | 'coverage' | 'scenarios' | 'passrate'>('coverage');
  let projectDir = $state<'asc' | 'desc'>('desc');
  let projectSearch = $state('');
  let projectStatus = $state('');

  $effect(() => {
    if (!initialized) {
      overview = data.overview;
      error = data.error;
      start = data.overview?.period.start ?? '';
      end = data.overview?.period.end ?? '';
      initialized = true;
      if (start && end) loadProjects(true);
    }
  });

  async function loadProjects(reset: boolean) {
    const page = reset ? 0 : projectPage;
    projectLoading = true;
    try {
      const result = await getSquadProjects(data.squadId, {
        start: start || undefined,
        end: end || undefined,
        sort: projectSort,
        dir: projectDir,
        search: projectSearch || undefined,
        status: projectStatus || undefined,
        page,
        size: 20
      });
      if (reset) {
        projectItems = result.items;
        projectPage = 1;
      } else {
        projectItems = [...projectItems, ...result.items];
        projectPage = page + 1;
      }
      projectTotal = result.total;
      projectHasNext = result.hasNext;
    } finally {
      projectLoading = false;
    }
  }

  function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async function selectRange(next: SquadRange) {
    range = next;
    if (next === 'custom') return;
    const days = Number(next.slice(0, -1));
    const nextEnd = new Date();
    const nextStart = new Date(nextEnd);
    nextStart.setUTCDate(nextStart.getUTCDate() - days + 1);
    start = isoDate(nextStart);
    end = isoDate(nextEnd);
    await Promise.all([refresh(), loadProjects(true)]);
  }

  async function selectGroup(next: 'daily' | 'weekly' | 'monthly') {
    group = next;
    await refresh();
  }

  async function selectCustom(nextStart: string, nextEnd: string) {
    start = nextStart;
    end = nextEnd;
    if (start && end) await Promise.all([refresh(), loadProjects(true)]);
  }

  async function refresh() {
    const requestId = ++requestSequence;
    loading = true;
    error = null;
    try {
      const next = await getSquadQualityOverview(data.squadId, { start, end, group });
      if (requestId === requestSequence) overview = next;
    } catch (caught) {
      if (requestId === requestSequence) error = (caught as Error).message;
    } finally {
      if (requestId === requestSequence) loading = false;
    }
  }

  function handleSort(sort: typeof projectSort, dir: typeof projectDir) {
    projectSort = sort;
    projectDir = dir;
    loadProjects(true);
  }

  function handleSearch(q: string) {
    projectSearch = q;
    loadProjects(true);
  }

  function handleStatus(s: string) {
    projectStatus = s;
    loadProjects(true);
  }
</script>

<svelte:head><title>{overview?.squad.name ?? data.squadId} - Setara</title></svelte:head>

<div class="squad-page">
  {#if !overview && !initialized}
    <AppSkeleton height="90px" />
    <div class="metric-skeletons">{#each Array(6) as _}<AppSkeleton height="116px" />{/each}</div>
    <AppSkeleton height="300px" />
  {:else if !overview && error}
    <section class="error-state" role="alert">
      <h1>Could not load squad quality</h1>
      <p>{error}</p>
      <Button onclick={refresh}>Try again</Button>
    </section>
  {:else if overview}
    <SquadHeader {overview} />
    <SquadMetricStrip {overview} />

    {#if error}
      <div class="refresh-error" role="status">
        <span>Quality data could not be refreshed. Showing the latest available view.</span>
        <Button variant="secondary" onclick={refresh}>Retry</Button>
      </div>
    {/if}

    <div class="overview-grid" class:refreshing={loading} aria-busy={loading}>
      <OverallCoveragePanel {overview} />
      <SquadTrendPanel
        {overview}
        {range}
        {group}
        {start}
        {end}
        onRange={selectRange}
        onGroup={selectGroup}
        onCustom={selectCustom}
      />
    </div>
    <SquadNeedsAttention {overview} />
    <SquadProjectsTable
      items={projectItems}
      total={projectTotal}
      hasNext={projectHasNext}
      loading={projectLoading}
      sort={projectSort}
      dir={projectDir}
      search={projectSearch}
      status={projectStatus}
      onSort={handleSort}
      onSearch={handleSearch}
      onStatus={handleStatus}
      onLoadMore={() => loadProjects(false)}
    />
  {/if}
</div>

<style>
  .squad-page { display: flex; max-width: 96rem; min-height: calc(100vh - 5rem); flex-direction: column; gap: 1.25rem; }
  .metric-skeletons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.8rem; }
  .overview-grid { display: grid; grid-template-columns: minmax(17rem, 0.8fr) minmax(0, 2.2fr); gap: 1rem; transition: opacity 120ms ease; }
  .refreshing { opacity: 0.68; }
  .refresh-error, .error-state { padding: 0.9rem; border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border)); border-radius: 0.7rem; background: color-mix(in srgb, var(--color-danger) 7%, var(--color-surface)); }
  .refresh-error { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; color: var(--color-text); font-size: 0.78rem; }
  .error-state { display: grid; justify-items: start; gap: 0.6rem; } .error-state h1, .error-state p { margin: 0; } .error-state h1 { font-size: 1.1rem; } .error-state p { color: var(--color-text-muted); }
  @media (max-width: 1280px) { .metric-skeletons { grid-template-columns: repeat(3, 1fr); } .overview-grid { grid-template-columns: 1fr; } }
  @media (max-width: 700px) { .metric-skeletons { grid-template-columns: 1fr; } .refresh-error { align-items: flex-start; flex-direction: column; } }
</style>

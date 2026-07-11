<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import LinkIssuesModal from './LinkIssuesModal.svelte';
  import IssueTypeIcon from './IssueTypeIcon.svelte';
  import {
    listExecutionIssues, listBuildIssues, listPlanIssues, removeLinkedIssue,
    type TrackedIssueSummary, type IssueSortBy
  } from '$lib/api/issues';

  type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
    | 'passed' | 'failed' | 'blocked' | 'skipped' | 'running'
    | 'automated' | 'manual' | 'automatable' | 'not-automatable';

  function priorityVariant(priority: string): BadgeVariant {
    const p = priority.toLowerCase();
    if (p.includes('critical') || p.includes('blocker') || p.includes('highest')) return 'danger';
    if (p.includes('high')) return 'warning';
    if (p.includes('medium')) return 'info';
    return 'skipped';
  }

  function statusVariant(status: string): BadgeVariant {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('closed') || s.includes('resolved') || s.includes('complete')) return 'success';
    if (s.includes('block')) return 'blocked';
    if (s.includes('progress') || s.includes('review') || s.includes('active')) return 'running';
    if (s.includes('reopen')) return 'warning';
    return 'neutral';
  }

  let {
    context,
    projectKey,
    squadId,
    planId,
    buildId,
    executionId,
    enabled,
    refreshToken = 0,
    quickCreate,
    notice = ''
  }: {
    context: 'plan' | 'build' | 'execution';
    projectKey?: string;
    squadId?: string;
    planId?: string;
    buildId?: string;
    executionId?: string;
    enabled: boolean;
    refreshToken?: number;
    quickCreate?: () => void;
    notice?: string;
  } = $props();

  const PAGE_SIZE = 20;

  let items = $state<TrackedIssueSummary[]>([]);
  let nextCursor = $state<string | null>(null);
  let loading = $state(false);
  let loadingMore = $state(false);
  let error = $state('');
  let sortBy = $state<IssueSortBy>('key');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let showLinkModal = $state(false);
  let unlinkTarget = $state<TrackedIssueSummary | null>(null);
  let unlinking = $state(false);

  const subtitle = $derived(`External issues linked to this ${context}.`);

  async function fetchPage(cursor?: string) {
    if (context === 'execution' && projectKey && executionId) {
      return listExecutionIssues(projectKey, executionId, { cursor, limit: PAGE_SIZE, sortBy, sortDir });
    }
    if (context === 'build' && projectKey && buildId) {
      return listBuildIssues(projectKey, buildId, { cursor, limit: PAGE_SIZE, sortBy, sortDir });
    }
    if (context === 'plan' && squadId && planId) {
      return listPlanIssues(squadId, planId, { cursor, limit: PAGE_SIZE, sortBy, sortDir });
    }
    return { items: [], nextCursor: null, prevCursor: null };
  }

  async function load() {
    if (!enabled) return;
    loading = true;
    error = '';
    try {
      const page = await fetchPage();
      items = page.items;
      nextCursor = page.nextCursor;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    try {
      const page = await fetchPage(nextCursor);
      items = [...items, ...page.items];
      nextCursor = page.nextCursor;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loadingMore = false;
    }
  }

  async function toggleSort(col: IssueSortBy) {
    sortDir = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    sortBy = col;
    await load();
  }

  function sortIcon(col: IssueSortBy): string {
    if (sortBy !== col) return '↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  async function confirmRemove() {
    const target = unlinkTarget;
    if (!target?.linkedIssueId || unlinking) return;
    unlinking = true;
    try {
      await removeLinkedIssue(target.linkedIssueId);
      items = items.filter((item) => item.linkedIssueId !== target.linkedIssueId);
      unlinkTarget = null;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      unlinking = false;
    }
  }

  $effect(() => {
    // re-fetch whenever the target entity or enabled flag changes
    void executionId;
    void buildId;
    void planId;
    void enabled;
    void refreshToken;
    load();
  });
</script>

{#if enabled}
  <BentoCard title="Tracked issues" {subtitle} padding="md" className="tracked-issues-card">
    {#snippet headerActions()}
      {#if quickCreate}
        <Button variant="primary" size="sm" onclick={quickCreate}>Quick create issue</Button>
      {/if}
      <Button variant="secondary" size="sm" onclick={() => (showLinkModal = true)}>Link issues</Button>
    {/snippet}

    {#if notice}<p class="notice" role="status">{notice}</p>{/if}

    {#if loading}
      <p class="state-text">Loading issues…</p>
    {:else if error}
      <p class="error" role="alert">{error}</p>
    {:else if items.length === 0}
      <EmptyState
        title="No linked issues yet"
        hint="Link a Jira issue to start tracking it against this {context}."
        minHeight="200px"
      >
        <svelte:fragment slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 15l6-6" />
            <path d="M11 6l.7-.7a3.5 3.5 0 0 1 5 5l-.7.7" />
            <path d="M13 18l-.7.7a3.5 3.5 0 0 1-5-5l.7-.7" />
          </svg>
        </svelte:fragment>
      </EmptyState>
    {:else}
      <DataTable mobileCards>
        {#snippet head()}
          <tr>
            <th><button class="sort-button" onclick={() => toggleSort('key')}>Key <span class="sort-indicator" aria-hidden="true">{sortIcon('key')}</span></button></th>
            <th>Type</th>
            <th>Summary</th>
            <th><button class="sort-button" onclick={() => toggleSort('status')}>Status <span class="sort-indicator" aria-hidden="true">{sortIcon('status')}</span></button></th>
            <th><button class="sort-button" onclick={() => toggleSort('priority')}>Priority <span class="sort-indicator" aria-hidden="true">{sortIcon('priority')}</span></button></th>
            <th data-label=""></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each items as item (item.linkedIssueId ?? item.issueKey)}
            <tr>
              <td data-label="Key"><a href={item.issueUrl} target="_blank" rel="noopener noreferrer">{item.issueKey}</a></td>
              <td data-label="Type">
                <span class="type-cell">
                  <IssueTypeIcon type={item.issueType} />
                  {item.issueType}
                </span>
              </td>
              <td data-label="Summary">{item.issueSummary}</td>
              <td data-label="Status"><Badge text={item.issueStatus} variant={statusVariant(item.issueStatus)} /></td>
              <td data-label="Priority"><Badge text={item.issuePriority} variant={priorityVariant(item.issuePriority)} /></td>
              <td data-label="">
                <Button variant="ghost" size="sm" onclick={() => (unlinkTarget = item)} disabled={!item.linkedIssueId}>Unlink</Button>
              </td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
      {#if nextCursor}
        <div class="load-more-wrap">
          <Button variant="secondary" size="sm" onclick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      {/if}
    {/if}
  </BentoCard>

  <LinkIssuesModal
    open={showLinkModal}
    onclose={() => (showLinkModal = false)}
    onlinked={() => {
      showLinkModal = false;
      load();
    }}
    planId={context === 'plan' ? planId : undefined}
    buildId={context === 'build' ? buildId : undefined}
    executionId={context === 'execution' ? executionId : undefined}
  />

  <Modal open={unlinkTarget !== null} title="Unlink tracked issue" size="sm" onclose={() => { if (!unlinking) unlinkTarget = null; }}>
    <div class="unlink-content">
      <p>Unlink <strong>{unlinkTarget?.issueKey}</strong> from this {context}?</p>
      <p class="state-text">The external issue will not be deleted.</p>
      <div class="modal-actions">
        <Button variant="secondary" size="sm" onclick={() => (unlinkTarget = null)} disabled={unlinking}>Cancel</Button>
        <Button variant="danger" size="sm" onclick={confirmRemove} disabled={unlinking}>{unlinking ? 'Unlinking…' : 'Unlink issue'}</Button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .state-text {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: 0.875rem;
  }

  .notice {
    margin: 0 0 12px;
    color: var(--color-success);
    font-size: 0.875rem;
  }

  .load-more-wrap {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }

  .type-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .unlink-content { display: flex; flex-direction: column; gap: 10px; }
  .unlink-content p { margin: 0; line-height: 1.45; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 6px; }

  @media (max-width: 540px) {
    :global(.tracked-issues-card .bento-card__header-left) {
      flex-basis: 100%;
    }

    :global(.tracked-issues-card .bento-card__header-actions) {
      display: flex;
      flex-basis: 100%;
      flex-wrap: wrap;
      gap: 8px;
    }
  }
</style>

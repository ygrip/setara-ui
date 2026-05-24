<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import { listAggregateStatisticHistory, type AggregateStatisticPoint } from '$lib/api/statistics';

  let { data } = $props();

  let initialized = false;
  let chartStart = $state('');
  let chartEnd = $state('');
  let groupedBy = $state<'daily' | 'weekly' | 'monthly'>('daily');
  let aggregateHistory = $state<AggregateStatisticPoint[]>([]);
  let chartBusy = $state(false);
  let chartError = $state('');

  $effect(() => {
    if (initialized) return;
    chartStart = data.chartStart;
    chartEnd = data.chartEnd;
    groupedBy = data.groupedBy;
    aggregateHistory = data.aggregateHistory;
    initialized = true;
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function compactDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short'
    });
  }

  const coverageTrend = $derived({
    labels: aggregateHistory.map(row => compactDate(row.bucketDate)),
    datasets: [
      {
        type: 'bar',
        label: 'Total Scenarios',
        data: aggregateHistory.map(row => row.totalScenarios),
        backgroundColor: 'rgba(15, 118, 110, 0.22)',
        borderColor: '#0f766e',
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Total Automated',
        data: aggregateHistory.map(row => row.totalAutomated),
        backgroundColor: 'rgba(37, 99, 235, 0.22)',
        borderColor: '#2563eb',
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Automation Coverage %',
        data: aggregateHistory.map(row => row.automationCoveragePercentage),
        borderColor: '#b45309',
        backgroundColor: 'rgba(180, 83, 9, 0.12)',
        tension: 0.35,
        pointRadius: 3,
        yAxisID: 'y1'
      }
    ]
  });

  async function refreshChart() {
    if (!chartStart || !chartEnd) return;
    chartBusy = true;
    chartError = '';
    try {
      aggregateHistory = await listAggregateStatisticHistory(chartStart, chartEnd, groupedBy);
    } catch (e) {
      chartError = (e as Error).message;
    } finally {
      chartBusy = false;
    }
  }
</script>

<svelte:head>
  <title>Dashboard — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Quality overview across all projects</p>
    </div>
  </div>

  {#if data.error}
    <div class="error-banner">
      Could not connect to backend — {data.error}
    </div>
  {/if}

  <!-- Metric cards row -->
  <div class="metrics-row">
    <MetricCard
      label="Total Squads"
      value={data.summary?.totalSquads ?? '—'}
      variant="info"
      icon="M3 7h18M3 12h18M3 17h18"
    />
    <MetricCard
      label="Total Projects"
      value={data.summary?.totalProjects ?? '—'}
      variant="default"
      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
    <MetricCard
      label="Total Scenarios"
      value={data.summary?.totalScenarios ?? '—'}
      variant="default"
      icon="M22 12h-4l-3 9L9 3l-3 9H2"
    />
    <MetricCard
      label="Overall Pass"
      value={`${Number(data.summary?.overallPassPercentage ?? 0).toFixed(0)}%`}
      sub={`automation ${Number(data.summary?.automationCoveragePercentage ?? 0).toFixed(0)}%`}
      variant="default"
      icon="M12 2a10 10 0 100 20 10 10 0 000-20z"
    />
  </div>

  <div class="chart-section">
    <div class="section-heading">
      <div>
        <h2 class="section-title">Overall Coverage Trend</h2>
        <p class="section-subtitle">Total scenarios, automated scenarios, and automation coverage over time.</p>
      </div>
      <div class="chart-controls">
        <label>Start <input type="date" bind:value={chartStart} onchange={refreshChart} /></label>
        <label>End <input type="date" bind:value={chartEnd} onchange={refreshChart} /></label>
        <label>Group
          <select bind:value={groupedBy} onchange={refreshChart}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
    </div>
    <div class="chart-card">
      <LineChart chartData={coverageTrend} height={220} />
      {#if chartBusy}<p class="chart-note">Refreshing chart…</p>{/if}
      {#if chartError}<p class="chart-error">{chartError}</p>{/if}
    </div>
  </div>

  <!-- Recent projects -->
  <div class="section">
    <h2 class="section-title">Recent Projects</h2>
    {#if data.projects.length === 0 && !data.error}
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3">
          <path d="M3 7h18M3 12h18M3 17h18"/>
        </svg>
        <p>No projects yet — create your first project in the <a href="/projects">Projects section</a>.</p>
      </div>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Project Key</th>
            <th>Name</th>
            <th>Created</th>
            <th></th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each data.projects as project (project.id)}
            <tr>
              <td><span class="key-badge">{project.projectKey}</span></td>
              <td class="bold">{project.name}</td>
              <td class="muted">{formatDate(project.createdAt)}</td>
              <td><a href="/projects/{project.projectKey}" class="link">Open →</a></td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
  </div>

</div>

<style>
  .page { max-width: 1100px; }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .page-subtitle {
    color: var(--color-text-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  .error-banner {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 0.875rem;
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .section {
    margin-bottom: 32px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--color-text);
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .chart-controls {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chart-controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .chart-controls input,
  .chart-controls select {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 7px 9px;
  }

  .chart-note,
  .chart-error {
    margin: 8px 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .chart-error { color: var(--color-danger); }

  .section-subtitle {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .empty-state p { margin: 12px 0 0; font-size: 0.875rem; }

  .chart-section {
    margin-bottom: 32px;
  }

  .chart-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: var(--shadow);
  }

  .bold { font-weight: 500; }
  .muted { color: var(--color-text-muted); font-size: 0.875rem; }

  .key-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .link {
    color: var(--color-accent);
    font-size: 0.8rem;
    font-weight: 500;
  }

</style>

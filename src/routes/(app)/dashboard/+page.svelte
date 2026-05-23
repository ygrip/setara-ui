<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import { type Project } from '$lib/api/projects';
  import { passRateTrend } from '$lib/mock/data';

  let { data } = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  const totals = $derived(data.statistics.reduce(
    (acc, row) => ({
      scenarios: acc.scenarios + row.totalScenarios,
      automated: acc.automated + row.totalAutomated,
      automatable: acc.automatable + row.totalAutomatable
    }),
    { scenarios: 0, automated: 0, automatable: 0 }
  ));
  const overallCoverage = $derived(
    totals.automatable === 0 ? 0 : Math.round((totals.automated / totals.automatable) * 100)
  );
  const coverageTrend = $derived({
    labels: data.statistics.map(row => row.projectKey),
    datasets: [{
      label: 'Coverage %',
      data: data.statistics.map(row => row.coveragePercentage),
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
      pointBackgroundColor: '#0d9488'
    }]
  });
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
      label="Total Projects"
      value={data.projects.length}
      variant="info"
      icon="M3 7h18M3 12h18M3 17h18"
    />
    <MetricCard
      label="Projects Tracked"
      value={data.statistics.length}
      sub="tracked projects"
      variant="default"
      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
    <MetricCard
      label="Overall Pass Rate"
      value={totals.automated}
      sub="automated scenarios"
      variant="default"
      icon="M22 12h-4l-3 9L9 3l-3 9H2"
    />
    <MetricCard
      label="Automation Coverage"
      value={`${overallCoverage}%`}
      sub={`${totals.automatable} automatable`}
      variant="default"
      icon="M12 2a10 10 0 100 20 10 10 0 000-20z"
    />
  </div>

  <div class="section">
    <h2 class="section-title">Leadership Coverage Overview</h2>
    {#if data.statistics.length === 0}
      <div class="empty-state"><p>No project statistics captured yet.</p></div>
    {:else}
      <DataTable>
        {#snippet head()}
          <tr>
            <th>Project</th>
            <th>Total Scenarios</th>
            <th>Automated</th>
            <th>Automatable</th>
            <th>Coverage</th>
            <th>Snapshot</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each data.statistics as row}
            <tr>
              <td><span class="key-badge">{row.projectKey}</span> <span class="project-name">{row.projectName}</span></td>
              <td>{row.totalScenarios}</td>
              <td>{row.totalAutomated}</td>
              <td>{row.totalAutomatable}</td>
              <td><strong>{row.coveragePercentage}%</strong></td>
              <td class="muted">{formatDate(row.statDate)}</td>
            </tr>
          {/each}
        {/snippet}
      </DataTable>
    {/if}
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

  <!-- Pass Rate Trend Chart -->
  <div class="chart-section">
    <h2 class="section-title">Pass Rate Trend</h2>
    <div class="chart-card">
      <LineChart chartData={data.statistics.length ? coverageTrend : passRateTrend} height={220} />
    </div>
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
    margin-bottom: 14px;
    color: var(--color-text);
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

  .project-name {
    margin-left: 8px;
    color: var(--color-text);
  }
</style>

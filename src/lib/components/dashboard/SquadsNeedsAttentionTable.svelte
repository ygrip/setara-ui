<script lang="ts">
  import type { DashboardSquadSummary } from '$lib/api/dashboard';
  import { AppSkeleton } from '$lib/ui/display';
  import QualityStatusBadge from './QualityStatusBadge.svelte';

  let {
    squads,
    loading = false,
    error = ''
  }: {
    squads: DashboardSquadSummary[];
    loading?: boolean;
    error?: string;
  } = $props();
</script>

<section class="squads-card surface-card" aria-labelledby="squads-attention-title">
  <div class="squads-header">
    <div>
      <h2 id="squads-attention-title">Squads needing attention</h2>
      <p>Bottom 5 squads ranked by average quality health, lowest first.</p>
    </div>
    <a href="/coverage-overview">View squads <span aria-hidden="true">→</span></a>
  </div>

  {#if loading}
    <div class="squads-loading" role="status" aria-label="Loading squad health">
      <AppSkeleton height="42px" lines={4} />
    </div>
  {:else if error}
    <div class="squads-state squads-state--error">
      <strong>Could not load squad health</strong>
      <span>{error}</span>
    </div>
  {:else if squads.length === 0}
    <div class="squads-state">
      <strong>All squads healthy</strong>
      <span>No squads need attention right now.</span>
    </div>
  {:else}
    <div class="squads-scroll">
      <table>
        <thead>
          <tr>
            <th>Squad</th>
            <th>Tribe</th>
            <th>Projects</th>
            <th>Health score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each squads as squad (squad.squadId)}
            <tr>
              <td><a class="squad-link" href={`/squads/${squad.squadId}`}><span class="squad-name">{squad.squadName}</span></a></td>
              <td class="tribe-cell">{squad.tribeName ?? 'Not assigned'}</td>
              <td class="number-cell">{squad.projectCount}</td>
              <td class="number-cell">{Math.round(squad.avgQualityHealthScore)}<span class="score-unit">/100</span></td>
              <td><QualityStatusBadge status={squad.status} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .squads-card {
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius);
  }

  .squads-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px 14px;
  }

  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 750;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .squads-header > a {
    display: inline-flex;
    gap: 5px;
    color: var(--color-accent);
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .squads-scroll {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
  }

  th {
    padding: 11px 16px;
    border-top: 1px solid color-mix(in srgb, var(--color-border), transparent 25%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border), transparent 25%);
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-bg), transparent 18%);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    padding: 13px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border), transparent 40%);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 550;
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: color-mix(in srgb, var(--color-accent), transparent 96%); }

  .squad-link {
    display: inline-flex;
    flex-direction: column;
    color: inherit;
    text-decoration: none;
  }

  .squad-link:hover .squad-name,
  .squad-link:focus-visible .squad-name { color: var(--color-accent); }

  .squad-name {
    color: var(--color-text);
    font-weight: 750;
  }

  .tribe-cell { color: var(--color-text-muted); }

  .number-cell {
    color: var(--color-text);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .score-unit {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 550;
  }

  .squads-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 190px;
    padding: 28px;
    text-align: center;
  }

  .squads-loading {
    min-height: 190px;
    padding: 16px 20px 22px;
  }

  .squads-state strong { color: var(--color-text); font-size: 0.86rem; }
  .squads-state span { margin-top: 4px; color: var(--color-text-muted); font-size: 0.76rem; }
  .squads-state--error strong { color: var(--color-danger); }
</style>

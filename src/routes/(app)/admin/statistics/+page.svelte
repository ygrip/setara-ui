<script lang="ts">
  import { isMockMode } from '$lib/mock/client';
  import { triggerBackfill, type BackfillResult } from '$lib/api/statistics';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  const isMock = isMockMode();

  // Default: last 30 days → yesterday
  function todayMinus(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  let fromDate = $state(todayMinus(30));
  let toDate = $state(todayMinus(1));
  let busy = $state(false);
  let result = $state<BackfillResult | null>(null);
  let errorMsg = $state('');

  async function runBackfill() {
    busy = true;
    result = null;
    errorMsg = '';
    try {
      result = await triggerBackfill(fromDate || undefined, toDate || undefined);
    } catch (e: any) {
      errorMsg = e.message ?? 'Backfill failed';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Statistics - Admin - Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if isMock}
    <Card padding="md">
      <EmptyState
        title="Not available in preview mode"
        hint="Statistics backfill requires a live backend with a connected database."
        minHeight="260px"
      >
        <svg slot="icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </EmptyState>
    </Card>
  {:else}
    <Card padding="md">
      <h2 class="panel-title">Backfill Date Range</h2>
      <p class="panel-desc">
        Computes and inserts missing statistics snapshots for all active projects within the given date range.
        Existing records are skipped. Dates are clamped to yesterday and no further back than 2 years.
      </p>

      <div class="inline-form">
        <label class="field">
          <span class="field-label">From</span>
          <input class="input" type="date" bind:value={fromDate} disabled={busy} />
        </label>
        <label class="field">
          <span class="field-label">To</span>
          <input class="input" type="date" bind:value={toDate} disabled={busy} />
        </label>
        <Button variant="primary" onclick={runBackfill} disabled={busy}>
          {busy ? 'Running…' : 'Run Backfill'}
        </Button>
      </div>

      {#if result}
        <div class="result-box">
          <div class="result-grid">
            <div class="result-cell">
              <span class="result-label">Inserted</span>
              <span class="result-value inserted">{result.inserted}</span>
            </div>
            <div class="result-cell">
              <span class="result-label">Skipped</span>
              <span class="result-value skipped">{result.skipped}</span>
            </div>
            <div class="result-cell">
              <span class="result-label">Range</span>
              <span class="result-value range">{result.from} → {result.to}</span>
            </div>
          </div>
        </div>
      {/if}

      {#if errorMsg}
        <AppAlert tone="error">{errorMsg}</AppAlert>
      {/if}
    </Card>
  {/if}
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .panel-title { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--color-text); }
  .panel-desc { margin: 0 0 16px; font-size: 0.875rem; color: var(--color-text-muted); line-height: 1.55; }

  .inline-form { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); font-size: 0.875rem; outline: none; transition: border-color 0.15s; font-family: inherit; }
  .input:focus { border-color: var(--color-accent); }
  .input:disabled { opacity: 0.5; }

  .result-box { margin-top: 16px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; }
  .result-grid { display: flex; gap: 32px; flex-wrap: wrap; }
  .result-cell { display: flex; flex-direction: column; gap: 4px; }
  .result-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .result-value { font-size: 1.1rem; font-weight: 700; }
  .result-value.inserted { color: #16a34a; }
  .result-value.skipped { color: var(--color-text-muted); }
  .result-value.range { font-size: 0.875rem; font-weight: 500; color: var(--color-text); font-family: var(--font-mono, monospace); }

  @media (max-width: 600px) {
    .inline-form { flex-direction: column; align-items: stretch; }
    .result-grid { gap: 16px; }
  }
</style>

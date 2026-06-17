<script lang="ts">
  import { isMockMode } from '$lib/mock/client';
  import { triggerBackfill, type BackfillResult } from '$lib/api/statistics';

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

<svelte:head><title>Statistics — Admin — Setara</title></svelte:head>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Statistics</h1>
    <p class="page-subtitle">Backfill historical automation coverage statistics for all active projects</p>
  </div>

  {#if isMock}
    <div class="disabled-state">
      <div class="disabled-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>
      <h2 class="disabled-title">Not available in preview mode</h2>
      <p class="disabled-desc">Statistics backfill requires a live backend with a connected database.</p>
    </div>
  {:else}
    <div class="action-card">
      <h3 class="action-title">Backfill Date Range</h3>
      <p class="action-desc">
        Computes and inserts missing statistics snapshots for all active projects within the given date range.
        Existing records are skipped. Dates are clamped to yesterday and no further back than 2 years.
      </p>
      <div class="form-row">
        <label class="field">
          <span class="field-label">From</span>
          <input class="date-input" type="date" bind:value={fromDate} disabled={busy} />
        </label>
        <label class="field">
          <span class="field-label">To</span>
          <input class="date-input" type="date" bind:value={toDate} disabled={busy} />
        </label>
        <button class="primary-btn" onclick={runBackfill} disabled={busy}>
          {busy ? 'Running…' : 'Run Backfill'}
        </button>
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
        <p class="error-msg">{errorMsg}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 720px; margin: 0 auto; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { margin: 0; color: var(--color-text-muted); font-size: 0.875rem; }

  .disabled-state { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .disabled-icon { width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); display: flex; align-items: center; justify-content: center; }
  .disabled-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--color-text); }
  .disabled-desc { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); max-width: 480px; line-height: 1.6; }

  .action-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 24px; }
  .action-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 6px; }
  .action-desc { margin: 0 0 20px; font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.6; }

  .form-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .date-input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; }
  .date-input:disabled { opacity: 0.5; }

  .primary-btn { background: var(--color-accent); color: #fff; border: none; border-radius: var(--radius); padding: 8px 18px; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s; align-self: flex-end; }
  .primary-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
  .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .result-box { margin-top: 20px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; }
  .result-grid { display: flex; gap: 32px; flex-wrap: wrap; }
  .result-cell { display: flex; flex-direction: column; gap: 4px; }
  .result-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .result-value { font-size: 1.1rem; font-weight: 700; }
  .result-value.inserted { color: #16a34a; }
  .result-value.skipped { color: var(--color-text-muted); }
  .result-value.range { font-size: 0.875rem; font-weight: 500; color: var(--color-text); font-family: var(--font-mono, monospace); }

  .error-msg { margin: 14px 0 0; font-size: 0.85rem; color: var(--color-danger, #dc2626); }

  @media (max-width: 600px) {
    .form-row { flex-direction: column; align-items: stretch; }
    .primary-btn { align-self: flex-start; }
    .result-grid { gap: 16px; }
  }
</style>

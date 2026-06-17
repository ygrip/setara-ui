<script lang="ts">
  import { isMockMode } from '$lib/mock/client';
  import { getCacheStatus, purgeAll, purgeByPattern, type CacheStatus, type PurgeResult } from '$lib/api/cache';
  import { onMount } from 'svelte';

  const isMock = isMockMode();

  let status = $state<CacheStatus | null>(null);
  let pattern = $state('');
  let busy = $state(false);
  let result = $state<PurgeResult | null>(null);
  let errorMsg = $state('');
  let statusError = $state('');

  onMount(async () => {
    if (isMock) return;
    try {
      status = await getCacheStatus();
    } catch (e: any) {
      statusError = e.message ?? 'Could not load cache status';
    }
  });

  async function runPurgeAll() {
    busy = true;
    result = null;
    errorMsg = '';
    try {
      result = await purgeAll();
    } catch (e: any) {
      errorMsg = e.message ?? 'Purge failed';
    } finally {
      busy = false;
    }
  }

  async function runPurgeByPattern() {
    if (!pattern.trim()) return;
    busy = true;
    result = null;
    errorMsg = '';
    try {
      result = await purgeByPattern(pattern.trim());
    } catch (e: any) {
      errorMsg = e.message ?? 'Purge failed';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Cache — Admin — Setara</title></svelte:head>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Cache</h1>
    <p class="page-subtitle">Purge Redis cache entries by key pattern or flush all cached data</p>
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
      <p class="disabled-desc">Cache management requires a live backend with Redis configured.</p>
    </div>
  {:else}
    {#if status}
      <div class="status-card">
        <div class="status-row">
          <span class="status-label">Redis Cache</span>
          <span class="status-badge" class:status-badge--on={status.enabled} class:status-badge--off={!status.enabled}>
            {status.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        {#if status.enabled}
          <div class="status-row">
            <span class="status-label">Key Prefix</span>
            <code class="status-code">{status.keyPrefix}</code>
          </div>
        {/if}
      </div>
    {/if}

    {#if statusError}
      <p class="error-msg">{statusError}</p>
    {/if}

    <div class="cards-grid">
      <div class="action-card">
        <h3 class="action-title">Purge All</h3>
        <p class="action-desc">
          Delete every key under the configured prefix. Use after a schema change or when stale data is suspected.
          Returns false if the cache is disabled.
        </p>
        <button class="danger-btn" onclick={runPurgeAll} disabled={busy}>
          {busy ? 'Purging…' : 'Purge All Keys'}
        </button>
      </div>

      <div class="action-card">
        <h3 class="action-title">Purge by Pattern</h3>
        <p class="action-desc">
          Delete keys matching a prefix pattern, e.g. <code>project:MYPROJ</code> to clear a single project's cache.
        </p>
        <div class="form-row">
          <input
            class="pattern-input"
            type="text"
            placeholder="e.g. project:MYPROJ"
            bind:value={pattern}
            disabled={busy}
          />
          <button class="primary-btn" onclick={runPurgeByPattern} disabled={busy || !pattern.trim()}>
            {busy ? 'Purging…' : 'Purge'}
          </button>
        </div>
      </div>
    </div>

    {#if result}
      <div class="result-box" class:result-box--disabled={!result.enabled}>
        {#if !result.enabled}
          <p class="result-disabled">Cache is disabled — no keys were purged.</p>
        {:else}
          <div class="result-grid">
            <div class="result-cell">
              <span class="result-label">Keys Purged</span>
              <span class="result-value">{result.purged}</span>
            </div>
            <div class="result-cell">
              <span class="result-label">Status</span>
              <span class="result-value result-value--ok">Done</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {/if}
  {/if}
</div>

<style>
  .page { max-width: 820px; margin: 0 auto; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
  .page-subtitle { margin: 0; color: var(--color-text-muted); font-size: 0.875rem; }

  .disabled-state { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .disabled-icon { width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--color-accent), transparent 88%); color: var(--color-accent); display: flex; align-items: center; justify-content: center; }
  .disabled-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
  .disabled-desc { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); max-width: 480px; line-height: 1.6; }

  .status-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
  .status-row { display: flex; align-items: center; gap: 12px; }
  .status-label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; min-width: 100px; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
  .status-badge--on { background: color-mix(in srgb, #16a34a, transparent 85%); color: #16a34a; }
  .status-badge--off { background: color-mix(in srgb, var(--color-text-muted), transparent 85%); color: var(--color-text-muted); }
  .status-code { font-family: var(--font-mono, monospace); font-size: 0.85rem; background: var(--color-bg); padding: 2px 6px; border-radius: 4px; }

  .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }

  @media (max-width: 640px) {
    .cards-grid { grid-template-columns: 1fr; }
  }

  .action-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; }
  .action-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 6px; }
  .action-desc { margin: 0 0 16px; font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.6; }
  .action-desc code { font-family: var(--font-mono, monospace); background: var(--color-bg); padding: 1px 4px; border-radius: 3px; font-size: 0.82em; }

  .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .pattern-input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 0.875rem; font-family: var(--font-mono, monospace); }
  .pattern-input:disabled { opacity: 0.5; }

  .primary-btn { background: var(--color-accent); color: #fff; border: none; border-radius: var(--radius); padding: 8px 16px; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .primary-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
  .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .danger-btn { background: var(--color-danger, #dc2626); color: #fff; border: none; border-radius: var(--radius); padding: 8px 16px; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
  .danger-btn:hover:not(:disabled) { opacity: 0.88; }
  .danger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .result-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 12px; }
  .result-box--disabled { border-color: color-mix(in srgb, var(--color-text-muted), transparent 70%); }
  .result-disabled { margin: 0; font-size: 0.875rem; color: var(--color-text-muted); }
  .result-grid { display: flex; gap: 32px; flex-wrap: wrap; }
  .result-cell { display: flex; flex-direction: column; gap: 4px; }
  .result-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .result-value { font-size: 1.1rem; font-weight: 700; }
  .result-value--ok { color: #16a34a; }

  .error-msg { margin: 8px 0 0; font-size: 0.85rem; color: var(--color-danger, #dc2626); }
</style>

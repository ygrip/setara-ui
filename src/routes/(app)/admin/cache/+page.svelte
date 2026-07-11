<script lang="ts">
  import { isMockMode } from '$lib/mock/client';
  import { getCacheStatus, purgeAll, purgeByPattern, type CacheStatus, type PurgeResult } from '$lib/api/cache';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import AppAlert from '$lib/ui/feedback/AppAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
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

<svelte:head><title>Cache - Admin - Setara</title></svelte:head>

<div class="section-wrap">
  <h1 class="page-title">Settings</h1>

  {#if isMock}
    <Card padding="md">
      <EmptyState
        title="Not available in preview mode"
        hint="Cache management requires a live backend with Redis configured."
        minHeight="260px"
      >
        <svg slot="icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </EmptyState>
    </Card>
  {:else}
    {#if statusError}
      <AppAlert tone="error">{statusError}</AppAlert>
    {/if}

    {#if status}
      <Card padding="md">
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
      </Card>
    {/if}

    <div class="cards-grid">
      <Card padding="md">
        <h2 class="panel-title">Purge All</h2>
        <p class="panel-desc">
          Delete every key under the configured prefix. Use after a schema change or when stale data is suspected.
        </p>
        <div class="action-row">
          <Button variant="danger" onclick={runPurgeAll} disabled={busy}>
            {busy ? 'Purging…' : 'Purge All Keys'}
          </Button>
        </div>
        
      </Card>

      <Card padding="md">
        <h2 class="panel-title">Purge by Pattern</h2>
        <p class="panel-desc">
          Delete keys matching a prefix pattern, e.g. <code>project:MYPROJ</code> to clear a single project's cache.
        </p>
        <div class="inline-form">
          <input
            class="input"
            type="text"
            placeholder="e.g. project:MYPROJ"
            bind:value={pattern}
            disabled={busy}
          />

          <div class="action-row">
          <Button variant="primary" onclick={runPurgeByPattern} disabled={busy || !pattern.trim()}>
            {busy ? 'Purging…' : 'Purge'}
          </Button>
          </div>
        </div>
      </Card>
    </div>

    {#if result}
      <Card padding="md">
        {#if !result.enabled}
          <p class="empty-text">Cache is disabled - no keys were purged.</p>
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
      </Card>
    {/if}

    {#if errorMsg}
      <AppAlert tone="error">{errorMsg}</AppAlert>
    {/if}
  {/if}
</div>

<style>
  .section-wrap { display: flex; flex-direction: column; gap: 20px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .panel-title { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--color-text); }
  .panel-desc { margin: 0 0 14px; font-size: 0.875rem; color: var(--color-text-muted); line-height: 1.55; }
  .panel-desc code { font-family: var(--font-mono, monospace); background: var(--color-bg); padding: 1px 4px; border-radius: 3px; font-size: 0.82em; }
  .empty-text { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

  .status-row { display: flex; align-items: center; gap: 12px; }
  .status-label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; min-width: 100px; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
  .status-badge--on { background: color-mix(in srgb, #16a34a, transparent 85%); color: #16a34a; }
  .status-badge--off { background: color-mix(in srgb, var(--color-text-muted), transparent 85%); color: var(--color-text-muted); }
  .status-code { font-family: var(--font-mono, monospace); font-size: 0.85rem; background: var(--color-bg); padding: 2px 6px; border-radius: 4px; }

  .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) {
    .cards-grid { grid-template-columns: 1fr; }
    .inline-form { flex-direction: column; align-items: stretch; }
    .inline-form .input { min-width: 0; width: 100%; }
    .action-row { flex-direction: column; align-items: stretch; gap: 10px; }
  }

  @media (max-width: 760px) {
    .action-row { flex-direction: column; align-items: stretch !important; gap: 10px; }
  }

  .action-row { 
    width: 100%;
    display: flex; gap: 8px;
    flex-wrap: wrap;
  }

  .inline-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .inline-form .input { flex: 1; min-width: 140px; }
  .input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); font-size: 0.875rem; outline: none; transition: border-color 0.15s; font-family: var(--font-mono, monospace); }
  .input:focus { border-color: var(--color-accent); }
  .input:disabled { opacity: 0.5; }

  .result-grid { display: flex; gap: 32px; flex-wrap: wrap; }
  .result-cell { display: flex; flex-direction: column; gap: 4px; }
  .result-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
  .result-value { font-size: 1.1rem; font-weight: 700; }
  .result-value--ok { color: #16a34a; }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import { getValidSession } from '$lib/auth';

  let role = $state<string | null>(null);

  onMount(() => {
    const session = getValidSession();
    role = session?.role ?? null;
  });
</script>

<svelte:head>
  <title>Access Restricted - Setara</title>
</svelte:head>

<div class="forbidden-wrap">
  <Card padding="lg">
    <div class="forbidden-content">
    <div class="lock-icon" aria-hidden="true">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>

    <h1 class="heading">Access Restricted</h1>
    <p class="subtext">You don't have permission to access this page.</p>

    {#if role}
      <div class="role-badge-wrap">
        <span class="role-label">Your current role</span>
        <span class="role-badge">{role}</span>
      </div>
    {/if}

    <div class="actions">
      <Button variant="secondary" onclick={() => history.back()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Go Back
      </Button>
      <Button variant="primary" href="/dashboard">Go to Dashboard</Button>
    </div>
    </div>
  </Card>
</div>

<style>
  .forbidden-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - var(--topbar-height, 56px) - 80px);
    padding: 40px 20px;
  }

  .forbidden-wrap :global(.card) {
    max-width: 420px;
    width: 100%;
  }

  .forbidden-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .lock-icon {
    color: var(--color-danger);
    opacity: 0.85;
    margin-bottom: 4px;
  }

  .heading {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .subtext {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.55;
  }

  .role-badge-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .role-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 14px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

</style>

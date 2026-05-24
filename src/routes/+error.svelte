<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Error {$page.status} — Setara</title>
</svelte:head>

<div class="error-page">
  <div class="error-card">
    <!-- Animated icon -->
    <div class="icon-wrap" aria-hidden="true">
      <svg class="icon-bg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="90" />
      </svg>
      <svg class="icon-main" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
           xmlns="http://www.w3.org/2000/svg">
        {#if $page.status === 404}
          <!-- Magnifying glass with question mark for not-found -->
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="12"/>
          <circle cx="11" cy="15" r="0.5" fill="currentColor"/>
        {:else if $page.status === 403}
          <!-- Lock for forbidden -->
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        {:else if $page.status >= 500}
          <!-- Server error -->
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
          <path d="M9 13s1-1 3-1 3 1 3 1"/>
        {:else}
          <!-- Generic alert triangle -->
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        {/if}
      </svg>
    </div>

    <div class="status-code">{$page.status}</div>

    <h1 class="title">
      {#if $page.status === 404}
        Page not found
      {:else if $page.status === 403}
        Access denied
      {:else if $page.status === 401}
        Authentication required
      {:else if $page.status >= 500}
        Something went wrong
      {:else}
        Unexpected error
      {/if}
    </h1>

    <p class="message">
      {#if $page.error?.message && $page.error.message !== 'Not Found'}
        {$page.error.message}
      {:else if $page.status === 404}
        The page or resource you're looking for doesn't exist or may have been moved.
      {:else if $page.status === 403}
        You don't have permission to access this resource.
      {:else if $page.status === 401}
        Please sign in to continue.
      {:else if $page.status >= 500}
        We ran into an internal error. Please try again, or contact your administrator if the problem persists.
      {:else}
        An unexpected error occurred. Please go back and try again.
      {/if}
    </p>

    <div class="actions">
      <a href="/" class="btn btn-primary">Go home</a>
      <button class="btn btn-secondary" onclick={() => history.back()}>Go back</button>
    </div>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-bg, #f8fafc);
  }

  .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 440px;
    width: 100%;
    text-align: center;
  }

  /* Animated icon */
  .icon-wrap {
    position: relative;
    width: 100px;
    height: 100px;
    margin-bottom: 8px;
  }

  .icon-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: pulse-bg 3s ease-in-out infinite;
  }

  .icon-bg circle {
    fill: color-mix(in srgb, var(--color-accent, #6366f1), transparent 88%);
  }

  .icon-main {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
    color: var(--color-accent, #6366f1);
    animation: float 3s ease-in-out infinite;
  }

  @keyframes pulse-bg {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.06); opacity: 0.7; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }

  .status-code {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-accent, #6366f1);
    background: color-mix(in srgb, var(--color-accent, #6366f1), transparent 88%);
    padding: 4px 12px;
    border-radius: 999px;
  }

  .title {
    font-size: 1.6rem;
    font-weight: 850;
    line-height: 1.25;
    margin: 0;
    color: var(--color-text, #1e293b);
  }

  .message {
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
    line-height: 1.65;
    margin: 0;
    max-width: 360px;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    padding: 9px 20px;
    border-radius: 8px;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid var(--color-border, #e2e8f0);
    transition: border-color 0.12s, background 0.12s, color 0.12s;
  }

  .btn-primary {
    background: var(--color-accent, #6366f1);
    color: #fff;
    border-color: var(--color-accent, #6366f1);
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--color-accent, #6366f1), #000 12%);
    border-color: color-mix(in srgb, var(--color-accent, #6366f1), #000 12%);
  }

  .btn-secondary {
    background: var(--color-surface, #fff);
    color: var(--color-text, #1e293b);
  }

  .btn-secondary:hover {
    border-color: var(--color-accent, #6366f1);
    color: var(--color-accent, #6366f1);
  }
</style>

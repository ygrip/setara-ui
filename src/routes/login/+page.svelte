<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import SetaraLoader from '$lib/components/SetaraLoader.svelte';
  import { getValidSession, storeSession, sessionFromLoginResult } from '$lib/auth';
  import { login } from '$lib/api/client';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  onMount(() => {
    if (getValidSession()) {
      goto('/dashboard', { replaceState: true });
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!email.trim() || !password.trim()) {
      error = 'Please enter your email and password.';
      return;
    }
    loading = true;
    try {
      const result = await login(email.trim(), password);
      storeSession(sessionFromLoginResult(result));
      goto('/dashboard', { replaceState: true });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed. Please try again.';
    } finally {
      loading = false;
    }
  }

  function quickLogin(_account: unknown) {
    goto('/dashboard', { replaceState: true });
  }
</script>

<svelte:head>
  <title>Sign in — Setara</title>
</svelte:head>

<div class="login-page">
  <div class="login-card">
    <div class="login-brand">
      <SetaraLoader mode="orbit" size={54} label="Setara" />
      <span class="brand-name">SETARA</span>
    </div>

    <h1 class="login-title">Sign in to Setara</h1>
    <p class="login-sub">Test case management and automation reporting</p>

    <form onsubmit={handleSubmit} class="form" novalidate>
      <label class="field">
        <span class="label">Email</span>
        <input
          class="input"
          type="email"
          autocomplete="email"
          bind:value={email}
          placeholder="you@example.com"
          required
        />
      </label>

      <label class="field">
        <span class="label">Password</span>
        <input
          class="input"
          type="password"
          autocomplete="current-password"
          bind:value={password}
          placeholder="••••••••"
          required
        />
      </label>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <button class="submit-btn" type="submit" disabled={loading}>
        {#if loading}
          <SetaraLoader mode="progress" size={24} label="Signing in" />
          <span>Signing in…</span>
        {:else}
          <span>Sign in</span>
        {/if}
      </button>
    </form>

  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    padding: 24px;
  }

  .login-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius) * 1.5);
    box-shadow: var(--shadow-md);
    padding: 40px;
    width: 100%;
    max-width: 400px;
  }

  .login-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
  }

  .brand-name {
    font-family: var(--font-sans, "Sora", sans-serif);
    font-size: 1.24rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    background: linear-gradient(120deg, #00AFA5 0%, #5EF2D6 45%, #00C2B8 70%, #00AFA5 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: brand-shimmer 5s ease-in-out infinite;
  }

  @keyframes brand-shimmer {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .login-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .login-sub {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin: 0 0 28px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .input {
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
  }

  .input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgb(56 99 90 / 0.12);
  }

  .error-msg {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
    border-radius: var(--radius);
    padding: 10px 12px;
    font-size: 0.8rem;
  }

  .submit-btn {
    padding: 11px 16px;
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: background 0.15s, opacity 0.15s;
    width: 100%;
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-btn :global(.loader) {
    --loader-accent: #ffffff;
    --loader-mint: #ffffff;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .demo-accounts {
    margin-top: 24px;
    border-top: 1px solid var(--color-border);
    padding-top: 20px;
  }

  .demo-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    margin-bottom: 10px;
  }

  .demo-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .demo-chip {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    font-family: inherit;
  }

  .demo-chip:hover { background: var(--color-accent-subtle); border-color: var(--color-accent); color: var(--color-accent); }
  .demo-chip--admin  { border-color: #7c3aed40; color: #7c3aed; background: #7c3aed0a; }
  .demo-chip--admin:hover  { background: #7c3aed18; border-color: #7c3aed; }
  .demo-chip--qa     { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-subtle); }
  .demo-chip--qa:hover { background: color-mix(in srgb, var(--color-accent), transparent 82%); }
  .demo-chip--viewer { border-color: #0284c740; color: #0284c7; background: #0284c70a; }
  .demo-chip--viewer:hover { background: #0284c718; border-color: #0284c7; }
  .demo-chip--guest  { border-color: var(--color-border); color: var(--color-text-muted); }

  .demo-note {
    text-align: center;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .demo-note code {
    font-family: var(--font-mono, monospace);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 0.72rem;
  }
</style>

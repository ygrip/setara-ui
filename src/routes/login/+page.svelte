<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  onMount(() => {
    // Already logged in? Go to workspace.
    const raw = localStorage.getItem('setara_session');
    if (raw) {
      try {
        JSON.parse(raw);
        goto('/workspace', { replaceState: true });
      } catch { /* ignore */ }
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
    // Mock authentication — any non-empty credentials pass
    await new Promise(r => setTimeout(r, 400));
    const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    localStorage.setItem('setara_session', JSON.stringify({ email: email.trim(), name }));
    goto('/workspace', { replaceState: true });
  }
</script>

<svelte:head>
  <title>Sign in — Setara</title>
</svelte:head>

<div class="login-page">
  <div class="login-card">
    <div class="login-brand">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="10" fill="var(--color-accent)"/>
        <path d="M10 12h16M10 18h11M10 24h7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <span class="brand-name">Setara</span>
    </div>

    <h1 class="login-title">Sign in to your workspace</h1>
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
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>

    <p class="demo-note">Demo mode — no real authentication</p>
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
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-accent);
    letter-spacing: -0.02em;
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
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .demo-note {
    margin-top: 20px;
    text-align: center;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    opacity: 0.7;
  }
</style>

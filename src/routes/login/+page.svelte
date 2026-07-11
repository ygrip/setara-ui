<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { APP_BUILD_LABEL, APP_VERSION_LABEL } from '$lib/app-metadata';
  import { login } from '$lib/api/client';
  import { getValidSession, sessionFromLoginResult, storeSession, type SetaraRole } from '$lib/auth';
  import LoginHero from '$lib/components/LoginHero.svelte';
  import SetaraGsapLogo from '$lib/components/SetaraGsapLogo.svelte';
  import SetaraLoader from '$lib/components/SetaraLoader.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isMockMode } from '$lib/mock/client';

  const CURRENT_YEAR = new Date().getFullYear();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  const reason = $derived(browser ? page.url.searchParams.get('reason') : null);
  const isDemo = isMockMode();

  const DEMO_ACCOUNTS: { label: string; role: SetaraRole; email: string; variant: string }[] = [
    { label: 'Admin', role: 'SYSTEM_ADMIN', email: 'admin@demo.setara.local', variant: 'admin' },
    { label: 'QA Lead', role: 'QA_LEAD', email: 'qa.lead@demo.setara.local', variant: 'qalead' },
    { label: 'QA', role: 'QA', email: 'qa@demo.setara.local', variant: 'qa' },
    { label: 'Developer', role: 'DEVELOPER', email: 'dev@demo.setara.local', variant: 'dev' },
    { label: 'Viewer', role: 'VIEWER', email: 'viewer@demo.setara.local', variant: 'viewer' },
    { label: 'Guest', role: 'GUEST', email: 'guest@demo.setara.local', variant: 'guest' }
  ];

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
      goto(result.pendingPasswordChange ? '/profile?reason=set_password' : '/dashboard', {
        replaceState: true
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed. Please try again.';
    } finally {
      loading = false;
    }
  }

  function quickLogin(account: (typeof DEMO_ACCOUNTS)[0]) {
    storeSession(
      sessionFromLoginResult({
        token: 'demo-token',
        email: account.email,
        displayName: account.label,
        systemRole: account.role,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      })
    );
    goto('/dashboard', { replaceState: true });
  }
</script>

<svelte:head>
  <title>Sign in - Setara</title>
</svelte:head>

<div class="login-page">
  <LoginHero />

  <section class="login-panel" aria-label="Sign in form">
    <div class="panel-sep" aria-hidden="true">
      <svg class="sep-svg" viewBox="0 0 20 100" preserveAspectRatio="none">
        <path
          class="sep-path"
          d="M10 0 C 18 8.33, 2 16.67, 10 25 C 18 33.33, 2 41.67, 10 50 C 18 58.33, 2 66.67, 10 75 C 18 83.33, 2 91.67, 10 100"
          fill="none"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <div class="theme-wrap">
      <ThemeToggle />
    </div>

    <div class="login-card surface-card">
      <div class="login-brand">
        <SetaraLoader mode="orbit" size={50} />
        <SetaraGsapLogo size={130} loop={true} />
      </div>

      <div class="form-heading">
        <h2>Welcome back</h2>
        <p>Sign in to continue managing release quality.</p>
      </div>

      {#if reason === 'password_changed'}
        <div class="info-msg">Password changed — please sign in with your new password.</div>
      {/if}

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
            placeholder="Password"
            required
          />
        </label>

        {#if error}
          <div class="error-msg">{error}</div>
        {/if}

        <button class="submit-btn" type="submit" disabled={loading}>
          {#if loading}
            <SetaraLoader mode="progress" size={24} label="Signing in" />
            <span>Signing in...</span>
          {:else}
            <span>Sign in</span>
          {/if}
        </button>
      </form>

      {#if isDemo}
        <div class="demo-accounts">
          <span class="demo-label">Quick login — demo accounts</span>
          <div class="demo-chips">
            {#each DEMO_ACCOUNTS as account}
              <button
                class="demo-chip demo-chip--{account.variant}"
                type="button"
                onclick={() => quickLogin(account)}
              >
                {account.label}
              </button>
            {/each}
          </div>
          <p class="demo-note">No changes are saved in demo mode.</p>
        </div>
      {/if}
    </div>

    <footer class="login-panel-footer" aria-label="Application version">
      <span>© {CURRENT_YEAR} Setara</span>
      <span class="footer-separator" aria-hidden="true"></span>
      <span>{APP_VERSION_LABEL}</span>
      <span>build {APP_BUILD_LABEL}</span>
    </footer>
  </section>
</div>

<style>
  .login-page {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(390px, 0.85fr);
    background:
      radial-gradient(ellipse 80% 60% at 20% 50%, color-mix(in srgb, var(--color-accent), transparent 74%), transparent),
      linear-gradient(160deg, color-mix(in srgb, var(--color-accent), transparent 80%) 0%, transparent 55%),
      var(--color-bg);
    color: var(--color-text);
    overflow: hidden;

    --footer-line: rgba(7, 56, 68, 0.2);
  }

  :global([data-theme='dark']) .login-page {
    background:
      radial-gradient(ellipse 80% 60% at 20% 50%, color-mix(in srgb, var(--color-accent), transparent 84%), transparent),
      linear-gradient(160deg, color-mix(in srgb, var(--color-accent), transparent 88%) 0%, transparent 55%),
      var(--color-bg);

    --footer-line: rgba(226, 255, 249, 0.2);
  }

  /* ── Login panel ──────────────────────────────────────── */

  .login-panel {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: clamp(24px, 4vw, 56px);
    overflow-y: auto;
    background: color-mix(in srgb, var(--color-surface), transparent 4%);
  }

  :global([data-theme='dark']) .theme-wrap{
    background: color-mix(in srgb, var(--color-surface), transparent 8%);
  }

  /* ── Wavy separator ───────────────────────────────────── */

  .panel-sep {
    position: absolute;
    left: 0;
    top: 0;
    width: 28px;
    height: 100%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 1;
  }

  .sep-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sep-path {
    stroke: var(--color-accent);
    opacity: 0.5;
    animation: sep-wave-anim 7s ease-in-out infinite;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--color-accent), transparent 50%));
  }

  :global([data-theme='dark']) .sep-path {
    opacity: 0.38;
  }

  /* ── Theme toggle ─────────────────────────────────────── */

  .theme-wrap {
    width: 100%;
    max-width: 430px;
    display: flex;
    justify-content: center;
    border-radius: var(--radius);
    background: var(--surface-card-bg);
    box-shadow: var(--shadow-md);
  }

  .login-panel-footer {
    position: relative;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 7px 16px;
    margin-bottom: max(4px, env(safe-area-inset-bottom));
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-surface), transparent 8%);
    border: 1px solid color-mix(in srgb, var(--color-border), transparent 45%);
    box-shadow: var(--shadow-sm, 0 2px 10px rgba(0, 0, 0, 0.08));
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition:
      color 0.4s ease,
      background 0.4s ease,
      border-color 0.4s ease;
  }

  .footer-separator {
    width: 14px;
    height: 1px;
    background: var(--footer-line);
  }

  /* ── Login card ───────────────────────────────────────── */

  .login-card {
    width: 100%;
    max-width: 430px;
    padding: clamp(26px, 4vw, 38px);
    border: 1px solid var(--surface-card-border);
    border-radius: var(--radius);
    background: var(--surface-card-bg);
    box-shadow: var(--shadow-md);
    animation: card-enter 520ms ease-out both;
  }

  .login-brand {
    display: flex;
    align-items: center;
    margin-bottom: 22px;
  }

  .form-heading {
    margin-bottom: 24px;
  }

  .form-heading h2 {
    margin: 0 0 6px;
    color: var(--color-text);
    font-size: 1.35rem;
    font-weight: 800;
  }

  .form-heading p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .input {
    min-height: 50px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.95rem;
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      background 0.15s;
  }

  .input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 82%);
  }

  .error-msg,
  .info-msg {
    border-radius: var(--radius);
    padding: 11px 12px;
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .error-msg {
    background: #fee2e2;
    color: var(--color-danger);
    border: 1px solid #fecaca;
  }

  .info-msg {
    margin-bottom: 16px;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    color: var(--color-accent);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%);
  }

  .submit-btn {
    min-height: 50px;
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 2px;
    padding: 12px 16px;
    border: none;
    border-radius: var(--radius);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 800;
    transition:
      filter 0.15s,
      opacity 0.15s,
      transform 0.15s;
  }

  .submit-btn :global(.loader) {
    --loader-accent: #ffffff;
    --loader-mint: #ffffff;
  }

  .submit-btn:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .demo-accounts {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
  }

  .demo-label {
    display: block;
    margin-bottom: 10px;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .demo-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .demo-chip {
    min-height: 34px;
    padding: 6px 14px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    transition:
      background 0.12s,
      border-color 0.12s,
      color 0.12s;
  }

  .demo-chip--admin { border-color: #7c3aed40; color: #7c3aed; background: #7c3aed0a; }
  .demo-chip--qalead { border-color: #0891b240; color: #0891b2; background: #0891b20a; }
  .demo-chip--qa { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-subtle); }
  .demo-chip--dev { border-color: #15803d40; color: #15803d; background: #15803d0a; }
  .demo-chip--viewer { border-color: #0284c740; color: #0284c7; background: #0284c70a; }
  .demo-chip--guest { border-color: var(--color-border); color: var(--color-text-muted); }

  .demo-chip:hover {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .demo-note {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    line-height: 1.45;
  }

  /* ── Keyframes ────────────────────────────────────────── */

  @keyframes card-enter {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sep-wave-anim {
    0%, 100% {
      d: path('M10 0 C 18 8.33, 2 16.67, 10 25 C 18 33.33, 2 41.67, 10 50 C 18 58.33, 2 66.67, 10 75 C 18 83.33, 2 91.67, 10 100');
    }
    50% {
      d: path('M10 0 C 2 8.33, 18 16.67, 10 25 C 2 33.33, 18 41.67, 10 50 C 2 58.33, 18 66.67, 10 75 C 2 83.33, 18 91.67, 10 100');
    }
  }

  /* ── Responsive ───────────────────────────────────────── */

  @media (max-width: 980px) {
    .login-page {
      grid-template-columns: 1fr;
      overflow: visible;
    }

    .login-brand {
      display: none;
    }

    .panel-sep {
      display: none;
    }

    .login-panel {
      min-height: auto;
      padding: 18px 16px 28px;
      background: transparent;
    }

    .theme-wrap {
      max-width: 430px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .login-card,
    .submit-btn {
      animation: none;
      transition-duration: 0.001ms;
    }

    .submit-btn:hover:not(:disabled) {
      transform: none;
    }

    .sep-path {
      animation: none;
    }
  }
</style>

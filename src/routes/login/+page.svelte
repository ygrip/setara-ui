<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { login } from '$lib/api/client';
  import { getValidSession, sessionFromLoginResult, storeSession, type SetaraRole } from '$lib/auth';
  import SetaraGsapLogo from '$lib/components/SetaraGsapLogo.svelte';
  import SetaraLoader from '$lib/components/SetaraLoader.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isMockMode } from '$lib/mock/client';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let carouselIdx = $state(0);

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

  const CAROUSEL_ITEMS = [
    {
      label: 'End-to-end test coverage',
      sub: 'From scenario design to automated execution — fully tracked',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`
    },
    {
      label: 'Automated release gates',
      sub: 'Block bad builds automatically before they reach production',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    },
    {
      label: 'Squad-level quality insights',
      sub: 'Health, coverage, and pass rates — aligned across every team',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
    }
  ];

  onMount(() => {
    if (getValidSession()) {
      goto('/dashboard', { replaceState: true });
    }
    const timer = setInterval(() => {
      carouselIdx = (carouselIdx + 1) % CAROUSEL_ITEMS.length;
    }, 3400);
    return () => clearInterval(timer);
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
  <section class="login-hero" aria-labelledby="login-heading">
    <!-- Scribble animation replaces static background image -->
    <div class="hero-scribble" aria-hidden="true">
      <svg class="scribble-svg" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sline" x1="0" y1="0" x2="900" y2="0" gradientUnits="userSpaceOnUse">
            <stop stop-color="#00AFA5" stop-opacity="0" />
            <stop offset="0.46" stop-color="#00C2B8" stop-opacity="0.9" />
            <stop offset="1" stop-color="#5EF2D6" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path
          class="sp sp--1"
          pathLength="1"
          d="M-42 236C151 129 252 390 457 207C655 31 739 188 942 113"
          stroke="url(#sline)"
          stroke-width="2.4"
          stroke-linecap="round"
          fill="none"
        />
        <path
          class="sp sp--2"
          pathLength="1"
          d="M-70 286C145 192 275 345 480 232C662 132 744 277 938 198"
          stroke="url(#sline)"
          stroke-width="2.1"
          stroke-linecap="round"
          fill="none"
        />
        <path
          class="sp sp--3"
          pathLength="1"
          d="M-48 337C191 237 303 405 526 272C701 168 779 318 957 279"
          stroke="url(#sline)"
          stroke-width="1.8"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
    </div>

    <div class="hero-brand" aria-label="Setara">
      <SetaraGsapLogo size={180} />
    </div>

    <div class="hero-copy">
      <h1 id="login-heading">Ship quality,<br />every release.</h1>
      <p>
        Test cases, automation coverage, and release gates — in one focused workspace for your QA
        squads.
      </p>
    </div>

    <div class="capability-carousel" aria-label="Platform features">
      <div class="carousel-track">
        {#key carouselIdx}
          <div
            class="capability-card"
            in:fly={{ y: 22, opacity: 0, duration: 420 }}
            out:fly={{ y: -22, opacity: 0, duration: 260 }}
          >
            <span class="capability-icon">{@html CAROUSEL_ITEMS[carouselIdx].icon}</span>
            <span class="capability-label">{CAROUSEL_ITEMS[carouselIdx].label}</span>
            <span class="capability-sub">{CAROUSEL_ITEMS[carouselIdx].sub}</span>
          </div>
        {/key}
      </div>
      <div class="carousel-dots" aria-hidden="true">
        {#each CAROUSEL_ITEMS as _, i}
          <button
            class="carousel-dot"
            class:carousel-dot--active={i === carouselIdx}
            onclick={() => (carouselIdx = i)}
            tabindex="-1"
            aria-hidden="true"
          ></button>
        {/each}
      </div>
    </div>
  </section>

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

    <div class="login-card">
      <div class="login-brand">
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
  }

  :global([data-theme='dark']) .login-page {
    background:
      radial-gradient(ellipse 80% 60% at 20% 50%, color-mix(in srgb, var(--color-accent), transparent 84%), transparent),
      linear-gradient(160deg, color-mix(in srgb, var(--color-accent), transparent 88%) 0%, transparent 55%),
      var(--color-bg);
  }

  /* ── Hero ─────────────────────────────────────────────── */

  .login-hero {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(22px, 3.5vw, 38px);
    padding: clamp(32px, 6vw, 80px);
    isolation: isolate;
  }

  /* ── Scribble animation ───────────────────────────────── */

  .hero-scribble {
    position: absolute;
    inset: 8% 0 auto;
    height: min(54vw, 460px);
    z-index: -1;
    pointer-events: none;
  }

  .scribble-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .sp {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: scribble-draw 9s ease-in-out infinite;
  }

  .sp--2 {
    animation-delay: -3s;
    animation-duration: 10s;
  }

  .sp--3 {
    animation-delay: -6.2s;
    animation-duration: 11s;
  }

  /* ── Brand mark ────────────────────────────────────────── */

  .hero-brand {
    display: block;
  }

  /* ── Hero copy ─────────────────────────────────────────── */

  .hero-copy {
    max-width: 620px;
  }

  .hero-copy h1 {
    margin: 0;
    font-size: clamp(2rem, 4.2vw, 3.8rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
    max-width: 16ch;
    background: linear-gradient(
      145deg,
      var(--color-text) 25%,
      color-mix(in srgb, var(--color-accent), var(--color-text) 42%)
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-copy p {
    max-width: 520px;
    margin: 16px 0 0;
    color: var(--color-text-muted);
    font-size: clamp(0.9rem, 1.3vw, 1.06rem);
    line-height: 1.72;
  }

  /* ── Capability carousel ──────────────────────────────── */

  .capability-carousel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 480px;
  }

  .carousel-track {
    position: relative;
    height: 100px;
    overflow: hidden;
  }

  .capability-card {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border: 1px solid color-mix(in srgb, var(--color-accent), var(--color-border) 55%);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-accent), var(--color-surface) 92%);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-accent), transparent 80%),
      var(--shadow);
  }

  :global([data-theme='dark']) .capability-card {
    background: color-mix(in srgb, var(--color-accent), var(--color-surface) 94%);
  }

  .capability-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-accent), transparent 82%);
    color: var(--color-accent);
  }

  .capability-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.3;
  }

  .capability-sub {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    line-height: 1.45;
  }

  .carousel-dots {
    display: flex;
    gap: 7px;
  }

  .carousel-dot {
    width: 20px;
    height: 4px;
    border-radius: 2px;
    border: none;
    background: color-mix(in srgb, var(--color-accent), transparent 68%);
    cursor: pointer;
    padding: 0;
    transition:
      background 0.2s,
      width 0.25s;
  }

  .carousel-dot--active {
    width: 36px;
    background: var(--color-accent);
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
    background: color-mix(in srgb, var(--color-surface), transparent 4%);
  }

  :global([data-theme='dark']) .login-panel {
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
    padding-bottom: 4px;
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

  @keyframes scribble-draw {
    0%   { stroke-dashoffset: 1;  opacity: 0; }
    8%   { opacity: 1; }
    40%  { stroke-dashoffset: 0;  opacity: 1; }
    62%  { stroke-dashoffset: 0;  opacity: 0.85; }
    76%  { stroke-dashoffset: -1; opacity: 0; }
    100% { stroke-dashoffset: 1;  opacity: 0; }
  }

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

    .login-hero {
      min-height: auto;
      padding: 28px 22px 8px;
      gap: 18px;
    }

    .hero-scribble {
      inset: 0 -28% auto;
      height: 280px;
      opacity: 0.5;
    }

    .hero-copy h1 {
      font-size: clamp(1.8rem, 9vw, 3rem);
    }

    .hero-copy p {
      margin-top: 12px;
      font-size: 0.94rem;
    }

    .capability-carousel {
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

  @media (max-width: 420px) {
    .login-hero {
      padding-inline: 16px;
    }

    .hero-copy h1 {
      font-size: clamp(1.6rem, 11vw, 2.4rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp,
    .login-card,
    .submit-btn {
      animation: none;
      transition-duration: 0.001ms;
    }

    .sp {
      stroke-dashoffset: 0;
      opacity: 0.6;
    }

    .submit-btn:hover:not(:disabled) {
      transform: none;
    }

    .sep-path {
      animation: none;
    }
  }
</style>

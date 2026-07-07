<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { login } from '$lib/api/client';
  import { getValidSession, sessionFromLoginResult, storeSession, type SetaraRole } from '$lib/auth';
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

  // ponytail: static placeholder — wire to a public /api/stats endpoint when available
  const CAPABILITIES = [
    { value: '93%', label: 'Automation coverage', sub: 'across all active projects' },
    { value: '18', label: 'Release gates tracked', sub: 'blocking bad builds automatically' },
    { value: '4.8k', label: 'Scenarios under control', sub: 'maintained by your QA squads' }
  ];

  onMount(() => {
    if (getValidSession()) {
      goto('/dashboard', { replaceState: true });
    }
    const timer = setInterval(() => {
      carouselIdx = (carouselIdx + 1) % CAPABILITIES.length;
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
    <div class="hero-flow" aria-hidden="true"></div>

    <div class="hero-brand" aria-label="Setara">
      <SetaraLoader mode="orbit" size={80} />
      <span class="brand-wordmark">setara</span>
    </div>

    <div class="hero-copy">
      <h1 id="login-heading">Precision testing.<br />Fearless releases.</h1>
      <p>
        Connect test scenarios, automation coverage, and release gates across every squad — one
        workspace for your entire delivery lifecycle.
      </p>
    </div>

    <div class="capability-carousel" aria-label="Platform signals">
      <div class="carousel-track">
        {#key carouselIdx}
          <div
            class="capability-card"
            in:fly={{ y: 22, opacity: 0, duration: 420 }}
            out:fly={{ y: -22, opacity: 0, duration: 260 }}
          >
            <span class="capability-value">{CAPABILITIES[carouselIdx].value}</span>
            <span class="capability-label">{CAPABILITIES[carouselIdx].label}</span>
            <span class="capability-sub">{CAPABILITIES[carouselIdx].sub}</span>
          </div>
        {/key}
      </div>
      <div class="carousel-dots" aria-hidden="true">
        {#each CAPABILITIES as _, i}
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
        <SetaraLoader mode="progress" size={34} />
        <span class="card-brand-text">setara</span>
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
    gap: clamp(24px, 4vw, 42px);
    padding: clamp(32px, 6vw, 80px);
    isolation: isolate;
  }

  .hero-flow {
    position: absolute;
    inset: 8% 0 auto;
    height: min(54vw, 460px);
    background: url('/setara-flow-lines.svg') center / min(82vw, 980px) auto no-repeat;
    opacity: 0.92;
    filter: saturate(1.4);
    animation: flow-drift 13s ease-in-out infinite alternate;
    z-index: -1;
  }

  :global([data-theme='dark']) .hero-flow {
    opacity: 0.55;
    filter: saturate(1.1);
  }

  /* ── Brand mark ────────────────────────────────────────── */

  .hero-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-wordmark {
    font-size: clamp(1.6rem, 2.4vw, 2.2rem);
    font-weight: 900;
    letter-spacing: -0.03em;
    color: var(--color-accent);
    line-height: 1;
  }

  /* ── Hero copy ─────────────────────────────────────────── */

  .hero-copy {
    max-width: 680px;
  }

  .hero-copy h1 {
    margin: 0;
    font-size: clamp(2.4rem, 6vw, 5.2rem);
    line-height: 1.02;
    letter-spacing: -0.01em;
    max-width: 14ch;
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
    max-width: 560px;
    margin: 20px 0 0;
    color: var(--color-text-muted);
    font-size: clamp(1rem, 1.4vw, 1.12rem);
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
    height: 114px;
    overflow: hidden;
  }

  .capability-card {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 18px 22px;
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

  .capability-value {
    font-size: 2.1rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--color-accent);
    line-height: 1;
  }

  .capability-label {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.3;
  }

  .capability-sub {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    line-height: 1.4;
    margin-top: 2px;
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
    gap: 10px;
    margin-bottom: 22px;
  }

  .card-brand-text {
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--color-accent);
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

  .demo-chip--admin {
    border-color: #7c3aed40;
    color: #7c3aed;
    background: #7c3aed0a;
  }

  .demo-chip--qalead {
    border-color: #0891b240;
    color: #0891b2;
    background: #0891b20a;
  }

  .demo-chip--qa {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-accent-subtle);
  }

  .demo-chip--dev {
    border-color: #15803d40;
    color: #15803d;
    background: #15803d0a;
  }

  .demo-chip--viewer {
    border-color: #0284c740;
    color: #0284c7;
    background: #0284c70a;
  }

  .demo-chip--guest {
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }

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

  /* ── Animations ───────────────────────────────────────── */

  @keyframes flow-drift {
    from {
      transform: translateX(-3%) translateY(0) scale(1);
    }
    to {
      transform: translateX(4%) translateY(18px) scale(1.04);
    }
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes sep-wave-anim {
    0%,
    100% {
      d: path(
        'M10 0 C 18 8.33, 2 16.67, 10 25 C 18 33.33, 2 41.67, 10 50 C 18 58.33, 2 66.67, 10 75 C 18 83.33, 2 91.67, 10 100'
      );
    }
    50% {
      d: path(
        'M10 0 C 2 8.33, 18 16.67, 10 25 C 2 33.33, 18 41.67, 10 50 C 2 58.33, 18 66.67, 10 75 C 2 83.33, 18 91.67, 10 100'
      );
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

    .hero-flow {
      inset: 0 -28% auto;
      height: 280px;
      background-size: 760px auto;
      opacity: 0.5;
    }

    .hero-copy h1 {
      max-width: 16ch;
      font-size: clamp(2rem, 11vw, 3.5rem);
    }

    .hero-copy p {
      max-width: 44rem;
      margin-top: 14px;
      font-size: 0.96rem;
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
      font-size: clamp(1.8rem, 12vw, 2.65rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-flow,
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

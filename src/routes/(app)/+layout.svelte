<script lang="ts">
  import { navigating, page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LazyCommandPalette from '$lib/components/LazyCommandPalette.svelte';
  import LazyAsaOrb from '$lib/components/LazyAsaOrb.svelte';
  import { asa } from '$lib/stores/asa.svelte';
  import { clearSession, getValidSession, hasPermission, type SetaraSession } from '$lib/auth';
  import { isMockMode } from '$lib/mock/client';
  import { lockBodyScroll } from '$lib/scroll-lock';

  let { children } = $props();

  const isMock = isMockMode();

  let session = $state<SetaraSession | null>(null);
  let sidebarOpen = $state(false);
  let userMenuOpen = $state(false);
  let paletteOpen = $state(false);

  // Topbar search hint cycling
  const searchHints = ['Search anything…', 'Find projects…', 'Jump to a page…', 'Search runs…', 'Find scenarios…'];
  let searchHintIndex = $state(0);
  let searchHintKey = $state(0); // triggers {#key} re-mount for animation

  const projectKey = $derived(page.params.projectKey ?? null);

  onMount(() => {
    session = getValidSession();
    if (!session) {
      goto('/login');
      return;
    }
    if (session.pendingPasswordChange && !page.url.pathname.startsWith('/profile')) {
      goto('/profile?reason=set_password');
      return;
    }

    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        paletteOpen = true;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        asa.toggle();
      }
      if (e.key === 'Escape') {
        userMenuOpen = false;
      }
    }

    function handleOutsideClick(e: MouseEvent) {
      const wrap = document.querySelector('.user-menu-wrap');
      if (wrap && !wrap.contains(e.target as Node)) {
        userMenuOpen = false;
      }
    }

    function handleFocus() {
      const valid = getValidSession();
      if (valid) session = valid;
      else goto('/login');
    }

    const hintInterval = setInterval(() => {
      searchHintIndex = (searchHintIndex + 1) % searchHints.length;
      searchHintKey += 1;
    }, 3000);

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('click', handleOutsideClick);

    return () => {
      clearInterval(hintInterval);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('click', handleOutsideClick);
    };
  });

  // Notify ASA on navigation (clears page-scoped context)
  $effect(() => {
    asa.onNavigate(page.url.pathname);
  });

  // Record recent pages for command palette
  $effect(() => {
    const path = page.url.pathname;
    try {
      const label = document.title.replace(/\s*[–—]\s*Setara.*$/i, '').trim() || path;
      const key = 'setara:recent';
      const existing: { href: string; label: string }[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      const fresh = [{ href: path, label }, ...existing.filter(p => p.href !== path)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(fresh));
    } catch {}
  });

  $effect(() => {
    const isMobileView = window.matchMedia('(max-width: 768px)').matches;
    const shouldLock = sidebarOpen || (userMenuOpen && isMobileView);
    if (!shouldLock) return;
    return lockBodyScroll();
  });

  function signOut() {
    clearSession();
    goto('/login');
  }

  function can(permission: string) {
    return hasPermission(session, permission);
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  function isActive(href: string): boolean {
    return page.url.pathname.startsWith(href);
  }

  $effect(() => {
    const path = page.url.pathname;
    if (!session) return;
    if (path.startsWith('/admin') && !can('settings:read')) {
      goto('/forbidden');
      return;
    }
    if ((path.includes('/repository/scenarios/new') || path.includes('/repository/import')) && !can('scenario:write')) {
      goto('/forbidden');
      return;
    }
  });
</script>

<svelte:head>
  <title>Setara</title>
</svelte:head>

<!-- Mobile backdrop -->
{#if sidebarOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" role="button" tabindex="-1" aria-label="Close menu" onclick={closeSidebar} onkeydown={(e) => e.key === 'Escape' && closeSidebar()}></div>
{/if}

<div class="app-shell">
  <!-- Sidebar -->
  <aside class="sidebar" class:sidebar--open={sidebarOpen}>
    <div class="sidebar-brand">
      <span class="brand-icon-anim brand-icon-anim--lg" role="img" aria-label="Setara"></span>
      <span class="brand-name">SETARA</span>
      <span class="sidebar-brand-theme-desktop"><ThemeToggle /></span>
    </div>

    <nav class="sidebar-nav">
      <!-- Search shortcut — mobile only, always at top of nav above all sections -->
      <div class="sidebar-nav-search">
        <button
          class="sidebar-search-btn"
          onclick={() => { paletteOpen = true; closeSidebar(); }}
          aria-label="Search — press ⌘K to open"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span>Search anything…</span>
        </button>
      </div>

      <div class="nav-section-label">Browse</div>
      <a
        href="/dashboard"
        class="nav-item"
        class:nav-item--active={isActive('/dashboard')}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        Dashboard
      </a>
      <a
        href="/projects"
        class="nav-item"
        class:nav-item--active={isActive('/projects') && !projectKey}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 7h18M3 12h18M3 17h18"/>
        </svg>
        Projects
      </a>
      <a
        href="/plans"
        class="nav-item"
        class:nav-item--active={isActive('/plans')}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/>
        </svg>
        Plans
      </a>
      <a
        href="/coverage-overview"
        class="nav-item"
        class:nav-item--active={isActive('/coverage-overview')}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 5-7"/>
        </svg>
        Overview
      </a>

      <!-- Project context header -->
      <div class="project-ctx-wrap">
        {#if projectKey}
          <a href="/projects/{projectKey}" class="project-ctx-card" onclick={closeSidebar} title="Go to project overview">
            <svg class="project-ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
            <div class="project-ctx-body">
              <span class="project-ctx-eyebrow">Project</span>
              <span class="project-ctx-key">{projectKey}</span>
            </div>
            <svg class="project-ctx-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </a>
        {:else}
          <div class="project-ctx-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
            <span>No project selected</span>
          </div>
        {/if}
      </div>

      <!-- Project-contextual section -->
      {#if projectKey}
        <a
          href="/projects/{projectKey}/builds"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/builds`)}
          onclick={closeSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>
          </svg>
          Builds
        </a>
        <a
          href="/projects/{projectKey}/repository"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/repository`)}
          onclick={closeSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/>
          </svg>
          Test Repository
        </a>
        <a
          href="/projects/{projectKey}/executions"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/executions`)}
          onclick={closeSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Executions
        </a>
        <a
          href="/projects/{projectKey}/coverage"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/coverage`)}
          onclick={closeSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Coverage
        </a>
      {:else}
        <span class="nav-item nav-item--dimmed" title="Open a project first to access Builds">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>
          </svg>
          Builds
        </span>
        <span class="nav-item nav-item--dimmed" title="Open a project first to access Test Repository">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/>
          </svg>
          Test Repository
        </span>
        <span class="nav-item nav-item--dimmed" title="Open a project first to access Executions">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Executions
        </span>
        <span class="nav-item nav-item--dimmed" title="Open a project first to access Coverage">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Coverage
        </span>
      {/if}

      <!-- Divider -->
      <div class="nav-divider nav-divider--simple"></div>

      <!-- Admin section -->
      <a
        href={can('settings:read') ? '/admin' : '/profile'}
        class="nav-item"
        class:nav-item--active={isActive('/admin')}
        class:nav-item--dimmed={!can('settings:read')}
        aria-disabled={!can('settings:read')}
        title={can('settings:read') ? 'Settings' : 'You need QA Lead or Admin role to access Settings'}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Settings
      </a>
    </nav>

    <div class="sidebar-footer">
      <!-- Theme toggle — always visible on mobile, desktop-only in brand row -->
      <div class="sidebar-footer-theme">
        <span class="sidebar-footer-label">Theme</span>
        <ThemeToggle />
      </div>
    </div>
  </aside>

  <!-- Main area (topbar + content) -->
  <div class="main-area">
    <!-- Top bar (always visible) -->
    <header class="topbar">
      <div class="topbar-left">
        <!-- Hamburger — mobile only: toggles sidebar -->
        <button class="topbar-brand-mobile" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle navigation" aria-expanded={sidebarOpen}>
          {#if sidebarOpen}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
            </svg>
          {/if}
        </button>
        <!-- Brand — mobile only: visible in topbar since sidebar is off-screen -->
        <a href="/dashboard" class="topbar-brand-inline" aria-label="Setara home">
          <span class="brand-icon-anim brand-icon-anim--sm" aria-hidden="true"></span>
          <span class="topbar-brand-inline-text">SETARA</span>
        </a>
        <!-- Project key pill (desktop) -->
        {#if projectKey}
          <span class="project-key-pill">{projectKey}</span>
        {/if}
      </div>

      <!-- Search — centred in topbar -->
      <div class="topbar-center">
        <button class="search-btn" onclick={() => paletteOpen = true} aria-label="Search — press ⌘K">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {#key searchHintKey}
            <span class="search-placeholder">{searchHints[searchHintIndex]}</span>
          {/key}
          <kbd class="search-kbd">⌘K</kbd>
        </button>
      </div>

      <div class="topbar-right">
        <!-- Live indicator -->
        <div class="live-indicator" title="Connected — receiving live test run updates">
          <span class="live-dot"></span>
          <span class="live-text">Live</span>
        </div>

        <!-- User avatar -->
        {#if session}
          <div class="user-menu-wrap">
            <button
              class="topbar-avatar"
              onclick={() => userMenuOpen = !userMenuOpen}
              aria-haspopup="dialog"
              aria-expanded={userMenuOpen}
              title={session.name}
            >
              {session.name?.[0]?.toUpperCase() ?? '?'}
            </button>

            {#if userMenuOpen}
              <!-- Desktop: positioned dropdown -->
              <div class="user-dropdown">
                <div class="dropdown-header">
                  <span class="dropdown-name">{session.name}</span>
                  <span class="dropdown-email">{session.email}</span>
                  <span class="dropdown-role">{session.role}</span>
                </div>
                <div class="dropdown-divider"></div>
                <a href="/profile" class="dropdown-item" onclick={() => userMenuOpen = false}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  Profile
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item dropdown-item--danger" onclick={() => { userMenuOpen = false; signOut(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </header>

    <!-- Preview mode banner -->
    {#if isMock}
      <div class="preview-banner" role="status" aria-live="polite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span><strong>Preview mode</strong> — Showing sample data. Connect a live backend to see your real results.</span>
      </div>
    {/if}

    {#if navigating.to}
      <div class="route-skeleton" role="status" aria-live="polite" aria-label="Loading page"></div>
    {/if}

    <!-- Page content + footer in same scroll container so footer is not sticky -->
    <main class="content">
      {@render children()}
      <footer class="app-footer">
        <span>© 2026 Setara</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>v0.1.0</span>
      </footer>
    </main>
  </div>
</div>

<!-- Mobile user popup — rendered outside app-shell so position:fixed is relative to viewport,
     not the topbar's backdrop-filter stacking context -->
{#if userMenuOpen && session}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="user-popup-overlay" role="dialog" aria-modal="true" aria-label="Account" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) userMenuOpen = false; }}>
    <div class="user-popup">
      <div class="user-popup-avatar">{session.name?.[0]?.toUpperCase() ?? '?'}</div>
      <div class="user-popup-name">{session.name}</div>
      <div class="user-popup-email">{session.email}</div>
      <div class="user-popup-role">{session.role}</div>
      <div class="user-popup-actions">
        <a href="/profile" class="popup-btn" onclick={() => userMenuOpen = false}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          Profile
        </a>
        <button class="popup-btn popup-btn--danger" onclick={() => { userMenuOpen = false; signOut(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
      <button class="popup-close" onclick={() => userMenuOpen = false} aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<!-- Command Palette -->
<LazyCommandPalette open={paletteOpen} onclose={() => paletteOpen = false} />

<!-- ASA floating orb -->
<LazyAsaOrb />

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-width);
    background: rgba(248, 250, 252, 0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-right: 1px solid rgba(203, 213, 225, 0.6);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden; /* nav scrolls internally; brand + footer always visible */
  }

  :global([data-theme="dark"]) .sidebar {
    background: rgba(11, 18, 32, 0.82);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 14px 14px;
    background: #ffffff;
    border-bottom: 1px solid var(--color-border);
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0, 100, 120, 0.08);
  }

  /* Animated brand icon — CSS mask over gradient (matches brand-shimmer timing) */
  .brand-icon-anim {
    display: block;
    flex-shrink: 0;
    background: linear-gradient(120deg, #00AFA5 0%, #5EF2D6 45%, #00C2B8 70%, #00AFA5 100%);
    background-size: 220% 100%;
    -webkit-mask: url('/favicon.svg') no-repeat center / contain;
    mask: url('/favicon.svg') no-repeat center / contain;
    animation: brand-shimmer 5s ease-in-out infinite;
  }

  .brand-icon-anim--lg {
    width: 28px;
    height: 28px;
  }

  .brand-icon-anim--sm {
    width: 20px;
    height: 20px;
  }

  /* Hide brand-row ThemeToggle on mobile (it moves to sidebar footer) */
  .sidebar-brand-theme-desktop {
    display: contents;
  }

  .brand-name {
    flex: 1;
    font-family: var(--font-sans, "Sora", sans-serif);
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.16em;
    background: linear-gradient(120deg, #00AFA5 0%, #5EF2D6 45%, #00C2B8 70%, #00AFA5 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: brand-shimmer 5s ease-in-out infinite;
    filter: drop-shadow(1px 0px 1px rgba(94,242,214,0.15)) 
          drop-shadow(-1px 0px 1px rgba(94,242,214,0.15)) 
          drop-shadow(0px 1px 1px rgba(94,242,214,0.15)) 
          drop-shadow(0px -1px 1px rgba(94,242,214,0.15));
  }

  @keyframes brand-shimmer {
    0%, 100% { background-position: 0% 50%; }
    50%       { background-position: 100% 50%; }
  }

  .sidebar-nav {
    flex: 1;
    min-height: 0; /* allow flex child to shrink so footer stays visible */
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto; /* nav scrolls, not the whole sidebar */
  }

  /* Search shortcut at top of nav — hidden on desktop, shown on mobile */
  .sidebar-nav-search {
    display: none;
    padding: 0 0 8px;
  }

  .nav-section-label {
    padding: 10px 12px 4px;
    color: var(--color-text-muted);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.58;
  }

  .nav-divider--simple {
    border-top: 1px solid var(--color-border);
    padding-top: 6px;
    margin-top: 4px;
  }

  /* Project context card */
  .project-ctx-wrap {
    padding: 6px 0 4px;
    margin-top: 6px;
  }

  .project-ctx-card {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.65rem;
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border));
    text-decoration: none;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .project-ctx-card:hover {
    background: color-mix(in srgb, var(--color-accent) 13%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  }

  .project-ctx-icon {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
    color: var(--color-accent);
    opacity: 0.75;
  }

  .project-ctx-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .project-ctx-eyebrow {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--color-text-muted);
    line-height: 1.3;
  }

  .project-ctx-key {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-accent);
    font-family: ui-monospace, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.35;
  }

  .project-ctx-arrow {
    flex: 0 0 auto;
    width: 13px;
    height: 13px;
    color: var(--color-accent);
    opacity: 0.45;
  }

  .project-ctx-empty {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border-radius: 0.6rem;
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.76rem;
    opacity: 0.55;
    font-style: italic;
  }

  .project-ctx-empty svg {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    color: var(--color-text-muted);
    font-weight: 500;
    font-size: 0.875rem;
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
  }

  .nav-item:hover {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    text-decoration: none;
  }

  .nav-item--active {
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
    color: var(--color-accent);
    font-weight: 600;
    box-shadow: inset 3px 0 0 var(--color-accent);
    padding-left: 7px;
  }

  .nav-item--dimmed {
    opacity: 0.45;
    pointer-events: none;
  }

  .sidebar-footer {
    padding: 16px 12px;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
    background: inherit;
    /* Height matches app-footer (16px padding × 2 + ~18px text line-height + 1px border) */
    min-height: 50px;
  }

  .sidebar-search-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.875rem;
    text-align: left;
    transition: border-color 0.12s, box-shadow 0.12s, background 0.12s;
  }

  .sidebar-search-btn span { flex: 1; }

  .sidebar-search-btn:hover {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.1);
    color: var(--color-text);
    background: var(--color-accent-subtle);
  }

  :global([data-theme="dark"]) .sidebar-search-btn {
    background: rgba(255,255,255,0.04);
  }

  /* Theme row in sidebar footer — shown on mobile, hidden on desktop where brand row has it */
  .sidebar-footer-theme {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
  }

  @media (min-width: 769px) {
    .sidebar-footer-theme {
      display: none;
    }
  }

  .sidebar-footer-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  /* ── Main area ── */
  .main-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Top bar ── */
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--topbar-height);
    padding: 0 20px;
    background: #ffffff;
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 2px 8px rgba(0, 100, 120, 0.08);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  :global([data-theme="dark"]) .topbar {
    background: rgba(11, 18, 32, 0.84);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global([data-theme="dark"]) .sidebar-brand {
    background: rgba(11, 18, 32, 0.84);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .topbar-center {
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 0 16px;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  /* Icon toggle button — mobile only */
  .topbar-brand-mobile {
    display: none;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    color: var(--color-text-muted);
    transition: background 0.12s, color 0.12s;
    min-width: 36px;
    min-height: 36px;
  }

  .topbar-brand-mobile:hover {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  /* Brand inline (mobile topbar) — hidden on desktop where sidebar shows it */
  .topbar-brand-inline {
    display: none;
    align-items: center;
    gap: 7px;
    text-decoration: none;
    flex-shrink: 0;
  }

  .topbar-brand-inline-text {
    font-family: var(--font-sans, "Sora", sans-serif);
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.16em;
    background: linear-gradient(120deg, #00AFA5 0%, #5EF2D6 45%, #00C2B8 70%, #00AFA5 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: brand-shimmer 5s ease-in-out infinite;
  }

  .project-key-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* Search button */
  .search-btn {
    width: 100%;
    max-width: 480px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }

  :global([data-theme="dark"]) .search-btn {
    background: rgba(255,255,255,0.04);
  }

  .search-btn:hover {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.1);
    color: var(--color-text);
  }

  .search-placeholder {
    flex: 1;
    text-align: left;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    animation: hint-fade 3s ease forwards;
  }

  @keyframes hint-fade {
    0%   { opacity: 0; transform: translateY(4px); }
    15%  { opacity: 1; transform: translateY(0); }
    80%  { opacity: 1; transform: translateY(0); }
    100% { opacity: 0.7; transform: translateY(0); }
  }

  .search-kbd {
    font-family: inherit;
    font-size: 0.7rem;
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: 5px;
    padding: 2px 6px;
    color: var(--color-accent);
    font-weight: 600;
    letter-spacing: 0.01em;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .search-kbd { display: none; }
  }

  /* Live indicator */
  .live-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
  }

  .live-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-success);
  }

  /* Dropdown header (name + email) */
  .dropdown-header {
    padding: 12px 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dropdown-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .dropdown-email {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .dropdown-role,
  .user-popup-role {
    width: fit-content;
    margin-top: 5px;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 7px;
  }

  /* ── Mobile user popup ── */
  /* Hidden on desktop — shown only via mobile media query */
  .user-popup-overlay {
    display: none;
  }

  /* User menu */
  .user-menu-wrap {
    position: relative;
  }

  .topbar-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-accent);
    color: #fff;
    font-weight: 700;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    border: none;
    transition: opacity 0.12s;
  }

  .topbar-avatar:hover {
    opacity: 0.85;
  }

  .user-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    min-width: 180px;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
    z-index: 200;
    overflow: hidden;
    animation: dropdown-in 0.12s ease;
  }

  :global([data-theme="dark"]) .user-dropdown {
    background: rgba(11, 18, 32, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
    text-decoration: none;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    font-family: inherit;
  }

  .dropdown-item:hover {
    background: rgba(13, 148, 136, 0.08);
    text-decoration: none;
  }

  .dropdown-item--danger {
    color: var(--color-danger);
  }

  .dropdown-item--danger:hover {
    background: rgba(220, 38, 38, 0.08);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }

  /* Content */
  .content {
    flex: 1;
    min-height: 0;
    padding: 32px;
    overflow-y: auto;
  }

  /* Footer — inside .content scroll container so it scrolls with page content */
  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    font-size: 0.72rem;
    color: var(--color-text-muted);
    opacity: 0.7;
    /* Break out of .content's 32px side padding so border spans full width */
    margin: 32px -32px -32px;
    max-height: 50px; /* prevent footer from growing too tall if it wraps on mobile */
  }

  .footer-sep {
    opacity: 0.5;
  }

  /* ── Preview banner ── */
  .preview-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%);
    color: var(--color-accent);
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.4;
    flex-shrink: 0;
  }

  .preview-banner strong {
    font-weight: 700;
  }

  :global([data-theme="dark"]) .preview-banner {
    background: color-mix(in srgb, var(--color-accent), transparent 82%);
    border-bottom-color: color-mix(in srgb, var(--color-accent), transparent 60%);
  }

  .route-skeleton {
    position: fixed;
    top: var(--topbar-height);
    left: 0;
    right: 0;
    height: 3px;
    z-index: 200;
    pointer-events: none;
    background: linear-gradient(90deg,
      transparent 0%,
      var(--color-accent) 35%,
      var(--color-accent-mint) 65%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: route-loading-sweep 1.2s ease-in-out infinite;
  }

  @keyframes route-loading-sweep {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-icon-anim,
    .brand-name,
    .topbar-brand-inline-text,
    .search-placeholder,
    .live-dot,
    .route-skeleton {
      animation: none;
    }
  }

  /* ── Mobile backdrop ── */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 40;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    /* Sidebar slides in from left */
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      height: auto; /* override base 100vh — top+bottom anchoring is reliable on iOS Safari */
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
    }

    .sidebar--open {
      transform: translateX(0);
    }

    /* Show hamburger button */
    .topbar-brand-mobile {
      display: flex;
    }

    /* Show brand inline in topbar */
    .topbar-brand-inline {
      display: flex;
    }

    /* Hide desktop ThemeToggle in brand row on mobile */
    .sidebar-brand-theme-desktop {
      display: none;
    }

    /* Show search at top of nav on mobile */
    .sidebar-nav-search {
      display: block;
    }

    /* Hide project pill on mobile */
    .project-key-pill {
      display: none;
    }

    /* Search bar hidden on mobile — lives in sidebar instead */
    .topbar-center {
      display: none;
    }

    /* Push live indicator + avatar to the right since center slot is gone */
    .topbar-right {
      margin-left: auto;
    }

    /* Hide Live text, keep dot only */
    .live-text {
      display: none;
    }

    /* Hide desktop positioned dropdown */
    .user-dropdown {
      display: none;
    }

    /* Show mobile popup overlay */
    .user-popup-overlay {
      display: flex;
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: popup-fade-in 0.15s ease;
      overflow: hidden;
    }

    @keyframes popup-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .user-popup {
      position: relative;
      width: 100%;
      max-width: 320px;
      max-height: min(86vh, calc(100dvh - 48px));
      background: rgba(248, 250, 252, 0.95);
      backdrop-filter: blur(28px) saturate(200%);
      -webkit-backdrop-filter: blur(28px) saturate(200%);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.2);
      padding: 28px 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-align: center;
      animation: popup-slide-in 0.18s ease;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    :global([data-theme="dark"]) .user-popup {
      background: rgba(11, 18, 32, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    @keyframes popup-slide-in {
      from { opacity: 0; transform: scale(0.94) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .user-popup-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-accent);
      color: #fff;
      font-family: var(--font-sans, "Sora", sans-serif);
      font-weight: 700;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }

    .user-popup-name {
      font-family: var(--font-sans, "Sora", sans-serif);
      font-weight: 700;
      font-size: 1rem;
      color: var(--color-text);
    }

    .user-popup-email {
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }

    .user-popup-role {
      margin: 8px auto 12px;
    }

    .user-popup-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .popup-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      font-family: var(--font-body, "Inter", sans-serif);
      cursor: pointer;
      text-decoration: none;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      transition: background 0.12s, border-color 0.12s;
    }

    .popup-btn:hover {
      background: var(--color-accent-subtle);
      border-color: var(--color-accent);
      color: var(--color-accent);
      text-decoration: none;
    }

    .popup-btn--danger {
      color: var(--color-danger);
      border-color: rgba(239, 68, 68, 0.25);
      background: rgba(239, 68, 68, 0.05);
    }

    .popup-btn--danger:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .popup-close {
      position: absolute;
      top: 14px;
      right: 16px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      font-size: 0.9rem;
      padding: 4px 6px;
      border-radius: 6px;
      line-height: 1;
    }

    .popup-close:hover {
      background: var(--color-accent-subtle);
      color: var(--color-accent);
    }

    .content {
      padding: 20px 16px;
    }

  }
</style>

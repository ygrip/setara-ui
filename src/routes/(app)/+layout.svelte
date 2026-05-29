<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import { clearSession, getValidSession, hasPermission, refreshSession, type SetaraSession } from '$lib/auth';
  import { isMockMode } from '$lib/mock/client';

  let { children } = $props();

  const isMock = isMockMode();

  let session = $state<SetaraSession | null>(null);
  let sidebarOpen = $state(false);
  let userMenuOpen = $state(false);
  let paletteOpen = $state(false);
  let pinnedItems = $state<string[]>([]);

  // ── Pin feature (localStorage) ──────────────────────────
  function loadPins() {
    try {
      const stored = localStorage.getItem('setara_pinned');
      if (stored) pinnedItems = JSON.parse(stored);
    } catch { pinnedItems = []; }
  }

  function savePins() {
    localStorage.setItem('setara_pinned', JSON.stringify(pinnedItems));
  }

  function togglePin(href: string) {
    if (pinnedItems.includes(href)) {
      pinnedItems = pinnedItems.filter(h => h !== href);
    } else {
      pinnedItems = [...pinnedItems, href];
    }
    savePins();
  }

  function isPinned(href: string) { return pinnedItems.includes(href); }

  // Topbar search hint cycling
  const searchHints = ['Search anything…', 'Find projects…', 'Jump to a page…', 'Search runs…', 'Find scenarios…'];
  let searchHintIndex = $state(0);
  let searchHintKey = $state(0); // triggers {#key} re-mount for animation

  const projectKey = $derived(page.params.projectKey ?? null);

  // Pin definitions: label, href, icon snippet
  const pinOptions = $derived([
    { label: 'Dashboard', href: '/dashboard', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { label: 'Projects', href: '/projects', icon: '<path d="M3 7h18M3 12h18M3 17h18"/>' },
    { label: 'Plans', href: '/plans', icon: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/>' },
    { label: 'Coverage', href: '/coverage-overview', icon: '<path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 5-7"/>' },
    { label: 'Settings', href: '/admin', icon: '<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' },
    ...(projectKey ? [{ label: 'Builds', href: `/projects/${projectKey}/builds`, icon: '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>' },
                       { label: 'Repository', href: `/projects/${projectKey}/repository`, icon: '<path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/>' },
                       { label: 'Executions', href: `/projects/${projectKey}/executions`, icon: '<polygon points="5 3 19 12 5 21 5 3"/>' }] : [])
  ]);

  onMount(() => {
    loadPins();
    session = getValidSession();
    if (!session) {
      goto('/login');
      return;
    }

    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        paletteOpen = true;
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
      const refreshed = refreshSession();
      if (refreshed) session = refreshed;
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

  // Scroll-lock: prevent background scroll when sidebar or mobile user popup is open.
  // Apply to both body and documentElement for reliable iOS Safari behaviour.
  $effect(() => {
    const isMobileView = window.matchMedia('(max-width: 768px)').matches;
    const shouldLock = sidebarOpen || (userMenuOpen && isMobileView);
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    document.documentElement.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
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

      <!-- Pinned section -->
      {#if pinnedItems.length > 0}
        <div class="nav-section-label">Pinned</div>
        {#each pinnedItems as href}
          {@const opt = pinOptions.find(o => o.href === href)}
          {#if opt}
            <a
              {href}
              class="nav-item nav-item--pinned"
              class:nav-item--active={isActive(href)}
              onclick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                {@html opt.icon}
              </svg>
              {opt.label}
              <button class="pin-toggle" title="Unpin" onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(href); }} aria-label="Unpin {opt.label}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.7"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
              </button>
            </a>
          {/if}
        {/each}
      {/if}
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
        <button class="pin-btn" title={isPinned('/dashboard') ? 'Unpin' : 'Pin'} onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin('/dashboard'); }} aria-label={isPinned('/dashboard') ? 'Unpin Dashboard' : 'Pin Dashboard'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned('/dashboard') ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
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
        <button class="pin-btn" title={isPinned('/projects') ? 'Unpin' : 'Pin'} onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin('/projects'); }} aria-label={isPinned('/projects') ? 'Unpin Projects' : 'Pin Projects'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned('/projects') ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
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
        <button class="pin-btn" title={isPinned('/plans') ? 'Unpin' : 'Pin'} onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin('/plans'); }} aria-label={isPinned('/plans') ? 'Unpin Plans' : 'Pin Plans'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned('/plans') ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
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
        Coverage
        <button class="pin-btn" title={isPinned('/coverage-overview') ? 'Unpin' : 'Pin'} onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin('/coverage-overview'); }} aria-label={isPinned('/coverage-overview') ? 'Unpin Coverage' : 'Pin Coverage'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned('/coverage-overview') ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
      </a>

      <!-- Divider with label -->
      <div class="nav-divider">
        <span class="nav-divider-label">Project</span>
        {#if projectKey}
          <span class="nav-divider-key">{projectKey}</span>
        {:else}
          <span class="nav-divider-hint">(none selected)</span>
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

    <!-- Page content -->
    <main class="content">
      {@render children()}
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <span>© 2026 Setara</span>
      <span class="footer-sep" aria-hidden="true">·</span>
      <span>v0.1.0-alpha</span>
    </footer>
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
<CommandPalette open={paletteOpen} onclose={() => paletteOpen = false} />

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-width);
    background: rgba(248, 250, 252, 0.75);
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
    padding: 20px 16px 16px;
    border-bottom: 1px solid var(--color-border);
    justify-content: space-between;
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

  .nav-divider {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px 4px;
    margin-top: 4px;
  }

  .nav-divider--simple {
    border-top: 1px solid var(--color-border);
    padding-top: 6px;
    margin-top: 4px;
  }

  .nav-divider-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .nav-divider-key {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-accent);
    background: var(--color-accent-subtle);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .nav-divider-hint {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    opacity: 0.5;
    font-style: italic;
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

  .nav-item--pinned {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-bg), var(--color-accent) 4%);
  }

  .nav-item:hover {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    text-decoration: none;
  }

  .nav-item--active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-weight: 600;
  }

  .nav-item--dimmed {
    opacity: 0.45;
    pointer-events: none;
  }

  .pin-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    margin-left: auto;
    opacity: 0.55;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .nav-item:hover .pin-btn { opacity: 0.85; }

  .pin-btn:hover {
    opacity: 1;
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0,175,165,0.2);
  }

  :global([data-theme="dark"]) .pin-btn {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.55);
  }
  :global([data-theme="dark"]) .pin-btn:hover {
    background: rgba(0,175,165,0.15);
    border-color: var(--color-accent);
    color: var(--color-accent-mint);
    box-shadow: 0 2px 12px rgba(94,242,214,0.15);
  }

  .pin-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    margin-left: auto;
    opacity: 0.7;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .pin-toggle:hover {
    background: var(--color-accent-subtle);
    border-color: var(--color-danger);
    color: var(--color-danger);
    box-shadow: 0 2px 8px rgba(239,68,68,0.15);
  }

  :global([data-theme="dark"]) .pin-toggle {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.65);
  }
  :global([data-theme="dark"]) .pin-toggle:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.4);
    color: #fca5a5;
  }

  @media (max-width: 768px) {
    .pin-btn, .pin-toggle {
      width: 28px;
      height: 28px;
      opacity: 0.6;
    }
    .nav-item:hover .pin-btn { opacity: 0.85; }
  }

  .sidebar-footer {
    padding: 8px 12px;
    border-top: 1px solid var(--color-border);
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

  .sidebar-footer-theme {
    display: none; /* hidden on desktop — theme lives in brand row there */
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
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
  }

  /* ── Top bar ── */
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--topbar-height);
    padding: 0 20px;
    background: rgba(248, 250, 252, 0.78);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(203, 213, 225, 0.5);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  :global([data-theme="dark"]) .topbar {
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
    padding: 32px;
  }

  /* Footer */
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

    /* Show search at top of nav and theme at bottom on mobile */
    .sidebar-nav-search {
      display: block;
    }

    .sidebar-footer-theme {
      display: flex;
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
    }

    @keyframes popup-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .user-popup {
      position: relative;
      width: 100%;
      max-width: 320px;
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

<script lang="ts">
  import { navigating, page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  import { APP_BUILD_LABEL, APP_VERSION_LABEL } from '$lib/app-metadata';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import SetaraGsapLogo from '$lib/components/SetaraGsapLogo.svelte';
  import SetaraLoader from '$lib/components/SetaraLoader.svelte';
  import LazyCommandPalette from '$lib/components/LazyCommandPalette.svelte';
  import LazyAsaOrb from '$lib/components/LazyAsaOrb.svelte';

  import { asa } from '$lib/stores/asa.svelte';
  import {
    clearSession,
    getValidSession,
    hasPermission,
    type SetaraSession
  } from '$lib/auth';
  import { isMockMode } from '$lib/mock/client';
  import { lockBodyScroll } from '$lib/scroll-lock';

  let { children } = $props();

  const isMock = isMockMode();
  const CURRENT_YEAR = new Date().getFullYear();

  const DESKTOP_MEDIA_QUERY = '(min-width: 769px)';
  const SIDEBAR_COLLAPSED_KEY = 'setara:sidebar-collapsed';

  let session = $state<SetaraSession | null>(null);

  // Mobile drawer state.
  let sidebarOpen = $state(false);

  // Desktop sidebar state.
  let sidebarCollapsed = $state(false);
  let isDesktop = $state(false);
  let sidebarStateReady = $state(false);

  let userMenuOpen = $state(false);
  let paletteOpen = $state(false);

  const searchHints = [
    'Search anything…',
    'Find projects…',
    'Jump to a page…',
    'Search runs…',
    'Find scenarios…'
  ];

  let searchHintIndex = $state(0);
  let searchHintKey = $state(0);

  const projectKey = $derived(page.params.projectKey ?? null);

  function readSidebarPreference(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function saveSidebarPreference(collapsed: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // The sidebar still works when storage is unavailable.
    }
  }

  function toggleSidebarCollapsed(): void {
    if (!isDesktop) return;

    sidebarCollapsed = !sidebarCollapsed;
    saveSidebarPreference(sidebarCollapsed);
  }

  function toggleMobileSidebar(): void {
    if (isDesktop) return;
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar(): void {
    sidebarOpen = false;
  }

  function signOut(): void {
    clearSession();
    goto('/login');
  }

  function can(permission: string): boolean {
    return hasPermission(session, permission);
  }

  function isActive(href: string): boolean {
    return page.url.pathname.startsWith(href);
  }

  onMount(() => {
    session = getValidSession();

    if (!session) {
      goto('/login');
      return;
    }

    if (
      session.pendingPasswordChange &&
      !page.url.pathname.startsWith('/profile')
    ) {
      goto('/profile?reason=set_password');
      return;
    }

    const desktopMedia = window.matchMedia(DESKTOP_MEDIA_QUERY);

    function syncViewport(): void {
      isDesktop = desktopMedia.matches;
      sidebarOpen = false;

      if (isDesktop) {
        sidebarCollapsed = readSidebarPreference();
      }
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        paletteOpen = true;
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'i'
      ) {
        event.preventDefault();
        asa.toggle();
        return;
      }

      if (event.key === 'Escape') {
        userMenuOpen = false;

        if (!isDesktop) {
          sidebarOpen = false;
        }
      }
    }

    function handleOutsideClick(event: MouseEvent): void {
      const userMenu = document.querySelector('.user-menu-wrap');

      if (
        userMenu &&
        !userMenu.contains(event.target as Node)
      ) {
        userMenuOpen = false;
      }
    }

    function handleWindowFocus(): void {
      const validSession = getValidSession();

      if (validSession) {
        session = validSession;
        return;
      }

      goto('/login');
    }

    function handleViewportChange(): void {
      syncViewport();
    }

    syncViewport();

    requestAnimationFrame(() => {
      sidebarStateReady = true;
    });

    const hintInterval = window.setInterval(() => {
      searchHintIndex = (searchHintIndex + 1) % searchHints.length;
      searchHintKey += 1;
    }, 3000);

    desktopMedia.addEventListener('change', handleViewportChange);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('click', handleOutsideClick);

    return () => {
      window.clearInterval(hintInterval);
      desktopMedia.removeEventListener('change', handleViewportChange);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('click', handleOutsideClick);
    };
  });

  // Clear page-scoped ASA context after navigation.
  $effect(() => {
    asa.onNavigate(page.url.pathname);
  });

  // Store recent routes for the command palette.
  $effect(() => {
    const path = page.url.pathname;

    try {
      const label =
        document.title
          .replace(/\s*[-\u2013\u2014]\s*Setara.*$/i, '')
          .trim() || path;

      const key = 'setara:recent';
      const existing: Array<{ href: string; label: string }> =
        JSON.parse(localStorage.getItem(key) ?? '[]');

      const fresh = [
        { href: path, label },
        ...existing.filter((item) => item.href !== path)
      ].slice(0, 10);

      localStorage.setItem(key, JSON.stringify(fresh));
    } catch {
      // Recent-route history is optional.
    }
  });

  // Only mobile overlays lock body scrolling.
  $effect(() => {
    const shouldLock =
      !isDesktop &&
      (sidebarOpen || userMenuOpen);

    if (!shouldLock) return;

    return lockBodyScroll();
  });

  // Route permission protection.
  $effect(() => {
    const path = page.url.pathname;

    if (!session) return;

    if (
      path.startsWith('/admin') &&
      !can('settings:read')
    ) {
      goto('/forbidden');
      return;
    }

    const isScenarioWriteRoute =
      path.includes('/repository/scenarios/new') ||
      path.includes('/repository/import');

    if (
      isScenarioWriteRoute &&
      !can('scenario:write')
    ) {
      goto('/forbidden');
    }
  });
</script>

<svelte:head>
  <title>Setara</title>
</svelte:head>

{#if sidebarOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close navigation"
    onclick={closeSidebar}
    onkeydown={(event) => event.key === 'Escape' && closeSidebar()}
  ></div>
{/if}

<div class="app-shell">
  <aside
    class="sidebar"
    class:sidebar--open={sidebarOpen}
    class:sidebar--collapsed={isDesktop && sidebarCollapsed}
    class:sidebar--ready={sidebarStateReady}
  >
    <div class="sidebar-brand">
      <a
        href="/dashboard"
        class="brand-link"
        aria-label="Setara home"
        onclick={closeSidebar}
      >
        <span class="sidebar-brand-icon">
          <SetaraLoader size={32} mode="orbit" color={isDesktop && sidebarCollapsed ? 'accent' : 'accent'} />
        </span>

        <!-- Keep the GSAP logo mounted so it always measures at 100px. -->
        <span
          class="sidebar-brand-wordmark"
          aria-hidden={isDesktop && sidebarCollapsed}
        >
          <SetaraGsapLogo
            size={100}
            loop={true}
            animate={true}
          />
        </span>
      </a>
    </div>

    <nav class="sidebar-nav" aria-label="Primary navigation">
      <div class="sidebar-nav-search">
        <button
          type="button"
          class="sidebar-search-btn"
          onclick={() => {
            paletteOpen = true;
            closeSidebar();
          }}
          aria-label="Search. Press Command K to open."
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
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
        aria-label="Dashboard"
        title={isDesktop && sidebarCollapsed ? 'Dashboard' : undefined}
      >
        <svg
          class="nav-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span class="nav-item-label">Dashboard</span>
      </a>

      <a
        href="/projects"
        class="nav-item"
        class:nav-item--active={isActive('/projects') && !projectKey}
        onclick={closeSidebar}
        aria-label="Projects"
        title={isDesktop && sidebarCollapsed ? 'Projects' : undefined}
      >
        <svg
          class="nav-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        <span class="nav-item-label">Projects</span>
      </a>

      <a
        href="/plans"
        class="nav-item"
        class:nav-item--active={isActive('/plans')}
        onclick={closeSidebar}
        aria-label="Plans"
        title={isDesktop && sidebarCollapsed ? 'Plans' : undefined}
      >
        <svg
          class="nav-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <path d="M9 12h6M9 16h4" />
        </svg>
        <span class="nav-item-label">Plans</span>
      </a>

      <a
        href="/coverage-overview"
        class="nav-item"
        class:nav-item--active={isActive('/coverage-overview')}
        onclick={closeSidebar}
        aria-label="Coverage overview"
        title={isDesktop && sidebarCollapsed ? 'Overview' : undefined}
      >
        <svg
          class="nav-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 3v18h18" />
          <path d="M7 15l3-3 3 2 5-7" />
        </svg>
        <span class="nav-item-label">Overview</span>
      </a>

      <div class="project-ctx-wrap">
        {#if projectKey}
          <a
            href="/projects/{projectKey}"
            class="project-ctx-card"
            onclick={closeSidebar}
            aria-label="Open project {projectKey}"
            title={isDesktop && sidebarCollapsed
              ? `Project ${projectKey}`
              : 'Go to project overview'}
          >
            <svg
              class="project-ctx-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>

            <div class="project-ctx-body">
              <span class="project-ctx-eyebrow">Project</span>
              <span class="project-ctx-key">{projectKey}</span>
            </div>

            <svg
              class="project-ctx-arrow"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
        {:else}
          <div
            class="project-ctx-empty"
            title={isDesktop && sidebarCollapsed
              ? 'No project selected'
              : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span>No project selected</span>
          </div>
        {/if}
      </div>

      {#if projectKey}
        <a
          href="/projects/{projectKey}/builds"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/builds`)}
          onclick={closeSidebar}
          aria-label="Builds"
          title={isDesktop && sidebarCollapsed ? 'Builds' : undefined}
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7l8-4 8 4-8 4-8-4z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M4 17l8 4 8-4" />
          </svg>
          <span class="nav-item-label">Builds</span>
        </a>

        <a
          href="/projects/{projectKey}/repository"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/repository`)}
          onclick={closeSidebar}
          aria-label="Test Repository"
          title={isDesktop && sidebarCollapsed ? 'Test Repository' : undefined}
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16" />
          </svg>
          <span class="nav-item-label">Test Repository</span>
        </a>

        <a
          href="/projects/{projectKey}/executions"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/executions`)}
          onclick={closeSidebar}
          aria-label="Executions"
          title={isDesktop && sidebarCollapsed ? 'Executions' : undefined}
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span class="nav-item-label">Executions</span>
        </a>

        <a
          href="/projects/{projectKey}/coverage"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/coverage`)}
          onclick={closeSidebar}
          aria-label="Coverage"
          title={isDesktop && sidebarCollapsed ? 'Coverage' : undefined}
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span class="nav-item-label">Coverage</span>
        </a>
      {:else}
        <span
          class="nav-item nav-item--dimmed"
          title="Open a project first to access Builds"
          aria-label="Builds unavailable. Open a project first."
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7l8-4 8 4-8 4-8-4z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M4 17l8 4 8-4" />
          </svg>
          <span class="nav-item-label">Builds</span>
        </span>

        <span
          class="nav-item nav-item--dimmed"
          title="Open a project first to access Test Repository"
          aria-label="Test Repository unavailable. Open a project first."
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16" />
          </svg>
          <span class="nav-item-label">Test Repository</span>
        </span>

        <span
          class="nav-item nav-item--dimmed"
          title="Open a project first to access Executions"
          aria-label="Executions unavailable. Open a project first."
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span class="nav-item-label">Executions</span>
        </span>

        <span
          class="nav-item nav-item--dimmed"
          title="Open a project first to access Coverage"
          aria-label="Coverage unavailable. Open a project first."
        >
          <svg
            class="nav-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span class="nav-item-label">Coverage</span>
        </span>
      {/if}

      <div class="nav-divider nav-divider--simple"></div>

      <a
        href={can('settings:read') ? '/admin' : '/profile'}
        class="nav-item"
        class:nav-item--active={isActive('/admin')}
        class:nav-item--dimmed={!can('settings:read')}
        aria-disabled={!can('settings:read')}
        aria-label="Settings"
        title={can('settings:read')
          ? (isDesktop && sidebarCollapsed ? 'Settings' : undefined)
          : 'You need QA Lead or Admin role to access Settings'}
        onclick={closeSidebar}
      >
        <svg
          class="nav-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span class="nav-item-label">Settings</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-footer-theme">
        <ThemeToggle />
      </div>
    </div>
  </aside>

  <div class="main-area">
    <header class="topbar">

      <!-- Desktop collapse control. Only its outlined left half protrudes over the separator. -->
      <button
        type="button"
        class="sidebar-collapse-btn"
        onclick={toggleSidebarCollapsed}
        aria-label={sidebarCollapsed
          ? 'Expand sidebar'
          : 'Collapse sidebar'}
        aria-expanded={!sidebarCollapsed}
        title={sidebarCollapsed
          ? 'Expand sidebar'
          : 'Collapse sidebar'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {#if sidebarCollapsed}
            <path d="m9 18 6-6-6-6" />
          {:else}
            <path d="m15 18-6-6 6-6" />
          {/if}
        </svg>
      </button>
      <div class="topbar-left">
        <button
          type="button"
          class="topbar-brand-mobile"
          onclick={toggleMobileSidebar}
          aria-label="Toggle navigation"
          aria-expanded={sidebarOpen}
        >
          {#if sidebarOpen}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          {:else}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          {/if}
        </button>

        <a
          href="/dashboard"
          class="topbar-brand-inline"
          aria-label="Setara home"
        >
          <SetaraLoader size={28} mode="orbit" />
          <SetaraGsapLogo
            size={88}
            loop={true}
            animate={true}
          />
        </a>

        {#if projectKey}
          <span class="project-key-pill">{projectKey}</span>
        {/if}
      </div>

      <div class="topbar-center">
        <button
          type="button"
          class="search-btn"
          onclick={() => paletteOpen = true}
          aria-label="Search. Press Command K."
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          {#key searchHintKey}
            <span class="search-placeholder">
              {searchHints[searchHintIndex]}
            </span>
          {/key}

          <kbd class="search-kbd">⌘K</kbd>
        </button>
      </div>

      <div class="topbar-right">
        <div
          class="live-indicator"
          title="Connected. Receiving live test-run updates."
        >
          <span class="live-dot"></span>
          <span class="live-text">Live</span>
        </div>

        {#if session}
          <div class="user-menu-wrap">
            <button
              type="button"
              class="topbar-avatar"
              onclick={() => userMenuOpen = !userMenuOpen}
              aria-haspopup="dialog"
              aria-expanded={userMenuOpen}
              title={session.name}
            >
              {session.name?.[0]?.toUpperCase() ?? '?'}
            </button>

            {#if userMenuOpen}
              <div class="user-dropdown">
                <div class="dropdown-header">
                  <span class="dropdown-name">{session.name}</span>
                  <span class="dropdown-email">{session.email}</span>
                  <span class="dropdown-role">{session.role}</span>
                </div>

                <div class="dropdown-divider"></div>

                <a
                  href="/profile"
                  class="dropdown-item"
                  onclick={() => userMenuOpen = false}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </a>

                <div class="dropdown-divider"></div>

                <button
                  type="button"
                  class="dropdown-item dropdown-item--danger"
                  onclick={() => {
                    userMenuOpen = false;
                    signOut();
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </header>

    {#if isMock}
      <div
        class="preview-banner"
        role="status"
        aria-live="polite"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>

        <span>
          <strong>Preview mode</strong>
          - Showing sample data. Connect a live backend to see your real results.
        </span>
      </div>
    {/if}

    {#if navigating.to}
      <div
        class="route-skeleton"
        role="status"
        aria-live="polite"
        aria-label="Loading page"
      ></div>
    {/if}

    <main class="content">
      {@render children()}

      <footer class="app-footer">
        <span>© {CURRENT_YEAR} Setara</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>{APP_VERSION_LABEL}</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>build {APP_BUILD_LABEL}</span>
      </footer>
    </main>
  </div>
</div>

{#if userMenuOpen && session}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="user-popup-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Account"
    tabindex="-1"
    onclick={(event) => {
      if (event.target === event.currentTarget) {
        userMenuOpen = false;
      }
    }}
  >
    <div class="user-popup">
      <div class="user-popup-avatar">
        {session.name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div class="user-popup-name">{session.name}</div>
      <div class="user-popup-email">{session.email}</div>
      <div class="user-popup-role">{session.role}</div>

      <div class="user-popup-actions">
        <a
          href="/profile"
          class="popup-btn"
          onclick={() => userMenuOpen = false}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Profile
        </a>

        <button
          type="button"
          class="popup-btn popup-btn--danger"
          onclick={() => {
            userMenuOpen = false;
            signOut();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>

      <button
        type="button"
        class="popup-close"
        onclick={() => userMenuOpen = false}
        aria-label="Close"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<LazyCommandPalette
  open={paletteOpen}
  onclose={() => paletteOpen = false}
/>

<LazyAsaOrb />

<style>

  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ───────────────────────────────────────────── */

  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 60;

    display: flex;
    flex-direction: column;
    flex: 0 0 auto;

    overflow: hidden;
    background: rgba(248, 250, 252, 0.85);
    border-right: 1px solid rgba(203, 213, 225, 0.6);

    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
  }

  .sidebar--ready {
    transition:
      width 220ms cubic-bezier(0.4, 0, 0.2, 1),
      background 180ms ease,
      border-color 180ms ease;
  }

  .sidebar--ready .sidebar-brand {
    transition:
      background-color 240ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 200ms ease,
      box-shadow 240ms ease;
  }

  :global([data-theme='dark']) .sidebar {
    background: rgba(11, 18, 32, 0.82);
    border-right-color: rgba(255, 255, 255, 0.06);
  }

  .sidebar-brand {
    min-height: var(--topbar-height);
    position: relative;
    display: flex;
    align-items: center;
    flex: 0 0 auto;

    padding: 0 14px;
    overflow: visible;

    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 2px 8px rgba(0, 100, 120, 0.08);
  }

  :global([data-theme='dark']) .sidebar-brand {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .brand-link {
    display: grid;
    grid-template-columns: 32px 100px;
    align-items: center;
    column-gap: 10px;

    width: 142px;
    min-width: 142px;
    overflow: hidden;

    color: inherit;
    text-decoration: none;
  }

  .sidebar--ready .brand-link {
    transition:
      grid-template-columns 220ms cubic-bezier(0.4, 0, 0.2, 1),
      column-gap 220ms cubic-bezier(0.4, 0, 0.2, 1),
      width 220ms cubic-bezier(0.4, 0, 0.2, 1),
      min-width 220ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-brand-icon {
    width: 32px;
    min-width: 32px;
    height: 32px;

    display: grid;
    place-items: center;
  }

  .sidebar-brand-wordmark {
    width: 100px;
    min-width: 100px;
    max-width: 100px;

    display: block;
    overflow: visible;
    opacity: 1;
    visibility: visible;

    transform: translateX(0);
    transform-origin: left center;
  }

  .sidebar--ready .sidebar-brand-wordmark {
    transition:
      opacity 130ms ease 90ms,
      transform 200ms cubic-bezier(0.4, 0, 0.2, 1) 40ms,
      visibility 0s linear 0s;
  }

  .sidebar-brand-wordmark :global(.setara-gsap-logo) {
    display: block;
    width: 100px !important;
    min-width: 100px;
    max-width: 100px;
    flex: 0 0 100px;
  }

  .sidebar-nav {
    flex: 1;
    min-height: 0;

    display: flex;
    flex-direction: column;
    gap: 3px;

    padding: 12px 8px;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .sidebar-nav-search {
    display: none;
    padding-bottom: 8px;
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

  .nav-item {
    min-height: 36px;

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 8px 10px;
    border-radius: 7px;

    color: var(--color-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;

    transition:
      background 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .nav-item:hover {
    color: var(--color-accent);
    background: var(--color-accent-subtle);
    text-decoration: none;
  }

  .nav-item--active {
    color: var(--color-accent);
    background: color-mix(
      in srgb,
      var(--color-accent) 10%,
      var(--color-surface)
    );

    font-weight: 600;
    box-shadow: inset 3px 0 0 var(--color-accent);
    padding-left: 7px;
  }

  .nav-item--dimmed {
    opacity: 0.45;
    pointer-events: none;
  }

  .nav-item-icon {
    width: 18px;
    min-width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }

  .nav-item-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-divider--simple {
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid var(--color-border);
  }

  .project-ctx-wrap {
    margin-top: 6px;
    padding: 6px 0 4px;
  }

  .project-ctx-card,
  .project-ctx-empty {
    min-height: 42px;

    display: flex;
    align-items: center;
    gap: 0.55rem;

    padding: 0.5rem 0.65rem;
    border-radius: 0.6rem;
  }

  .project-ctx-card {
    color: inherit;
    text-decoration: none;
    cursor: pointer;

    background: color-mix(
      in srgb,
      var(--color-accent) 7%,
      var(--color-surface)
    );

    border: 1px solid color-mix(
      in srgb,
      var(--color-accent) 18%,
      var(--color-border)
    );

    transition:
      background 120ms ease,
      border-color 120ms ease;
  }

  .project-ctx-card:hover {
    background: color-mix(
      in srgb,
      var(--color-accent) 13%,
      var(--color-surface)
    );

    border-color: color-mix(
      in srgb,
      var(--color-accent) 35%,
      var(--color-border)
    );
  }

  .project-ctx-empty {
    color: var(--color-text-muted);
    font-size: 0.76rem;
    font-style: italic;

    opacity: 0.55;
    border: 1px dashed var(--color-border);
  }

  .project-ctx-icon,
  .project-ctx-empty svg {
    width: 15px;
    min-width: 15px;
    height: 15px;
    flex: 0 0 15px;

    color: var(--color-accent);
    opacity: 0.75;
  }

  .project-ctx-body {
    min-width: 0;
    flex: 1;

    display: flex;
    flex-direction: column;
  }

  .project-ctx-eyebrow {
    color: var(--color-text-muted);
    font-size: 0.6rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .project-ctx-key {
    overflow: hidden;

    color: var(--color-accent);
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-ctx-arrow {
    width: 13px;
    min-width: 13px;
    height: 13px;

    color: var(--color-accent);
    opacity: 0.45;
  }

  .sidebar-footer {
    min-height: 50px;
    flex: 0 0 auto;

    padding: 10px 12px;
    border-top: 1px solid var(--color-border);
    background: inherit;
  }

  .sidebar-footer-theme {
    display: grid;
    gap: 6px;
    padding: 4px;
  }

  .sidebar-search-btn {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 10px 12px;

    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.875rem;
    text-align: left;

    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
  }

  .sidebar-search-btn span {
    flex: 1;
  }

  .sidebar-search-btn:hover {
    color: var(--color-text);
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.1);
  }

  .sidebar-brand-icon :global(.loader) {
    transition:
      color 220ms cubic-bezier(0.4, 0, 0.2, 1),
      filter 220ms ease,
      transform 220ms ease;
  }

  /* ── Desktop collapsed sidebar ─────────────────────────── */

  @media (min-width: 769px) {
    .sidebar--collapsed {
      width: 72px;
    }

    .sidebar--collapsed .sidebar-brand {
      justify-content: center;
      padding-inline: 20px;
      background-color: var(--color-surface);

      border-bottom-color: color-mix(
        in srgb,
        var(--color-accent) 72%,
        white
      );

      box-shadow:
        0 4px 16px color-mix(
          in srgb,
          var(--color-accent) 22%,
          transparent
        ),
        inset -1px 0 0 rgb(255 255 255 / 0.12);
    }

    .sidebar--collapsed .brand-link {
      grid-template-columns: 32px 0;
      column-gap: 0;

      width: 32px;
      min-width: 32px;
      margin-inline: auto;
    }

    .sidebar:not(.sidebar--collapsed)
      .sidebar-brand-icon
      :global(.loader) {
      filter: none;
      transform: scale(1);
    }
    .sidebar--collapsed
      .sidebar-brand-icon
      :global(.loader) {
      filter:
        drop-shadow(0 0 7px rgb(255 255 255 / 0.28));

      transform: scale(1.04);
    }

    .sidebar--collapsed .sidebar-brand-wordmark {
      opacity: 0;
      visibility: hidden;
      transform: translateX(-8px);
      pointer-events: none;

      transition:
        opacity 90ms ease,
        transform 160ms ease,
        visibility 0s linear 160ms;
    }

    .sidebar--collapsed .sidebar-nav {
      padding-inline: 10px;
    }

    .sidebar--collapsed .nav-section-label {
      height: 10px;
      margin: 4px 0;
      padding: 0;

      overflow: hidden;
      font-size: 0;
      opacity: 0;
    }

    .sidebar--collapsed .nav-item {
      position: relative;
      justify-content: center;
      gap: 0;

      min-height: 42px;
      padding: 10px;
    }

    .sidebar--collapsed .nav-item-label {
      width: 0;
      min-width: 0;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .sidebar--collapsed .nav-item-icon {
      width: 19px;
      min-width: 19px;
      height: 19px;
      flex-basis: 19px;
    }

    .sidebar--collapsed .nav-item--active {
      padding: 10px;
      box-shadow: none;
    }

    .sidebar--collapsed .nav-item--active::before {
      content: '';
      position: absolute;
      top: 9px;
      bottom: 9px;
      left: -1px;

      width: 3px;
      border-radius: 0 999px 999px 0;
      background: var(--color-accent);
    }

    .sidebar--collapsed .project-ctx-wrap {
      padding-inline: 0;
    }

    .sidebar--collapsed .project-ctx-card,
    .sidebar--collapsed .project-ctx-empty {
      justify-content: center;
      gap: 0;
      padding: 10px;
    }

    .sidebar--collapsed .project-ctx-icon,
    .sidebar--collapsed .project-ctx-empty svg {
      width: 18px;
      min-width: 18px;
      height: 18px;
      flex-basis: 18px;
    }

    .sidebar--collapsed .project-ctx-body,
    .sidebar--collapsed .project-ctx-arrow,
    .sidebar--collapsed .project-ctx-empty span {
      display: none;
    }

    .sidebar--collapsed .nav-divider--simple {
      margin-inline: 8px;
    }

    .sidebar--collapsed .sidebar-footer {
      padding-inline: 8px;
    }

    .sidebar--collapsed .sidebar-footer-theme {
      padding: 0;
    }

    .sidebar--collapsed :global(.theme-option span) {
      display: none;
    }

    .sidebar--collapsed :global(.theme-select) {
      grid-template-columns: 1fr;
    }

    .sidebar--collapsed :global(.theme-option) {
      padding-inline: 0;
    }
  }

  /* ── Main area and topbar ──────────────────────────────── */

  .main-area {
    min-width: 0;
    height: 100vh;
    flex: 1;

    display: flex;
    flex-direction: column;

    /* The desktop collapse control protrudes into the sidebar. */
    overflow: visible;
  }

  .topbar {
    --topbar-surface: #ffffff;
    --topbar-separator: var(--color-border);

    height: var(--topbar-height);
    flex: 0 0 var(--topbar-height);

    position: sticky;
    top: 0;
    z-index: 70;
    overflow: visible;

    display: flex;
    align-items: center;
    gap: 12px;

    padding: 0 20px;

    background: var(--topbar-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 2px 8px rgba(0, 100, 120, 0.08);
  }

  /*
   * Continue the sidebar separator through the topbar. The toggle sits above
   * this line and covers its middle section, so the separator flows into the
   * visible left-half outline instead of ending beside a floating button.
   */
  .topbar::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -1px;
    z-index: 0;

    width: 1px;
    background: var(--topbar-separator);
    pointer-events: none;
  }

  :global([data-theme='dark']) .topbar {
    --topbar-surface: rgba(11, 18, 32, 0.84);
    --topbar-separator: rgba(255, 255, 255, 0.08);

    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .topbar-left,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 auto;
  }

  .topbar-center {
    min-width: 0;
    flex: 1;

    display: flex;
    justify-content: center;
    padding: 0 16px;
  }

  .topbar-brand-mobile,
  .topbar-brand-inline {
    display: none;
  }

  .topbar-brand-mobile {
    width: 36px;
    height: 36px;

    align-items: center;
    justify-content: center;

    padding: 6px;
    color: var(--color-text-muted);

    background: none;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
  }

  .topbar-brand-mobile svg {
    width: 20px;
    height: 20px;
  }

  .topbar-brand-inline {
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;
    text-decoration: none;
  }

  .sidebar-collapse-btn {
    --collapse-outline: var(--topbar-separator);

    position: absolute;
    top: 50%;
    left: 0;
    z-index: 12;

    display: none;
    align-items: center;
    justify-content: center;

    width: 26px;
    height: 30px;
    padding: 0;
    flex: 0 0 auto;

    /* Exactly half of the control protrudes into the brand section. */
    transform: translate(-50%, -50%);

    color: var(--color-text-muted);
    background: var(--topbar-surface);
    border: 0;
    border-radius: 8px 0 0 8px;
    cursor: pointer;

    box-shadow: -3px 0 2px rgb(15 23 42 / 0.055);

    transition:
      color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  /*
   * Draw only the protruding half of the outline. Its open right edge ends on
   * the vertical separator, producing one continuous D-shaped seam.
   */
  .sidebar-collapse-btn::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;

    width: 50%;
    box-sizing: border-box;

    border-top: 1px solid var(--collapse-outline);
    border-bottom: 1px solid var(--collapse-outline);
    border-left: 1px solid var(--collapse-outline);
    border-radius: 8px 0 0 8px;

    pointer-events: none;
    transition: border-color 140ms ease;
  }

  .sidebar-collapse-btn svg {
    position: relative;
    z-index: 1;

    width: 14px;
    height: 14px;
    transform: translateX(-1px);

    transition: transform 140ms ease;
  }

  .sidebar-collapse-btn:hover {
    --collapse-outline: color-mix(
      in srgb,
      var(--color-accent) 48%,
      var(--topbar-separator)
    );

    color: var(--color-accent);
    box-shadow: -2px 2px 7px rgb(0 175 165 / 0.1);
  }

  .sidebar-collapse-btn:hover svg {
    transform: translateX(-1px) scale(1.07);
  }

  .sidebar-collapse-btn:active {
    transform: translate(-50%, -50%) scale(0.94);
  }

  .sidebar-collapse-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  :global([data-theme='dark']) .sidebar-collapse-btn {
    color: var(--color-text-muted);
    background: var(--topbar-surface);
    box-shadow: -2px 2px 7px rgb(0 0 0 / 0.18);
  }

  :global([data-theme='dark']) .sidebar-collapse-btn:hover {
    --collapse-outline: color-mix(
      in srgb,
      var(--color-accent) 42%,
      var(--topbar-separator)
    );

    color: var(--color-accent);
  }

  @media (min-width: 769px) {
    .sidebar-collapse-btn {
      display: inline-flex;
    }
  }

  .project-key-pill {
    display: inline-flex;
    align-items: center;

    padding: 3px 10px;

    color: var(--color-accent);
    background: var(--color-accent-subtle);
    border-radius: 20px;

    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .search-btn {
    width: 100%;
    max-width: 480px;

    display: flex;
    align-items: center;
    gap: 8px;

    padding: 8px 14px;

    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;

    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      background 150ms ease;
  }

  .search-btn > svg {
    width: 15px;
    height: 15px;
    flex: 0 0 15px;
  }

  :global([data-theme='dark']) .search-btn {
    background: rgba(255, 255, 255, 0.04);
  }

  .search-btn:hover {
    color: var(--color-text);
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.1);
  }

  .search-placeholder {
    min-width: 0;
    flex: 1;

    color: var(--color-text-muted);
    font-size: 0.85rem;
    text-align: left;

    animation: hint-fade 3s ease forwards;
  }

  .search-kbd {
    padding: 2px 6px;

    color: var(--color-accent);
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: 5px;

    font: inherit;
    font-size: 0.7rem;
  }

  @keyframes hint-fade {
    0% {
      opacity: 0;
      transform: translateY(4px);
    }

    15% {
      opacity: 1;
      transform: translateY(0);
    }

    80% {
      opacity: 1;
      transform: translateY(0);
    }

    100% {
      opacity: 0.7;
      transform: translateY(0);
    }
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 7px;

    padding: 5px 9px;

    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 600;

    border: 1px solid var(--color-border);
    border-radius: 999px;
  }

  .live-dot {
    width: 7px;
    height: 7px;

    background: var(--color-success);
    border-radius: 50%;

    box-shadow: 0 0 0 4px color-mix(
      in srgb,
      var(--color-success) 12%,
      transparent
    );

    animation: live-pulse 2s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%,
    100% {
      opacity: 0.75;
    }

    50% {
      opacity: 1;
      box-shadow: 0 0 0 6px color-mix(
        in srgb,
        var(--color-success) 8%,
        transparent
      );
    }
  }

  .user-menu-wrap {
    position: relative;
  }

  .topbar-avatar {
    width: 34px;
    height: 34px;

    display: grid;
    place-items: center;

    color: #ffffff;
    background: var(--color-accent);
    border: 0;
    border-radius: 50%;

    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;

    cursor: pointer;
  }

  .user-dropdown {
    width: 240px;
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 120;

    padding: 8px;

    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;

    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
  }

  .dropdown-header {
    display: flex;
    flex-direction: column;
    gap: 2px;

    padding: 8px 10px 10px;
  }

  .dropdown-name {
    color: var(--color-text);
    font-size: 0.86rem;
    font-weight: 700;
  }

  .dropdown-email {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-role {
    width: fit-content;
    margin-top: 6px;
    padding: 3px 7px;

    color: var(--color-accent);
    background: var(--color-accent-subtle);
    border-radius: 999px;

    font-size: 0.65rem;
    font-weight: 700;
  }

  .dropdown-divider {
    height: 1px;
    margin: 4px 0;
    background: var(--color-border);
  }

  .dropdown-item {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 9px;

    padding: 9px 10px;

    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: 8px;

    font: inherit;
    font-size: 0.8rem;
    text-align: left;
    text-decoration: none;

    cursor: pointer;
  }

  .dropdown-item svg {
    width: 15px;
    height: 15px;
    flex: 0 0 15px;
  }

  .dropdown-item:hover {
    color: var(--color-accent);
    background: var(--color-accent-subtle);
    text-decoration: none;
  }

  .dropdown-item--danger {
    color: var(--color-danger);
  }

  .dropdown-item--danger:hover {
    color: var(--color-danger);
    background: rgba(220, 38, 38, 0.08);
  }

  /* ── Page content ──────────────────────────────────────── */

  .content {
    min-height: 0;
    flex: 1;

    padding: 32px;
    overflow-y: auto;
  }

  .app-footer {
    max-height: 50px;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;

    margin: 32px -32px -32px;
    padding: 16px 24px;

    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);

    font-size: 0.72rem;
    opacity: 0.7;
  }

  .footer-sep {
    opacity: 0.5;
  }

  .preview-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;

    padding: 8px 20px;

    color: var(--color-accent);
    background: color-mix(
      in srgb,
      var(--color-accent),
      transparent 88%
    );

    border-bottom: 1px solid color-mix(
      in srgb,
      var(--color-accent),
      transparent 70%
    );

    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .preview-banner svg {
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
  }

  .route-skeleton {
    height: 3px;
    position: fixed;
    top: var(--topbar-height);
    right: 0;
    left: 0;
    z-index: 200;

    pointer-events: none;

    background:
      linear-gradient(
        90deg,
        transparent 0%,
        var(--color-accent) 35%,
        var(--color-accent-mint) 65%,
        transparent 100%
      );

    background-size: 200% 100%;
    animation: route-loading-sweep 1.2s ease-in-out infinite;
  }

  @keyframes route-loading-sweep {
    from {
      background-position: 200% 0;
    }

    to {
      background-position: -200% 0;
    }
  }

  /* ── Mobile overlay and popup ──────────────────────────── */

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;

    background: rgba(0, 0, 0, 0.4);
  }

  .user-popup-overlay {
    display: none;
  }

  @media (max-width: 768px) {
    .sidebar {
      height: auto;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 50;

      transform: translateX(-100%);
      transition: transform 250ms ease;
    }

    .sidebar--open {
      transform: translateX(0);
    }

    .sidebar-brand {
      padding-inline: 14px;
    }

    .brand-link {
      grid-template-columns: 32px 100px;
      column-gap: 10px;

      width: 142px;
      min-width: 142px;
    }

    .sidebar-brand-wordmark {
      opacity: 1;
      visibility: visible;
      transform: none;
    }

    .sidebar-nav-search {
      display: block;
    }

    .sidebar-collapse-btn {
      display: none;
    }

    .topbar {
      padding: 0 14px;
    }

    .topbar-brand-mobile {
      display: inline-flex;
    }

    .topbar-brand-inline {
      display: flex;
    }

    .topbar-center {
      display: none;
    }

    .topbar-right {
      margin-left: auto;
    }

    .project-key-pill {
      display: none;
    }

    .live-text {
      display: none;
    }

    .live-indicator {
      padding: 7px;
      border: 0;
    }

    .user-dropdown {
      display: none;
    }

    .content {
      padding: 20px 16px;
    }

    .app-footer {
      margin: 24px -16px -20px;
      padding-inline: 16px;
      flex-wrap: wrap;
    }

    .user-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 300;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 24px;
      overflow: hidden;

      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);

      animation: popup-fade-in 150ms ease;
    }

    .user-popup {
      width: 100%;
      max-width: 320px;
      max-height: min(86vh, calc(100dvh - 48px));

      position: relative;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;

      padding: 28px 24px 20px;
      overflow-y: auto;

      background: rgba(248, 250, 252, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 20px;

      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);

      backdrop-filter: blur(28px) saturate(200%);
      -webkit-backdrop-filter: blur(28px) saturate(200%);

      text-align: center;
      overscroll-behavior: contain;

      animation: popup-slide-in 180ms ease;
    }

    :global([data-theme='dark']) .user-popup {
      background: rgba(11, 18, 32, 0.95);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .user-popup-avatar {
      width: 56px;
      height: 56px;

      display: grid;
      place-items: center;

      margin-bottom: 4px;

      color: #ffffff;
      background: var(--color-accent);
      border-radius: 50%;

      font-family: var(--font-sans, 'Sora', sans-serif);
      font-size: 1.4rem;
      font-weight: 700;
    }

    .user-popup-name {
      color: var(--color-text);
      font-family: var(--font-sans, 'Sora', sans-serif);
      font-size: 1rem;
      font-weight: 700;
    }

    .user-popup-email {
      color: var(--color-text-muted);
      font-size: 0.78rem;
    }

    .user-popup-role {
      margin: 8px auto 12px;
      padding: 4px 9px;

      color: var(--color-accent);
      background: var(--color-accent-subtle);
      border-radius: 999px;

      font-size: 0.7rem;
      font-weight: 700;
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

      color: var(--color-text);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;

      font-family: var(--font-body, 'Inter', sans-serif);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;

      cursor: pointer;
    }

    .popup-btn svg {
      width: 16px;
      height: 16px;
    }

    .popup-btn:hover {
      color: var(--color-accent);
      background: var(--color-accent-subtle);
      border-color: var(--color-accent);
      text-decoration: none;
    }

    .popup-btn--danger {
      color: var(--color-danger);
      background: rgba(239, 68, 68, 0.05);
      border-color: rgba(239, 68, 68, 0.25);
    }

    .popup-btn--danger:hover {
      color: var(--color-danger);
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--color-danger);
    }

    .popup-close {
      position: absolute;
      top: 14px;
      right: 16px;

      padding: 4px 6px;

      color: var(--color-text-muted);
      background: none;
      border: 0;
      border-radius: 6px;

      cursor: pointer;
    }

    .popup-close svg {
      width: 14px;
      height: 14px;
    }

    .popup-close:hover {
      color: var(--color-accent);
      background: var(--color-accent-subtle);
    }

    @keyframes popup-fade-in {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    @keyframes popup-slide-in {
      from {
        opacity: 0;
        transform: scale(0.94) translateY(8px);
      }

      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .brand-link,
    .sidebar-brand-wordmark,
    .sidebar-collapse-btn,
    .sidebar-collapse-btn svg,
    .search-placeholder,
    .live-dot,
    .route-skeleton {
      animation: none;
      transition: none;
    }
  }
</style>

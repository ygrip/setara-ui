<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';

  let { children } = $props();

  let session = $state<{ email: string; name: string } | null>(null);
  let sidebarOpen = $state(false);
  let userMenuOpen = $state(false);
  let paletteOpen = $state(false);

  const projectKey = $derived(page.params.projectKey ?? null);

  onMount(() => {
    const raw = localStorage.getItem('setara_session');
    if (!raw) {
      goto('/login');
      return;
    }
    try {
      session = JSON.parse(raw);
    } catch {
      goto('/login');
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

    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleOutsideClick);
    };
  });

  function signOut() {
    localStorage.removeItem('setara_session');
    goto('/login');
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  function isActive(href: string): boolean {
    return page.url.pathname.startsWith(href);
  }
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="var(--color-accent)"/>
        <path d="M7 8h10M7 12h7M7 16h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="brand-name">Setara</span>
      <ThemeToggle />
    </div>

    <nav class="sidebar-nav">
      <!-- Global section -->
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

      <!-- Divider with label -->
      <div class="nav-divider">
        <span class="nav-divider-label">Project</span>
        {#if projectKey}
          <span class="nav-divider-key">{projectKey}</span>
        {:else}
          <span class="nav-divider-hint">(select project)</span>
        {/if}
      </div>

      <!-- Project-contextual section -->
      {#if projectKey}
        <a
          href="/projects/{projectKey}/release-plans"
          class="nav-item"
          class:nav-item--active={isActive(`/projects/${projectKey}/release-plans`)}
          onclick={closeSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          Release Plans
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
        <a href="/workspace" class="nav-item nav-item--dimmed" onclick={closeSidebar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          Release Plans
        </a>
        <a href="/workspace" class="nav-item nav-item--dimmed" onclick={closeSidebar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 4h18v6H3zM3 14h18v6H3zM8 4v16M16 4v16"/>
          </svg>
          Test Repository
        </a>
        <a href="/workspace" class="nav-item nav-item--dimmed" onclick={closeSidebar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Executions
        </a>
        <a href="/workspace" class="nav-item nav-item--dimmed" onclick={closeSidebar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Coverage
        </a>
      {/if}

      <!-- Divider -->
      <div class="nav-divider nav-divider--simple"></div>

      <!-- Admin section -->
      <a
        href="/admin"
        class="nav-item"
        class:nav-item--active={isActive('/admin')}
        onclick={closeSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
        Administration
      </a>
    </nav>

    <div class="sidebar-footer">
    </div>
  </aside>

  <!-- Main area (topbar + content) -->
  <div class="main-area">
    <!-- Top bar (always visible) -->
    <header class="topbar">
      <div class="topbar-left">
        <!-- Hamburger button (mobile only) -->
        <button class="hamburger" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clip-rule="evenodd"/>
          </svg>
        </button>
        <!-- Brand (mobile only) -->
        <span class="topbar-brand-mobile">Setara</span>
        <!-- Project key pill (desktop) -->
        {#if projectKey}
          <span class="project-key-pill">{projectKey}</span>
        {/if}
      </div>

      <div class="topbar-right">
        <!-- Search button -->
        <button class="search-btn" onclick={() => paletteOpen = true} aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <kbd class="search-kbd">⌘K</kbd>
        </button>

        <!-- Live indicator -->
        <div class="live-indicator">
          <span class="live-dot"></span>
          <span class="live-text">Live</span>
        </div>

        <!-- User avatar dropdown -->
        {#if session}
          <div class="user-menu-wrap">
            <button
              class="topbar-avatar"
              onclick={() => userMenuOpen = !userMenuOpen}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              title={session.name}
            >
              {session.name?.[0]?.toUpperCase() ?? '?'}
            </button>
            {#if userMenuOpen}
              <div class="user-dropdown">
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
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-right: 1px solid rgba(255, 255, 255, 0.4);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  :global([data-theme="dark"]) .sidebar {
    background: rgba(10, 20, 18, 0.75);
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

  .brand-name {
    flex: 1;
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--color-accent);
    letter-spacing: -0.01em;
  }

  .sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
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
    padding: 8px 12px;
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
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-weight: 600;
  }

  .nav-item--dimmed {
    opacity: 0.45;
    pointer-events: none;
  }

  .sidebar-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--color-border);
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
    justify-content: space-between;
    gap: 12px;
    height: var(--topbar-height);
    padding: 0 20px;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  :global([data-theme="dark"]) .topbar {
    background: rgba(10, 20, 18, 0.78);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hamburger {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 4px;
    display: none;
    align-items: center;
    border-radius: 4px;
  }

  .hamburger:hover {
    color: var(--color-text);
  }

  .topbar-brand-mobile {
    display: none;
    font-weight: 700;
    font-size: 1rem;
    color: var(--color-accent);
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
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    transition: background 0.12s, border-color 0.12s;
  }

  .search-btn:hover {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .search-kbd {
    font-family: inherit;
    font-size: 0.72rem;
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 1px 5px;
  }

  @media (max-width: 768px) {
    .search-kbd {
      display: none;
    }
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
    background: rgba(15, 25, 22, 0.88);
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

  /* ── Mobile backdrop ── */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 40;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
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

    .hamburger {
      display: flex;
    }

    .topbar-brand-mobile {
      display: flex;
    }

    .project-key-pill {
      display: none;
    }

    .content {
      padding: 20px 16px;
    }
  }
</style>

<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getValidSession, hasPermission, type SetaraSession } from '$lib/auth';

  let { children } = $props();
  let session = $state<SetaraSession | null>(null);

  const navLinks = [
    { href: '/admin/tribes', label: 'Tribes', icon: '<path d="M3 7h18M3 12h18M3 17h18"/>' },
    { href: '/admin/squads', label: 'Squads', icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>' },
    { href: '/admin/users', label: 'Users', icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    { href: '/admin/roles', label: 'Roles', icon: '<path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/>' },
    { href: '/admin/intelligence', label: 'Intelligence', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>' }
  ];

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
  }

  onMount(() => {
    session = getValidSession();
    if (!hasPermission(session, 'settings:read')) {
      goto('/profile', { replaceState: true });
    }
  });
</script>

{#if hasPermission(session, 'settings:read')}
  <div class="admin-shell">
    <nav class="admin-tabs">
      {#each navLinks as link}
        <a
          href={link.href}
          class="admin-tab"
          class:admin-tab--active={isActive(link.href)}
          role="tab"
          aria-selected={isActive(link.href)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html link.icon}</svg>
          {link.label}
        </a>
      {/each}
    </nav>
    {@render children()}
  </div>
{/if}

<style>
  .admin-shell {
    max-width: min(1520px, 100%);
  }

  .admin-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 24px;
    border-bottom: 2px solid var(--color-border);
  }

  .admin-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 20px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .admin-tab:hover { color: var(--color-text); }

  .admin-tab--active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .admin-tabs {
      gap: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .admin-tab {
      padding: 10px 14px;
      font-size: 0.8rem;
      gap: 5px;
      flex-shrink: 0;
    }

    .admin-tab svg { width: 14px; height: 14px; }
  }
</style>

<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getValidSession, hasPermission, type SetaraSession } from '$lib/auth';

  let { children } = $props();
  let session = $state<SetaraSession | null>(null);

  const navLinks = [
    { href: '/admin/tribes', label: 'Tribes' },
    { href: '/admin/squads', label: 'Squads' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/roles', label: 'Roles' }
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
    <nav class="admin-subnav">
      {#each navLinks as link}
        <a
          href={link.href}
          class="subnav-item"
          class:subnav-item--active={isActive(link.href)}
        >
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

  .admin-subnav {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .subnav-item {
    display: inline-flex;
    align-items: center;
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    text-decoration: none;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .subnav-item:hover {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    border-color: var(--color-accent);
    text-decoration: none;
  }

  .subnav-item--active {
    background: var(--color-accent);
    color: #fff;
    border-color: var(--color-accent);
    font-weight: 600;
  }

  .subnav-item--active:hover {
    background: var(--color-accent-hover);
    color: #fff;
  }
</style>

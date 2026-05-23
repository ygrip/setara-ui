<script lang="ts">
  import { page } from '$app/state';

  const projectKey = $derived(page.params.projectKey ?? '');

  const sections = [
    {
      title: 'API Keys',
      desc: 'Create and manage API keys for automation runners.',
      href: (key: string) => `/projects/${key}/settings/api-keys`,
      icon: 'M15 7h3a5 5 0 010 10h-3m-6 0H6A5 5 0 016 7h3M8 12h8',
    },
    {
      title: 'Members',
      desc: 'Manage who has access to this project.',
      href: () => '#',
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100 8 4 4 0 000-8z',
      soon: true,
    },
    {
      title: 'Notifications',
      desc: 'Configure alerts for run failures and quality gate changes.',
      href: () => '#',
      icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
      soon: true,
    },
    {
      title: 'Integrations',
      desc: 'Connect CI/CD pipelines and third-party tools.',
      href: () => '#',
      icon: 'M18 20V10M12 20V4M6 20v-6',
      soon: true,
    },
  ];
</script>

<svelte:head>
  <title>Settings — {projectKey} — Setara</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/projects">Projects</a>
    <span class="sep">›</span>
    <a href="/projects/{projectKey}">{projectKey}</a>
    <span class="sep">›</span>
    <span>Settings</span>
  </nav>

  <div class="page-header">
    <h1 class="page-title">Settings</h1>
    <p class="page-sub">Manage configuration for {projectKey}</p>
  </div>

  <div class="settings-grid">
    {#each sections as s}
      {#if s.soon}
        <div class="settings-card settings-card--disabled">
          <div class="settings-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={s.icon}/>
            </svg>
          </div>
          <div class="settings-body">
            <div class="settings-title-row">
              <h2 class="settings-name">{s.title}</h2>
              <span class="soon-badge">Coming soon</span>
            </div>
            <p class="settings-desc">{s.desc}</p>
          </div>
        </div>
      {:else}
        <a href={s.href(projectKey)} class="settings-card">
          <div class="settings-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={s.icon}/>
            </svg>
          </div>
          <div class="settings-body">
            <h2 class="settings-name">{s.title}</h2>
            <p class="settings-desc">{s.desc}</p>
          </div>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </a>
      {/if}
    {/each}
  </div>
</div>

<style>
  .page { max-width: 800px; }

  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--color-accent); }
  .sep { opacity: 0.5; }

  .page-header { margin-bottom: 28px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-sub { color: var(--color-text-muted); font-size: 0.875rem; margin: 0; }

  .settings-grid {
    display: flex; flex-direction: column; gap: 12px;
  }

  .settings-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .settings-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-md);
  }

  .settings-card--disabled {
    opacity: 0.6;
    cursor: default;
  }

  .settings-icon {
    width: 44px; height: 44px; border-radius: var(--radius);
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .settings-body { flex: 1; min-width: 0; }

  .settings-title-row {
    display: flex; align-items: center; gap: 10px; margin-bottom: 4px;
  }

  .settings-name {
    font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin: 0;
  }

  .settings-desc {
    font-size: 0.8rem; color: var(--color-text-muted); margin: 0;
  }

  .soon-badge {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 2px 8px; border-radius: 4px;
    background: var(--color-accent-subtle); color: var(--color-text-muted);
  }

  .chevron { color: var(--color-text-muted); flex-shrink: 0; }
</style>

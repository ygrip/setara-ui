<script lang="ts">
  type ThemeMode = 'light' | 'dark';

  let isDark = $state(false);

  $effect(() => {
    const syncTheme = () => {
      isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  });

  function setTheme(theme: ThemeMode) {
    isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
</script>

<div class="theme-select" aria-label="Theme selection">
  <button
    class="theme-option"
    class:theme-option--active={!isDark}
    type="button"
    onclick={() => setTheme('light')}
    aria-pressed={!isDark}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <span>Light</span>
  </button>

  <button
    class="theme-option"
    class:theme-option--active={isDark}
    type="button"
    onclick={() => setTheme('dark')}
    aria-pressed={isDark}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <span>Dark</span>
  </button>
</div>

<style>
  .theme-select {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    width: 100%;
    padding: 3px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-bg), var(--color-surface) 48%);
  }

  .theme-option {
    min-width: 0;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border: 0;
    border-radius: calc(var(--radius) - 3px);
    background: transparent;
    cursor: pointer;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    line-height: 1;
    transition:
      background 0.15s,
      box-shadow 0.15s,
      color 0.15s;
  }

  .theme-option:hover {
    color: var(--color-accent);
  }

  .theme-option--active {
    background: color-mix(in srgb, var(--color-accent), var(--color-surface) 90%);
    color: var(--color-accent);
    box-shadow: 0 1px 6px rgb(15 23 42 / 0.1);
    border: 1px solid color-mix(in srgb, var(--color-accent), var(--color-surface) 60%);
  }

  :global([data-theme="dark"]) .theme-select {
    background: rgb(255 255 255 / 0.04);
  }

  :global([data-theme="dark"]) .theme-option--active {
    background: rgb(255 255 255 / 0.08);
    box-shadow: 0 1px 10px rgb(0 0 0 / 0.24);
  }
</style>

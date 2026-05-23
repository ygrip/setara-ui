<script lang="ts">
  let {
    status,
    size = 'md',
    reasons = []
  }: {
    status: 'READY' | 'AT_RISK' | 'NOT_READY' | 'UNKNOWN';
    size?: 'sm' | 'md' | 'lg';
    reasons?: string[];
  } = $props();

  const config = $derived((() => {
    switch (status) {
      case 'READY':
        return { label: 'Ready', icon: 'M20 6L9 17l-5-5', color: 'success' };
      case 'AT_RISK':
        return { label: 'At Risk', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', color: 'warning' };
      case 'NOT_READY':
        return { label: 'Not Ready', icon: 'M18 6L6 18M6 6l12 12', color: 'danger' };
      default:
        return { label: 'Unknown', icon: 'M5 12h14', color: 'neutral' };
    }
  })());
</script>

<div class="qg-wrapper">
  <span class="qg-badge qg-badge--{config.color} qg-badge--{size}">
    <svg class="qg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={config.icon}/>
    </svg>
    {config.label}
  </span>

  {#if reasons.length > 0}
    <ul class="qg-reasons">
      {#each reasons as reason}
        <li class="qg-reason">{reason}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .qg-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .qg-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  /* sizes */
  .qg-badge--sm {
    padding: 4px 12px;
    font-size: 0.75rem;
  }
  .qg-badge--sm .qg-icon { width: 13px; height: 13px; }

  .qg-badge--md {
    padding: 7px 18px;
    font-size: 0.9rem;
  }
  .qg-badge--md .qg-icon { width: 16px; height: 16px; }

  .qg-badge--lg {
    padding: 12px 28px;
    font-size: 1.1rem;
  }
  .qg-badge--lg .qg-icon { width: 20px; height: 20px; }

  /* colors */
  .qg-badge--success {
    background: #dcfce7;
    color: #15803d;
    border: 1.5px solid #86efac;
  }
  .qg-badge--warning {
    background: #fef9c3;
    color: #92400e;
    border: 1.5px solid #fde047;
  }
  .qg-badge--danger {
    background: #fee2e2;
    color: #b91c1c;
    border: 1.5px solid #fca5a5;
  }
  .qg-badge--neutral {
    background: var(--color-accent-subtle);
    color: var(--color-text-muted);
    border: 1.5px solid var(--color-border);
  }

  :global([data-theme="dark"]) .qg-badge--success { background: #14532d; color: #86efac; border-color: #166534; }
  :global([data-theme="dark"]) .qg-badge--warning { background: #78350f; color: #fcd34d; border-color: #92400e; }
  :global([data-theme="dark"]) .qg-badge--danger { background: #7f1d1d; color: #fca5a5; border-color: #991b1b; }

  .qg-reasons {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .qg-reason {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    padding-left: 14px;
    position: relative;
  }

  .qg-reason::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: var(--color-text-muted);
  }
</style>

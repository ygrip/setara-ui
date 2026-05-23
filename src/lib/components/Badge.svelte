<script lang="ts">
  let {
    text,
    variant = 'neutral'
  }: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  } = $props();
</script>

<span class="badge badge--{variant}">{text}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .badge--success {
    background: #dcfce7;
    color: #15803d;
  }

  .badge--danger {
    background: #fee2e2;
    color: #b91c1c;
  }

  .badge--warning {
    background: #fef9c3;
    color: #92400e;
  }

  .badge--info {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .badge--neutral {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  :global([data-theme="dark"]) .badge--success {
    background: #14532d;
    color: #86efac;
  }

  :global([data-theme="dark"]) .badge--danger {
    background: #7f1d1d;
    color: #fca5a5;
  }

  :global([data-theme="dark"]) .badge--warning {
    background: #78350f;
    color: #fcd34d;
  }

  :global([data-theme="dark"]) .badge--info {
    background: #1e3a8a;
    color: #93c5fd;
  }
</style>

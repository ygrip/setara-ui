<script lang="ts">
  let {
    text,
    variant = 'neutral'
  }: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral'
      | 'passed' | 'failed' | 'blocked' | 'skipped' | 'running'
      | 'automated' | 'manual' | 'automatable' | 'not-automatable';
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
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  /* ── Semantic variants ── */
  .badge--success, .badge--passed {
    background: #dcfce7;
    color: #15803d;
  }
  .badge--danger, .badge--failed {
    background: #fee2e2;
    color: #b91c1c;
  }
  .badge--warning, .badge--blocked {
    background: #fef3c7;
    color: #92400e;
  }
  .badge--info, .badge--running {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .badge--neutral, .badge--automated {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }
  .badge--skipped {
    background: #f1f5f9;
    color: #475569;
  }
  .badge--manual {
    background: #ede9fe;
    color: #6d28d9;
  }
  .badge--automatable {
    background: #cffafe;
    color: #0e7490;
  }
  .badge--not-automatable {
    background: #f1f5f9;
    color: #64748B;
  }

  /* ── Dark mode ── */
  :global([data-theme="dark"]) .badge--success,
  :global([data-theme="dark"]) .badge--passed {
    background: rgba(34, 197, 94, 0.15);
    color: #86efac;
  }
  :global([data-theme="dark"]) .badge--danger,
  :global([data-theme="dark"]) .badge--failed {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }
  :global([data-theme="dark"]) .badge--warning,
  :global([data-theme="dark"]) .badge--blocked {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
  }
  :global([data-theme="dark"]) .badge--info,
  :global([data-theme="dark"]) .badge--running {
    background: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
  }
  :global([data-theme="dark"]) .badge--skipped {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
  }
  :global([data-theme="dark"]) .badge--manual {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
  }
  :global([data-theme="dark"]) .badge--automatable {
    background: rgba(6, 182, 212, 0.15);
    color: #67e8f9;
  }
  :global([data-theme="dark"]) .badge--not-automatable {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
  }
</style>

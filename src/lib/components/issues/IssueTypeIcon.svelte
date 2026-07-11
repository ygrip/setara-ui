<script lang="ts">
  let { type }: { type: string } = $props();

  type Kind = 'bug' | 'story' | 'epic' | 'subtask' | 'task';

  function kindOf(raw: string): Kind {
    const t = raw.toLowerCase();
    if (t.includes('bug')) return 'bug';
    if (t.includes('epic')) return 'epic';
    if (t.includes('story')) return 'story';
    if (t.includes('sub')) return 'subtask';
    return 'task';
  }

  const COLORS: Record<Kind, string> = {
    bug: '#e5493a',
    story: '#65ba43',
    epic: '#904ee2',
    subtask: '#4bade8',
    task: '#4bade8'
  };

  let kind = $derived(kindOf(type));
  let color = $derived(COLORS[kind]);
</script>

<span class="issue-type-icon" style={`--issue-type-color: ${color}`} title={type} aria-hidden="true">
  {#if kind === 'bug'}
    <svg viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="var(--issue-type-color)" />
      <path fill="#fff" d="M8 3.4c.9 0 1.7.5 2.1 1.3l1.3-.1a.5.5 0 0 1 .1 1l-1 .1c.1.3.1.6.1.9h1a.5.5 0 0 1 0 1h-1c0 .3 0 .6-.1.9l1 .3a.5.5 0 1 1-.3 1l-1.2-.4C9.6 10.4 8.9 11 8 11s-1.6-.6-2-1.5l-1.2.4a.5.5 0 1 1-.3-1l1-.3a3 3 0 0 1-.1-.9h-1a.5.5 0 0 1 0-1h1c0-.3 0-.6.1-.9l-1-.1a.5.5 0 1 1 .1-1l1.3.1C6.3 3.9 7.1 3.4 8 3.4Z"/>
    </svg>
  {:else if kind === 'story'}
    <svg viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="var(--issue-type-color)" />
      <path fill="#fff" d="M5 3.5h6a.5.5 0 0 1 .5.5v8.3a.4.4 0 0 1-.63.33L8 10.9l-2.87 1.73A.4.4 0 0 1 4.5 12.3V4a.5.5 0 0 1 .5-.5Z"/>
    </svg>
  {:else if kind === 'epic'}
    <svg viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="var(--issue-type-color)" />
      <path fill="#fff" d="M8.6 3.2 5 8.4h2.2l-.8 4.4 3.9-5.6H8.1l.5-3.9Z"/>
    </svg>
  {:else if kind === 'subtask'}
    <svg viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="var(--issue-type-color)" />
      <path fill="#fff" d="M4.5 4h3v1.4h-3zM4.5 5.4v4.4h1.4V5.4zM5.9 8.6H8V10H5.9zM8.6 7.6h3V9h-3zM8.6 9v2.6H10V9z"/>
    </svg>
  {:else}
    <svg viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="var(--issue-type-color)" />
      <path fill="#fff" d="M4.4 5.6h7.2V7H4.4zM4.4 9h5v1.4h-5z"/>
    </svg>
  {/if}
</span>

<style>
  .issue-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .issue-type-icon svg {
    width: 100%;
    height: 100%;
  }
</style>

<script lang="ts">
  export type AppStep = {
    id: string;
    label: string;
    description?: string;
    state?: 'pending' | 'active' | 'complete' | 'error';
  };

  let {
    steps
  }: {
    steps: AppStep[];
  } = $props();
</script>

<ol class="app-stepper">
  {#each steps as step, index}
    <li class="app-step app-step--{step.state ?? 'pending'}">
      <span class="app-step__marker">{step.state === 'complete' ? '✓' : index + 1}</span>
      <span class="app-step__copy">
        <strong>{step.label}</strong>
        {#if step.description}<small>{step.description}</small>{/if}
      </span>
    </li>
  {/each}
</ol>

<style>
  .app-stepper {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .app-step {
    display: flex;
    min-width: 0;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
  }

  .app-step__marker {
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--step-bg);
    color: var(--step-fg);
    font-size: 0.78rem;
    font-weight: 800;
  }

  .app-step__copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .app-step__copy strong {
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .app-step__copy small {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .app-step--pending {
    --step-bg: color-mix(in srgb, var(--color-text-muted), transparent 84%);
    --step-fg: var(--color-text-muted);
  }

  .app-step--active {
    --step-bg: color-mix(in srgb, var(--color-accent), transparent 82%);
    --step-fg: var(--color-accent);
    border-color: color-mix(in srgb, var(--color-accent), transparent 60%);
  }

  .app-step--complete {
    --step-bg: color-mix(in srgb, var(--color-success), transparent 80%);
    --step-fg: var(--color-success);
  }

  .app-step--error {
    --step-bg: color-mix(in srgb, var(--color-danger), transparent 80%);
    --step-fg: var(--color-danger);
  }
</style>


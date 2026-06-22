<script lang="ts">
  let {
    steps,
    current = 0
  }: {
    steps: string[];
    current?: number;
  } = $props();
</script>

<ol class="stepper">
  {#each steps as step, i}
    <li class="stepper-item"
      class:stepper-item--done={i < current}
      class:stepper-item--active={i === current}>
      <span class="stepper-dot">{i < current ? '✓' : i + 1}</span>
      <span class="stepper-label">{step}</span>
      {#if i < steps.length - 1}
        <span class="stepper-line" aria-hidden="true"></span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .stepper {
    display: flex;
    align-items: flex-start;
    gap: 0;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stepper-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    position: relative;
  }

  .stepper-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .stepper-item--active .stepper-dot {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: #fff;
  }

  .stepper-item--done .stepper-dot {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 80%);
    color: var(--color-accent);
  }

  .stepper-label {
    margin-top: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-align: center;
    max-width: 80px;
    line-height: 1.3;
  }

  .stepper-item--active .stepper-label,
  .stepper-item--done .stepper-label {
    color: var(--color-text);
  }

  .stepper-line {
    position: absolute;
    top: 14px;
    left: calc(50% + 14px);
    right: calc(-50% + 14px);
    height: 2px;
    background: var(--color-border);
    z-index: 0;
  }

  .stepper-item--done .stepper-line {
    background: var(--color-accent);
  }
</style>

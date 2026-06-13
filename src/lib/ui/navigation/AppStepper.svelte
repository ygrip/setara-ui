<script lang="ts">
  import { Stepper } from 'flowbite-svelte';
  import type { Step, StepStatus } from 'flowbite-svelte';

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

  const stateToStatus: Record<string, StepStatus> = {
    pending: 'pending',
    active: 'current',
    complete: 'completed',
    error: 'pending'
  };

  const fbSteps = $derived(
    steps.map((s) => ({
      label: s.label,
      description: s.description,
      status: stateToStatus[s.state ?? 'pending']
    } satisfies Step))
  );

  const currentStep = $derived(
    steps.findIndex((s) => s.state === 'active') + 1 || 1
  );
</script>

<div class="app-stepper-wrap">
  <Stepper steps={fbSteps} current={currentStep} clickable={false} class="app-stepper" />
</div>

<style>
  .app-stepper-wrap { width: 100%; }

  :global(.app-stepper) {
    gap: 10px !important;
  }

  :global(.app-stepper li) {
    padding: 12px !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    font-family: var(--font-body) !important;
  }

  :global(.app-stepper li span) {
    font-size: 0.78rem !important;
    font-weight: 800 !important;
  }

  :global(.app-stepper li[data-active="true"],
  .app-stepper li.active) {
    border-color: color-mix(in srgb, var(--color-accent), transparent 60%) !important;
  }
</style>

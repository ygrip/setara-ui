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
  .app-stepper-wrap {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  :global(.app-stepper) {
    display: flex !important;
    gap: 0 !important;
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
    min-width: max-content;
  }

  :global(.app-stepper li) {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 10px 16px !important;
    border: 1px solid var(--color-border) !important;
    border-right: none !important;
    background: var(--color-surface) !important;
    font-family: var(--font-body) !important;
    white-space: nowrap;
    position: relative;
    flex-shrink: 0;
  }

  :global(.app-stepper li:first-child) {
    border-radius: var(--radius) 0 0 var(--radius) !important;
  }

  :global(.app-stepper li:last-child) {
    border-radius: 0 var(--radius) var(--radius) 0 !important;
    border-right: 1px solid var(--color-border) !important;
  }

  :global(.app-stepper li[data-active="true"]),
  :global(.app-stepper li.active) {
    background: color-mix(in srgb, var(--color-accent), transparent 92%) !important;
    border-color: color-mix(in srgb, var(--color-accent), transparent 50%) !important;
  }

  :global(.app-stepper li[data-status="completed"]),
  :global(.app-stepper li.completed) {
    background: color-mix(in srgb, #16a34a, transparent 94%) !important;
    border-color: color-mix(in srgb, #16a34a, transparent 65%) !important;
  }

  :global(.app-stepper li .step-number) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 800;
    background: var(--color-bg);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  :global(.app-stepper li[data-active="true"] .step-number),
  :global(.app-stepper li.active .step-number) {
    background: var(--color-accent);
    color: #fff;
  }

  :global(.app-stepper li[data-status="completed"] .step-number),
  :global(.app-stepper li.completed .step-number) {
    background: #16a34a;
    color: #fff;
  }

  :global(.app-stepper li span.step-label) {
    font-size: 0.78rem !important;
    font-weight: 700 !important;
    color: var(--color-text);
  }

  :global(.app-stepper li[data-active="true"] span.step-label),
  :global(.app-stepper li.active span.step-label) {
    color: var(--color-accent) !important;
  }

  :global(.app-stepper li[data-status="completed"] span.step-label),
  :global(.app-stepper li.completed span.step-label) {
    color: #16a34a !important;
  }

  @media (max-width: 640px) {
    :global(.app-stepper li) {
      padding: 8px 12px !important;
      gap: 5px !important;
    }
    :global(.app-stepper li .step-number) {
      width: 18px;
      height: 18px;
      font-size: 0.65rem;
    }
    :global(.app-stepper li span.step-label) {
      font-size: 0.72rem !important;
    }
  }
</style>

<script lang="ts">
  import SetaraLoader from './SetaraLoader.svelte';

  const defaultSteps = [
    'Reading build requirements',
    'Searching semantic matches',
    'Scoring scenario relevance',
    'Preparing recommendations'
  ];

  let {
    title = 'AI is thinking',
    subtitle = 'Analyzing context and preparing recommendations.',
    hint = 'This can take a little while when the model is busy.',
    steps = defaultSteps
  }: {
    title?: string;
    subtitle?: string;
    hint?: string;
    steps?: string[];
  } = $props();

  let stepIndex = $state(0);
  let elapsed = $state(0);

  $effect(() => {
    const timer = window.setInterval(() => {
      elapsed += 1;
      stepIndex = Math.min(steps.length - 1, Math.floor(elapsed / 4));
    }, 1000);

    return () => window.clearInterval(timer);
  });

  const elapsedLabel = $derived(elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
</script>

<section class="ai-thinking" aria-live="polite" aria-busy="true">
  <div class="ai-thinking-main">
    <div class="ai-thinking-loader">
      <SetaraLoader mode="orbit" size={86} label={title} />
      <div class="pulse pulse-one"></div>
      <div class="pulse pulse-two"></div>
    </div>

    <div class="ai-thinking-copy">
      <div class="eyebrow">
        <span class="live-dot"></span>
        <span>Working</span>
        <span class="elapsed">{elapsedLabel}</span>
      </div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  </div>

  <ol class="thinking-steps">
    {#each steps as step, index}
      <li
        class:active={index === stepIndex}
        class:done={index < stepIndex}
      >
        <span class="step-marker">
          {#if index < stepIndex}
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {:else}
            <span></span>
          {/if}
        </span>
        <span>{step}</span>
      </li>
    {/each}
  </ol>

  <div class="thinking-stream" aria-hidden="true">
    <span></span>
    <span></span>
    <span></span>
  </div>

  <p class="thinking-hint">{hint}</p>
</section>

<style>
  .ai-thinking {
    display: grid;
    gap: 22px;
    padding: clamp(24px, 5vw, 42px);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-accent), transparent 94%), transparent 44%),
      var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .ai-thinking-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 22px;
    align-items: center;
  }

  .ai-thinking-loader {
    position: relative;
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
  }

  .pulse {
    position: absolute;
    inset: 14px;
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 48%);
    border-radius: 50%;
    animation: pulse-ring 2.4s ease-out infinite;
    pointer-events: none;
  }

  .pulse-two {
    animation-delay: 0.9s;
  }

  .ai-thinking-copy {
    min-width: 0;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-accent);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent), transparent 45%);
    animation: live-dot 1.6s ease-in-out infinite;
  }

  .elapsed {
    margin-left: 2px;
    color: var(--color-accent);
  }

  h2 {
    margin: 0 0 6px;
    font-size: clamp(1.08rem, 2.4vw, 1.35rem);
    letter-spacing: 0;
  }

  p {
    margin: 0;
  }

  .ai-thinking-copy p,
  .thinking-hint {
    color: var(--color-text-muted);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .thinking-steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .thinking-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 9px 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-bg), transparent 36%);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 650;
    transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
  }

  .thinking-steps li.active {
    border-color: color-mix(in srgb, var(--color-accent), transparent 35%);
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
    color: var(--color-text);
  }

  .thinking-steps li.done {
    color: var(--color-text);
  }

  .step-marker {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid currentColor;
    border-radius: 999px;
    color: var(--color-text-muted);
  }

  .step-marker span {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.45;
  }

  li.active .step-marker {
    color: var(--color-accent);
    animation: marker-pulse 1.4s ease-in-out infinite;
  }

  li.done .step-marker {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: #fff;
  }

  .thinking-stream {
    display: grid;
    grid-template-columns: 1.25fr 0.85fr 1fr;
    gap: 8px;
    overflow: hidden;
  }

  .thinking-stream span {
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent), transparent 38%), transparent);
    transform: translateX(-100%);
    animation: stream 2.1s ease-in-out infinite;
  }

  .thinking-stream span:nth-child(2) {
    animation-delay: 0.24s;
  }

  .thinking-stream span:nth-child(3) {
    animation-delay: 0.48s;
  }

  .thinking-hint {
    padding-top: 2px;
  }

  @keyframes pulse-ring {
    0% {
      opacity: 0.75;
      transform: scale(0.72);
    }
    100% {
      opacity: 0;
      transform: scale(1.42);
    }
  }

  @keyframes live-dot {
    0%, 100% {
      transform: scale(0.86);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent), transparent 45%);
    }
    50% {
      transform: scale(1);
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-accent), transparent 92%);
    }
  }

  @keyframes marker-pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent), transparent 62%);
    }
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-accent), transparent 90%);
    }
  }

  @keyframes stream {
    0% {
      transform: translateX(-115%);
      opacity: 0;
    }
    22%, 70% {
      opacity: 1;
    }
    100% {
      transform: translateX(115%);
      opacity: 0;
    }
  }

  @media (max-width: 720px) {
    .ai-thinking-main {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
    }

    .eyebrow {
      justify-content: center;
    }

    .thinking-steps {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .live-dot,
    li.active .step-marker,
    .thinking-stream span {
      animation: none;
    }

    .thinking-stream span {
      transform: none;
      opacity: 0.55;
    }
  }
</style>

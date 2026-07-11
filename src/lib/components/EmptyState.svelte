<script lang="ts">
  export let title = "Nothing here yet";
  export let hint = "There is currently no data available.";
  export let actionText = "";
  export let actionHref = "";
  export let minHeight =
    "calc(100vh - var(--topbar-height, 56px) - 80px)";

  function handleAction() {
    if (actionHref) {
      window.location.href = actionHref;
    }
  }
</script>

<div
  class="empty-state"
  style={`min-height: ${minHeight};`}
>
<div class="empty-card">
<div class="empty-state__glow"></div>

  <!-- Animated icon -->
    <div class="icon-wrap" aria-hidden="true">
      <svg class="icon-bg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="90" />
      </svg>
      <div class="empty-icon">
    <slot name="icon">
      <!-- Default icon -->
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 7h18" />
        <path d="M6 4h12v16H6z" />
      </svg>
    </slot>
  </div>
  </div>

  <h2 class="empty-title">{title}</h2>

  <p class="empty-hint">
    {hint}
  </p>

  {#if actionText || $$slots.actions}
    <div class="empty-actions">
      <slot name="actions">
        <button
          class="empty-link"
          on:click={handleAction}
        >
          {actionText}
        </button>
      </slot>
    </div>
  {/if}
</div>
</div>

<style>
  .empty-state {
    position: relative;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    text-align: center;

    width: 100%;
    padding: clamp(40px, 8vw, 80px) 24px;
    box-sizing: border-box;

    overflow: hidden;
  }

  .empty-state__glow {
    position: absolute;

    width: 240px;
    height: 240px;

    border-radius: 999px;

    background: radial-gradient(
      circle,
      var(--color-accent-soft, rgba(59, 130, 246, 0.08)),
      transparent 70%
    );

    pointer-events: none;
  }

  .empty-icon {
    position: relative;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
    aspect-ratio: auto !important; 
    display: block;
    color: var(--color-accent, var(--color-text-muted));
    animation: float 3s ease-in-out infinite;
  }

  .empty-icon svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .empty-title {
    margin: 0 0 8px;

    color: var(--color-text);

    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .empty-hint {
    margin: 0;

    max-width: 420px;

    color: var(--color-text-muted);

    font-size: 0.92rem;
    line-height: 1.6;
  }

  .empty-actions {
    margin-top: 24px;

    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 440px;
    width: 100%;
    text-align: center;
  }

  /* Animated icon */
  .icon-wrap {
    position: relative;
    width: 100px;
    height: 100px;
    margin-bottom: 8px;
  }

  .empty-link {
    padding: 0;

    background: none;
    border: none;

    color: var(--color-accent);

    font-size: 0.9rem;
    font-weight: 500;

    cursor: pointer;

    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  .empty-link:hover {
    opacity: 0.8;
    transform: translateY(-1px);
  }

  .empty-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
    border-radius: 4px;
  }

  .icon-wrap {
    position: relative;
    width: 100px;
    height: 100px;
    margin-bottom: 8px;
  }

  .icon-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: pulse-bg 3s ease-in-out infinite;
  }

  .icon-bg circle {
    fill: color-mix(in srgb, var(--color-accent, #6366f1), transparent 88%);
  }

  @keyframes pulse-bg {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.06); opacity: 0.7; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }

  @keyframes empty-float {
    0%,
    100% {
      transform: translateY(0);
    }

    50% {
      transform: translateY(-6px);
    }
  }

  @media (max-width: 768px) {
    .empty-state {
      padding: 48px 20px;
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 1rem;
    }

    .empty-hint {
      max-width: 320px;
      font-size: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .empty-icon {
      animation: none;
    }

    .empty-link {
      transition: none;
    }
  }
</style>
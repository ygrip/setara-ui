<script lang="ts">
  let {
    text,
    position = 'top',
    children
  }: {
    text: string;
    position?: 'top' | 'right' | 'bottom' | 'left';
    children?: import('svelte').Snippet;
  } = $props();
</script>

<span class="app-tooltip app-tooltip--{position}">
  {@render children?.()}
  <span class="app-tooltip__bubble" role="tooltip">{text}</span>
</span>

<style>
  .app-tooltip {
    position: relative;
    display: inline-flex;
    min-width: 0;
  }

  .app-tooltip__bubble {
    position: absolute;
    z-index: 160;
    width: max-content;
    max-width: min(240px, calc(100vw - 32px));
    padding: 7px 9px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-text);
    color: var(--color-bg);
    box-shadow: var(--shadow-md);
    font-size: 0.76rem;
    line-height: 1.35;
    opacity: 0;
    pointer-events: none;
    transform: translateY(2px);
    transition: opacity 0.12s ease, transform 0.12s ease;
    white-space: normal;
  }

  .app-tooltip:hover .app-tooltip__bubble,
  .app-tooltip:focus-visible .app-tooltip__bubble,
  .app-tooltip:focus-within .app-tooltip__bubble {
    opacity: 1;
    transform: translateY(0);
  }

  .app-tooltip--top .app-tooltip__bubble {
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translate(-50%, 2px);
  }

  .app-tooltip--top:hover .app-tooltip__bubble,
  .app-tooltip--top:focus-visible .app-tooltip__bubble,
  .app-tooltip--top:focus-within .app-tooltip__bubble {
    transform: translate(-50%, 0);
  }

  .app-tooltip--bottom .app-tooltip__bubble {
    left: 50%;
    top: calc(100% + 8px);
    transform: translate(-50%, -2px);
  }

  .app-tooltip--bottom:hover .app-tooltip__bubble,
  .app-tooltip--bottom:focus-visible .app-tooltip__bubble,
  .app-tooltip--bottom:focus-within .app-tooltip__bubble {
    transform: translate(-50%, 0);
  }

  .app-tooltip--right .app-tooltip__bubble {
    left: calc(100% + 8px);
    top: 50%;
    transform: translate(-2px, -50%);
  }

  .app-tooltip--right:hover .app-tooltip__bubble,
  .app-tooltip--right:focus-visible .app-tooltip__bubble,
  .app-tooltip--right:focus-within .app-tooltip__bubble {
    transform: translate(0, -50%);
  }

  .app-tooltip--left .app-tooltip__bubble {
    right: calc(100% + 8px);
    top: 50%;
    transform: translate(2px, -50%);
  }

  .app-tooltip--left:hover .app-tooltip__bubble,
  .app-tooltip--left:focus-visible .app-tooltip__bubble,
  .app-tooltip--left:focus-within .app-tooltip__bubble {
    transform: translate(0, -50%);
  }
</style>

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

<span class="app-tooltip-wrap" data-tip={text} data-pos={position}>
  {@render children?.()}
</span>

<style>
  .app-tooltip-wrap {
    display: inline-flex;
    min-width: 0;
    position: relative;
  }

  .app-tooltip-wrap::after {
    content: attr(data-tip);
    position: absolute;
    white-space: normal;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 9999;

    padding: 7px 9px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-text);
    color: var(--color-bg);
    box-shadow: var(--shadow-md);
    font-size: 0.76rem;
    line-height: 1.35;
    font-family: var(--font-body);
    max-width: min(240px, calc(100vw - 32px));
  }

  .app-tooltip-wrap[data-pos='top']::after {
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }

  .app-tooltip-wrap[data-pos='bottom']::after {
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }

  .app-tooltip-wrap[data-pos='left']::after {
    right: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }

  .app-tooltip-wrap[data-pos='right']::after {
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }

  .app-tooltip-wrap:hover::after,
  .app-tooltip-wrap:focus-within::after {
    opacity: 1;
  }
</style>

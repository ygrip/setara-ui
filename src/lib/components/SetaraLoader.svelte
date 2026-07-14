<script lang="ts">
  const ringPath = 'M627 187 L1008 407 L1008 847 L627 1067 L246 847 L246 407 Z';
  const waveUpperTopPath = 'M303 557 L447 557 L520 530 L574 506 L606 494 L634 493 L665 503 L720 529 L794 557 L951 557 L908 631 L781 631 L706 602 L657 584 L630 581 L603 585 L550 608 L474 633 L345 633 Z';
  const waveUpperFlatPath = 'M303 557 L447 557 L520 557 L574 557 L606 557 L634 557 L665 557 L720 557 L794 557 L951 557 L908 633 L781 633 L706 633 L657 633 L630 633 L603 633 L550 633 L474 633 L345 633 Z';
  const waveUpperBottomPath = 'M303 557 L447 557 L520 584 L574 608 L606 620 L634 621 L665 611 L720 585 L794 557 L951 557 L908 633 L781 633 L706 662 L657 680 L630 685 L603 681 L550 656 L474 633 L345 633 Z';
  const waveLowerTopPath = 'M303 718 L447 718 L520 691 L574 667 L606 655 L634 654 L665 664 L720 690 L794 718 L951 718 L908 792 L781 792 L706 763 L657 745 L630 742 L603 746 L550 769 L474 794 L345 794 Z';
  const waveLowerFlatPath = 'M303 718 L447 718 L520 718 L574 718 L606 718 L634 718 L665 718 L720 718 L794 718 L951 718 L908 794 L781 794 L706 794 L657 794 L630 794 L603 794 L550 794 L474 794 L345 794 Z';
  const waveLowerBottomPath = 'M303 718 L447 718 L520 745 L574 769 L606 781 L634 782 L665 772 L720 746 L794 718 L951 718 L908 794 L781 794 L706 823 L657 841 L630 846 L603 842 L550 817 L474 794 L345 794 Z';

  let {
    mode = 'progress',
    size = 64,
    label = 'Loading',
    color = 'accent'
  }: {
    mode?: 'progress' | 'orbit';
    color?: 'white' | 'accent' | 'bright' | 'black';
    size?: number;
    label?: string;
  } = $props();
</script>

<div
  class="loader loader--{mode}"
  style={`--loader-size:${size}px; color: var(--loader-${color});`}
  role="status"
  aria-label={label}
>
  <svg
    class="loader-svg"
    width={size}
    height={size}
    viewBox="0 0 1254 1254"
    aria-hidden="true"
  >
    <g class="ring">
      <path
        class="outer-ring-base"
        d={ringPath}
        fill="none"
        stroke-width="72"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <path
        class="outer-ring-loader"
        d={ringPath}
        fill="none"
        stroke-width="72"
        stroke-linejoin="round"
        stroke-linecap="round"
        pathLength="100"
      />
      <path
        class="outer-ring-head"
        d={ringPath}
        fill="none"
        stroke-width="112"
        stroke-linejoin="round"
        stroke-linecap="round"
        pathLength="100"
      />
    </g>

    <path
      class="wave wave-upper"
      d={waveUpperTopPath}
    />

    <path
      class="wave wave-lower"
      d={waveLowerTopPath}
    />
  </svg>
  <span class="sr-only">{label}</span>
</div>

<style>
  .loader {
    --loader-accent: var(--color-accent, #00afa5);
    --loader-dark: var(--color-dark, #00afa5);
    --loader-bright: var(--color-accent-mint, #5ef2d6);
    --loader-white: var(--color-text, #ffffff);
    --loader-black: var(--color-black, #000000);
    --loader-size: 64px;
    display: inline-grid;
    place-items: center;
    width: var(--loader-size);
    height: var(--loader-size);
    --orbit-duration: 3s;
  }

  .loader-svg {
    display: block;
    width: var(--loader-size);
    height: var(--loader-size);
    overflow: visible;
  }

  .ring {
    transform-origin: 627px 627px;
  }

  .outer-ring-base {
    stroke: currentColor;
    opacity: 0.2;
  }

  .outer-ring-loader {
    stroke: currentColor;
    opacity: 0.98;
    filter: drop-shadow(0 0 16px color-mix(in srgb, currentColor, transparent 60%));
  }

  .outer-ring-head {
    display: none;
    stroke: currentColor;
    fill: none;
  }

  .wave {
    fill: currentColor;
    animation-duration: 3.2s;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }

  .wave-upper {
    animation-name: wave-upper-phase;
  }

  .wave-lower {
    animation-name: wave-lower-phase;
  }

  .loader--progress .outer-ring-loader {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: ring-progress 1.85s cubic-bezier(0.42, 0, 0.2, 1) infinite;
  }

  .loader--orbit .outer-ring-loader {
    --orbit-track-start: 0;
    --orbit-track-end: -100;
    stroke-dasharray: 26 74;
    stroke-dashoffset: var(--orbit-track-start);
    opacity: 0.48;
    stroke-linecap: round;
    filter: drop-shadow(0 0 12px color-mix(in srgb, currentColor, transparent 72%));
    animation: orbit-track var(--orbit-duration) linear infinite,
      orbit-tail-fade var(--orbit-duration) ease-in-out infinite;
  }

  .loader--orbit .outer-ring-head {
    --orbit-track-start: -26;
    --orbit-track-end: -126;
    display: block;
    stroke-dasharray: 0.001 99.999;
    stroke-dashoffset: var(--orbit-track-start);
    opacity: 0.97;
    filter: drop-shadow(0 0 14px color-mix(in srgb, currentColor, transparent 32%));
    animation: orbit-track var(--orbit-duration) linear infinite,
      orbit-head-pulse 1.18s ease-in-out infinite;
  }

  .loader--orbit .outer-ring-base {
    opacity: 0.24;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes ring-progress {
    0% {
      stroke-dashoffset: 100;
      opacity: 0.95;
    }
    76% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    88% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    88.1% {
      stroke-dashoffset: 100;
      opacity: 0;
    }
    100% {
      stroke-dashoffset: 100;
      opacity: 0.95;
    }
  }

  @keyframes orbit-track {
    from {
      stroke-dashoffset: var(--orbit-track-start);
    }
    to {
      stroke-dashoffset: var(--orbit-track-end);
    }
  }

  @keyframes orbit-tail-fade {
    0% {
      opacity: 0.22;
    }
    50% {
      opacity: 0.62;
    }
    100% {
      opacity: 0.22;
    }
  }

  @keyframes orbit-head-pulse {
    0%, 100% {
      stroke-width: 104;
      opacity: 0.9;
      filter: drop-shadow(0 0 10px color-mix(in srgb, currentColor, transparent 42%));
    }
    45% {
      stroke-width: 126;
      opacity: 1;
      filter: drop-shadow(0 0 20px color-mix(in srgb, currentColor, transparent 24%));
    }
    70% {
      stroke-width: 110;
      opacity: 0.86;
      filter: drop-shadow(0 0 8px color-mix(in srgb, currentColor, transparent 50%));
    }
  }

  @keyframes wave-upper-phase {
    0%, 22%, 100% {
      d: path("M303 557 L447 557 L520 530 L574 506 L606 494 L634 493 L665 503 L720 529 L794 557 L951 557 L908 631 L781 631 L706 602 L657 584 L630 581 L603 585 L550 608 L474 633 L345 633 Z");
    }
    46%, 54% {
      d: path("M303 557 L447 557 L520 557 L574 557 L606 557 L634 557 L665 557 L720 557 L794 557 L951 557 L908 633 L781 633 L706 633 L657 633 L630 633 L603 633 L550 633 L474 633 L345 633 Z");
    }
    78% {
      d: path("M303 557 L447 557 L520 584 L574 608 L606 620 L634 621 L665 611 L720 585 L794 557 L951 557 L908 633 L781 633 L706 662 L657 680 L630 685 L603 681 L550 656 L474 633 L345 633 Z");
    }
  }

  @keyframes wave-lower-phase {
    0%, 22%, 100% {
      d: path("M303 718 L447 718 L520 691 L574 667 L606 655 L634 654 L665 664 L720 690 L794 718 L951 718 L908 792 L781 792 L706 763 L657 745 L630 742 L603 746 L550 769 L474 794 L345 794 Z");
    }
    46%, 54% {
      d: path("M303 718 L447 718 L520 718 L574 718 L606 718 L634 718 L665 718 L720 718 L794 718 L951 718 L908 794 L781 794 L706 794 L657 794 L630 794 L603 794 L550 794 L474 794 L345 794 Z");
    }
    78% {
      d: path("M303 718 L447 718 L520 745 L574 769 L606 781 L634 782 L665 772 L720 746 L794 718 L951 718 L908 794 L781 794 L706 823 L657 841 L630 846 L603 842 L550 817 L474 794 L345 794 Z");
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .outer-ring-loader,
    .wave {
      animation-duration: 8s;
    }
  }
</style>

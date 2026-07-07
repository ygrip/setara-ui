<script lang="ts">
  import { onMount, tick } from 'svelte';
  import gsap from 'gsap';
  import setaraSvg from '$lib/assets/setara.svg?raw';

  let {
    size = 172,
    ariaLabel = 'Setara',
    animate = true,
    loop = true
  }: {
    size?: number | string;
    ariaLabel?: string;
    animate?: boolean;
    loop?: boolean;
  } = $props();

  const croppedViewBox = '32 128 252 75';

  let root: HTMLDivElement | undefined = $state(undefined);

  const cssSize = $derived(typeof size === 'number' ? `${size}px` : size);

  function prepareSvg(svg: SVGSVGElement) {
    svg.setAttribute('viewBox', croppedViewBox);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  onMount(() => {
    let ctx: gsap.Context | undefined;
    let killed = false;

    tick().then(() => {
      if (killed || !root) return;

      ctx = gsap.context(() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const svgs = Array.from(root!.querySelectorAll<SVGSVGElement>('svg'));
        svgs.forEach(prepareSvg);

        const paths = Array.from(
          root!.querySelectorAll<SVGPathElement>('.setara-gsap-logo__base svg path')
        ).sort((a, b) => {
          const boxA = a.getBBox();
          const boxB = b.getBBox();
          return boxA.x - boxB.x || boxA.y - boxB.y;
        });

        const shine = root!.querySelector<HTMLElement>('.setara-gsap-logo__shine');
        const underline = root!.querySelector<HTMLElement>('.setara-gsap-logo__underline');
        const glow = root!.querySelector<HTMLElement>('.setara-gsap-logo__glow');

        gsap.set(paths, {
          fill: '#00AFA5',
          autoAlpha: 1,
          transformOrigin: '50% 50%'
        });

        gsap.set(root!, {
          filter: 'drop-shadow(0 10px 20px rgba(0, 175, 165, 0.06))'
        });

        if (!animate || reduceMotion) {
          gsap.set([shine, underline, glow], { autoAlpha: 0 });
          return;
        }

        gsap.set(paths, { autoAlpha: 0, y: 10, scale: 0.965 });
        gsap.set(shine, { autoAlpha: 0, '--shine-x': '-40%' } as gsap.TweenVars);
        gsap.set(underline, { autoAlpha: 0, scaleX: 0, transformOrigin: '0% 50%' });
        gsap.set(glow, { autoAlpha: 0, scaleX: 0.16, transformOrigin: '50% 50%' });

        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

        intro
          .to(paths, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            stagger: { each: 0.026, from: 'start' }
          })
          .to(
            root!,
            { filter: 'drop-shadow(0 0 18px rgba(94, 242, 214, 0.4))', duration: 0.22, yoyo: true, repeat: 1 },
            '-=0.18'
          )
          .to(underline, { autoAlpha: 0.9, scaleX: 1, duration: 0.44, ease: 'expo.out' }, '-=0.36')
          .to(glow, { autoAlpha: 0.75, scaleX: 1, duration: 0.5, ease: 'expo.out' }, '<')
          .to(glow, { autoAlpha: 0, duration: 0.4 }, '-=0.18')
          .to(shine, { autoAlpha: 0.95, duration: 0.01 }, '-=0.66')
          .to(shine, { '--shine-x': '140%', duration: 0.95, ease: 'power2.inOut' } as gsap.TweenVars, '<')
          .to(shine, { autoAlpha: 0, duration: 0.12 }, '-=0.08');

        if (loop) {
          const idle = gsap.timeline({ repeat: -1, repeatDelay: 3.2, paused: true });

          idle
            .set(shine, { '--shine-x': '-40%' } as gsap.TweenVars)
            .to(shine, { autoAlpha: 0.9, duration: 0.01 })
            .to(shine, { '--shine-x': '140%', duration: 1.1, ease: 'power2.inOut' } as gsap.TweenVars, '<')
            .to(root!, { filter: 'drop-shadow(0 0 14px rgba(94, 242, 214, 0.28))', duration: 0.32, yoyo: true, repeat: 1 }, 0.12)
            .to(underline, { scaleX: 0.84, duration: 0.36, ease: 'power2.inOut', yoyo: true, repeat: 1 }, 0.22)
            .to(shine, { autoAlpha: 0, duration: 0.12 }, 1.05);

          intro.add(() => idle.play(0), '+=0.55');
        }
      }, root!);
    });

    return () => {
      killed = true;
      ctx?.revert();
    };
  });
</script>

<div
  bind:this={root}
  class="setara-gsap-logo"
  style={`width: ${cssSize};`}
  role="img"
  aria-label={ariaLabel}
>
  <span class="setara-gsap-logo__base">
    {@html setaraSvg}
  </span>

  <span class="setara-gsap-logo__shine" aria-hidden="true">
    {@html setaraSvg}
  </span>

  <span class="setara-gsap-logo__underline" aria-hidden="true"></span>
  <span class="setara-gsap-logo__glow" aria-hidden="true"></span>
</div>

<style>
  .setara-gsap-logo {
    --shine-x: -40%;
    position: relative;
    display: inline-block;
    aspect-ratio: 3.35 / 1;
    isolation: isolate;
    overflow: visible;
    vertical-align: middle;
  }

  .setara-gsap-logo__base,
  .setara-gsap-logo__shine {
    position: absolute;
    inset: 0;
    display: block;
  }

  .setara-gsap-logo__base :global(svg),
  .setara-gsap-logo__shine :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .setara-gsap-logo__base :global(path) {
    fill: #00afa5;
  }

  .setara-gsap-logo__shine {
    z-index: 2;
    opacity: 0;
    mix-blend-mode: screen;
    filter: blur(0.2px);
    clip-path: polygon(
      calc(var(--shine-x) - 13%) 0%,
      calc(var(--shine-x) + 7%) 0%,
      calc(var(--shine-x) + 19%) 100%,
      calc(var(--shine-x) - 1%) 100%
    );
    pointer-events: none;
  }

  .setara-gsap-logo__shine :global(path) {
    fill: #edfffe;
  }

  .setara-gsap-logo__underline {
    position: absolute;
    left: 5%;
    right: 5%;
    bottom: 10%;
    height: 2px;
    z-index: 1;
    border-radius: 999px;
    opacity: 0;
    background: linear-gradient(
      90deg,
      rgba(0, 175, 165, 0),
      rgba(0, 194, 184, 0.8),
      rgba(94, 242, 214, 0.95),
      rgba(0, 175, 165, 0)
    );
    box-shadow: 0 0 16px rgba(94, 242, 214, 0.42);
  }

  .setara-gsap-logo__glow {
    position: absolute;
    left: 18%;
    right: 18%;
    bottom: 3%;
    height: 24%;
    z-index: 0;
    opacity: 0;
    pointer-events: none;
    border-radius: 999px;
    background: radial-gradient(
      ellipse at center,
      rgba(94, 242, 214, 0.34),
      rgba(0, 175, 165, 0.12) 42%,
      transparent 72%
    );
    filter: blur(10px);
  }
</style>

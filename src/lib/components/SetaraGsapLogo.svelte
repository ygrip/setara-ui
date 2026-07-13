<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { gsap } from 'gsap';
  import setaraSvg from '$lib/assets/setara.svg?raw';

  type LogoColor = 'white' | 'accent' | 'bright' | 'black';

  type Box = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  const allowedColors: LogoColor[] = ['white', 'accent', 'bright', 'black'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function normalizeSvg(svg: string) {
    return svg.replace(/<svg\b[^>]*>/, (tag) => {
      const cleaned = tag
        .replace(/\swidth=(["']).*?\1/g, '')
        .replace(/\sheight=(["']).*?\1/g, '')
        .replace(/\sviewBox=(["']).*?\1/g, '')
        .replace(/\spreserveAspectRatio=(["']).*?\1/g, '');

      return cleaned.replace(
        '<svg',
        '<svg width="100%" height="100%" viewBox="0 0 313 313" preserveAspectRatio="xMidYMid meet"'
      );
    });
  }

  /**
   * The wordmark ships as one compound <path> (one "M...Z" subpath per letter).
   * Split it into a path per letter so the scribble effect below can stroke and
   * stagger each letter individually instead of drawing the whole word as a
   * single, non-staggered stroke.
   */
  function splitLetterPaths(svg: string) {
    return svg.replace(/<path\b([^>]*?)\sd=(["'])([^"']+)\2([^>]*)\/?>/, (match, before, quote, d, after) => {
      const letters = d.split(/(?=M)/).filter((sub: string) => sub.trim().length > 0);

      if (letters.length <= 1) return match;

      return letters.map((sub: string) => `<path${before} d="${sub.trim()}"${after}/>`).join('');
    });
  }

  const svgReady = splitLetterPaths(normalizeSvg(setaraSvg));

  let {
    size = 172,
    ariaLabel = 'Setara',
    animate = true,
    loop = true,
    color = 'accent'
  }: {
    size?: number | string;
    ariaLabel?: string;
    animate?: boolean;
    loop?: boolean;
    color?: LogoColor;
  } = $props();

  let root: HTMLDivElement | undefined = $state(undefined);
  let logoRatio = $state(5.2);

  const cssSize = $derived(typeof size === 'number' ? `${size}px` : size);
  const resolvedColor = $derived(allowedColors.includes(color) ? color : 'accent');

  function prepareSvg(svg: SVGSVGElement) {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  function getBox(node: SVGGraphicsElement): Box | undefined {
    try {
      const box = node.getBBox();

      if (!box || box.width <= 0 || box.height <= 0) {
        return undefined;
      }

      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      };
    } catch {
      return undefined;
    }
  }

  function unionBoxes(boxes: Box[]): Box {
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function getDrawableShapes(svg: SVGSVGElement) {
    return Array.from(
      svg.querySelectorAll<SVGGraphicsElement>(
        'path, rect, circle, ellipse, polygon, polyline, line'
      )
    );
  }

  function getVisibleDrawableShapes(svg: SVGSVGElement) {
    return getDrawableShapes(svg).filter((shape) => shape.style.display !== 'none');
  }

  function keepWordmarkOnly(rootElement: HTMLDivElement) {
    const baseSvg = rootElement.querySelector<SVGSVGElement>('.setara-gsap-logo__base svg');

    if (!baseSvg) return;

    const shapes = getDrawableShapes(baseSvg);
    const indexedBoxes = shapes
      .map((shape, index) => {
        const box = getBox(shape);

        if (!box) return undefined;

        return {
          index,
          box,
          centerY: box.y + box.height / 2
        };
      })
      .filter(Boolean) as Array<{
      index: number;
      box: Box;
      centerY: number;
    }>;

    if (indexedBoxes.length === 0) return;

    const fullBox = unionBoxes(indexedBoxes.map((item) => item.box));

    /**
     * Keeps the upper wordmark cluster and removes lower icon/extra artwork.
     * This is what fixes the excessive bottom padding.
     */
    const wordmarkCutoffY = fullBox.y + fullBox.height * 0.58;

    const keepIndexes = new Set(
      indexedBoxes
        .filter((item) => item.centerY <= wordmarkCutoffY)
        .map((item) => item.index)
    );

    /**
     * Safety fallback.
     * If the source SVG is already only the wordmark, keep all shapes.
     */
    if (keepIndexes.size < Math.max(1, Math.ceil(shapes.length * 0.35))) {
      shapes.forEach((_, index) => keepIndexes.add(index));
    }

    const svgs = Array.from(rootElement.querySelectorAll<SVGSVGElement>('svg'));

    svgs.forEach((svg) => {
      getDrawableShapes(svg).forEach((shape, index) => {
        shape.style.display = keepIndexes.has(index) ? '' : 'none';
      });
    });
  }

  function fitSvgToVisibleWordmark(rootElement: HTMLDivElement) {
    const svgs = Array.from(rootElement.querySelectorAll<SVGSVGElement>('svg'));
    const baseSvg = rootElement.querySelector<SVGSVGElement>('.setara-gsap-logo__base svg');

    if (!baseSvg) return;

    const visibleBoxes = getVisibleDrawableShapes(baseSvg)
      .map(getBox)
      .filter(Boolean) as Box[];

    if (visibleBoxes.length === 0) return;

    const box = unionBoxes(visibleBoxes);

    const padX = 4;
    const padY = 3;

    const fittedX = box.x - padX;
    const fittedY = box.y - padY;
    const fittedWidth = box.width + padX * 2;
    const fittedHeight = box.height + padY * 2;

    const fittedViewBox = `${fittedX} ${fittedY} ${fittedWidth} ${fittedHeight}`;

    svgs.forEach((svg) => {
      svg.setAttribute('viewBox', fittedViewBox);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    });

    logoRatio = fittedWidth / fittedHeight;
  }

  function sortLeftToRight<T extends SVGGraphicsElement>(shapes: T[]) {
    return shapes.sort((a, b) => {
      const boxA = getBox(a);
      const boxB = getBox(b);

      if (!boxA || !boxB) return 0;

      return boxA.x - boxB.x || boxA.y - boxB.y;
    });
  }

  function getGeometryLength(shape: SVGGraphicsElement) {
    const geometry = shape as unknown as SVGGeometryElement;

    if (typeof geometry.getTotalLength !== 'function') {
      return 0;
    }

    try {
      return Math.max(1, Math.ceil(geometry.getTotalLength()));
    } catch {
      return 0;
    }
  }

  function createScribbleLayer(svg: SVGSVGElement) {
    const oldLayer = svg.querySelector('.setara-gsap-logo__scribble-layer');
    oldLayer?.remove();

    const visibleShapes = sortLeftToRight(getVisibleDrawableShapes(svg));

    const visibleBoxes = visibleShapes
      .map(getBox)
      .filter(Boolean) as Box[];

    if (visibleBoxes.length === 0) {
      return [];
    }
    const fullBox = unionBoxes(visibleBoxes);

    /**
     * Keep scribble thin.
     * The source logo is a filled glyph path, so stroking it draws the letter outline.
     * A small capped stroke prevents the outline from looking bold/heavy.
     */
    const strokeWidth = Math.max(0.75, Math.min(1.35, fullBox.height * 0.022));

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'setara-gsap-logo__scribble-layer');
    layer.setAttribute('fill', 'none');
    layer.setAttribute('stroke', 'currentColor');
    layer.setAttribute('stroke-linecap', 'butt');
    layer.setAttribute('stroke-linejoin', 'miter');
    layer.setAttribute('stroke-width', String(strokeWidth));
    layer.setAttribute('vector-effect', 'non-scaling-stroke');
    layer.style.pointerEvents = 'none';

    const scribbleShapes: SVGGraphicsElement[] = [];

    visibleShapes.forEach((shape) => {
      const length = getGeometryLength(shape);

      if (length <= 0) return;

      const clone = shape.cloneNode(true) as SVGGraphicsElement;

      clone.removeAttribute('id');
      clone.removeAttribute('class');
      clone.removeAttribute('style');
      clone.removeAttribute('fill');
      clone.removeAttribute('stroke');
      clone.removeAttribute('stroke-width');
      clone.removeAttribute('filter');
      clone.removeAttribute('clip-path');
      clone.removeAttribute('mask');

      clone.setAttribute('fill', 'none');
      clone.setAttribute('stroke', 'currentColor');
      clone.setAttribute('stroke-width', String(strokeWidth));
      clone.setAttribute('stroke-linecap', 'round');
      clone.setAttribute('stroke-linejoin', 'round');
      clone.setAttribute('vector-effect', 'non-scaling-stroke');

      clone.style.strokeDasharray = `${length}`;
      clone.style.strokeDashoffset = `${length}`;
      clone.style.opacity = '1';

      layer.appendChild(clone);
      scribbleShapes.push(clone);
    });

    svg.appendChild(layer);

    return scribbleShapes;
  }

  function removeScribbleLayer(rootElement: HTMLDivElement) {
    rootElement
      .querySelectorAll('.setara-gsap-logo__scribble-layer')
      .forEach((layer) => layer.remove());
  }

  function afterLayout(callback: () => void) {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  }



  onMount(() => {
    let ctx: gsap.Context | undefined;
    let killed = false;

    tick().then(() => {
      afterLayout(() => {
        if (killed || !root) return;

              keepWordmarkOnly(root);
              fitSvgToVisibleWordmark(root);

              ctx = gsap.context(() => {
                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                const svgs = Array.from(root!.querySelectorAll<SVGSVGElement>('svg'));
                svgs.forEach(prepareSvg);

                const baseSvg = root!.querySelector<SVGSVGElement>('.setara-gsap-logo__base svg');
                const shine = root!.querySelector<HTMLElement>('.setara-gsap-logo__shine');
                const glow = root!.querySelector<HTMLElement>('.setara-gsap-logo__glow');

                if (!baseSvg) return;

                removeScribbleLayer(root!);

                const baseShapes = sortLeftToRight(getVisibleDrawableShapes(baseSvg));
                const scribbleShapes = createScribbleLayer(baseSvg);

                gsap.set(root!, {
                  autoAlpha: 1,
                  filter: 'drop-shadow(0 10px 20px var(--logo-shadow-soft))'
                });

                gsap.set(baseShapes, {
                  autoAlpha: 1,
                  fill: 'none',
                  stroke: 'none',
                  transformOrigin: '50% 50%'
                });

                gsap.set(shine, {
                  autoAlpha: 0,
                  '--shine-x': '-42%'
                } as gsap.TweenVars);

                gsap.set(glow, {
                  autoAlpha: 0,
                  scaleX: 0.2,
                  transformOrigin: '50% 50%'
                });

                if (!animate || reduceMotion || scribbleShapes.length === 0) {
                  gsap.set(baseShapes, {
                    autoAlpha: 1,
                    fillOpacity: 1,
                    scale: 1,
                    x: 0,
                    y: 0
                  });

                  gsap.set([shine, glow], { autoAlpha: 0 });
                  removeScribbleLayer(root!);
                  return;
                }

                /**
                 * Hide the real filled logo first.
                 * The temporary cloned stroke layer is what gets drawn.
                 */
                gsap.set(baseShapes, {
                  autoAlpha: 0,
                  fillOpacity: 0,
                  scale: 0.997,
                  x: -1,
                  y: 1
                });

                gsap.set(scribbleShapes, {
                  autoAlpha: 1,
                  stroke: 'currentColor',
                  fill: 'none'
                });

                const intro = gsap.timeline({
                  defaults: {
                    ease: 'power2.out'
                  }
                });

                intro
                  /**
                   * Scribble / handwriting pass.
                   * This draws cloned strokes from the actual SVG paths.
                   */
                  .to(scribbleShapes, {
                    strokeDashoffset: 0,
                    duration: 0.5,
                    stagger: {
                      each: 0.2,
                      from: 'start'
                    }
                  })

                  /**
                   * Solid logo fill appears after the scribble.
                   */
                  .to(
                    baseShapes,
                    {
                      autoAlpha: 1,
                      fillOpacity: 1,
                      scale: 1,
                      x: 0,
                      y: 0,
                      duration: 0.28,
                      stagger: {
                        each: 0.012,
                        from: 'start'
                      }
                    },
                    '-=0.16'
                  )

                  /**
                   * Remove the temporary scribble layer.
                   */
                  .to(
                    scribbleShapes,
                    {
                      autoAlpha: 0,
                      duration: 0.12
                    },
                    '-=0.06'
                  )

                  .add(() => {
                    removeScribbleLayer(root!);
                  })

                  .to(
                    root!,
                    {
                      filter: 'drop-shadow(0 0 18px var(--logo-shadow-pulse))',
                      duration: 0.24,
                      yoyo: true,
                      repeat: 1
                    },
                    '-=0.1'
                  )

                  .to(
                    glow,
                    {
                      autoAlpha: 0.65,
                      scaleX: 1,
                      duration: 0.42,
                      ease: 'expo.out'
                    },
                    '-=0.28'
                  )

                  .to(glow, { autoAlpha: 0, duration: 0.36 }, '-=0.1')

                  .to(shine, { autoAlpha: 0.9, duration: 0.01 }, '-=0.36')

                  .to(
                    shine,
                    {
                      '--shine-x': '142%',
                      duration: 0.75,
                      ease: 'power2.inOut'
                    } as gsap.TweenVars,
                    '<'
                  )

                  .to(shine, { autoAlpha: 0, duration: 0.12 }, '-=0.08');

                if (loop) {
                  const idle = gsap.timeline({
                    repeat: -1,
                    repeatDelay: 3.4,
                    paused: true
                  });

                  idle
                    .set(shine, { '--shine-x': '-42%' } as gsap.TweenVars)
                    .to(shine, { autoAlpha: 0.78, duration: 0.01 })
                    .to(
                      shine,
                      {
                        '--shine-x': '142%',
                        duration: 1,
                        ease: 'power2.inOut'
                      } as gsap.TweenVars,
                      '<'
                    )
                    .to(
                      root!,
                      {
                        filter: 'drop-shadow(0 0 14px var(--logo-shadow-idle))',
                        duration: 0.3,
                        yoyo: true,
                        repeat: 1
                      },
                      0.14
                    )
                    .to(shine, { autoAlpha: 0, duration: 0.12 }, 0.96);

                  intro.add(() => idle.play(0), '+=0.5');
                }
              }, root!);
      });
    });

    return () => {
      killed = true;
      ctx?.revert();

      if (root) {
        removeScribbleLayer(root);
      }
    };
  });
</script>

<div
  bind:this={root}
  class="setara-gsap-logo"
  data-color={resolvedColor}
  style={`width: ${cssSize}; --logo-ratio: ${logoRatio}; --logo-current: var(--logo-${resolvedColor});`}
  role="img"
  aria-label={ariaLabel}
>
  <span class="setara-gsap-logo__base">
    {@html svgReady}
  </span>

  <span class="setara-gsap-logo__shine" aria-hidden="true">
    {@html svgReady}
  </span>

  <span class="setara-gsap-logo__glow" aria-hidden="true"></span>
</div>

<style>
  .setara-gsap-logo {
    --logo-accent: var(--color-accent, #00afa5);
    --logo-bright: var(--color-accent-mint, #5ef2d6);
    --logo-white: var(--color-text, #ffffff);
    --logo-black: var(--color-surface, #000000);

    --logo-current: var(--logo-accent);
    --logo-ratio: 5.2;

    --logo-shine-fill: #edfffe;

    --logo-shadow-soft: rgba(0, 175, 165, 0.08);
    --logo-shadow-pulse: rgba(94, 242, 214, 0.4);
    --logo-shadow-idle: rgba(94, 242, 214, 0.28);

    --logo-glow-inner: rgba(94, 242, 214, 0.28);
    --logo-glow-outer: rgba(0, 175, 165, 0.1);

    --shine-x: -42%;

    position: relative;
    display: inline-block;
    width: 172px;
    aspect-ratio: var(--logo-ratio);
    color: var(--logo-current);
    isolation: isolate;
    overflow: visible;
    vertical-align: middle;
  }

  .setara-gsap-logo[data-color='bright'] {
    --logo-shine-fill: #ffffff;
    --logo-shadow-soft: rgba(94, 242, 214, 0.1);
    --logo-shadow-pulse: rgba(94, 242, 214, 0.48);
    --logo-shadow-idle: rgba(94, 242, 214, 0.34);
    --logo-glow-inner: rgba(94, 242, 214, 0.38);
    --logo-glow-outer: rgba(94, 242, 214, 0.12);
  }

  .setara-gsap-logo[data-color='white'] {
    --logo-shine-fill: #ffffff;
    --logo-shadow-soft: rgba(255, 255, 255, 0.08);
    --logo-shadow-pulse: rgba(255, 255, 255, 0.36);
    --logo-shadow-idle: rgba(255, 255, 255, 0.24);
    --logo-glow-inner: rgba(255, 255, 255, 0.26);
    --logo-glow-outer: rgba(94, 242, 214, 0.1);
  }

  .setara-gsap-logo[data-color='black'] {
    --logo-shine-fill: #5ef2d6;
    --logo-shadow-soft: rgba(0, 0, 0, 0.08);
    --logo-shadow-pulse: rgba(0, 175, 165, 0.28);
    --logo-shadow-idle: rgba(0, 175, 165, 0.18);
    --logo-glow-inner: rgba(0, 175, 165, 0.16);
    --logo-glow-outer: rgba(0, 0, 0, 0.06);
  }

  .setara-gsap-logo__base,
  .setara-gsap-logo__shine {
    position: absolute;
    inset: 0;
    display: block;
  }

  .setara-gsap-logo__base {
    z-index: 1;
  }

  .setara-gsap-logo__shine {
    z-index: 2;
    opacity: 0;
    filter: blur(0.2px);
    clip-path: polygon(
      calc(var(--shine-x) - 12%) 0%,
      calc(var(--shine-x) + 7%) 0%,
      calc(var(--shine-x) + 18%) 100%,
      calc(var(--shine-x) - 1%) 100%
    );
    pointer-events: none;
  }

  .setara-gsap-logo__base :global(svg),
  .setara-gsap-logo__shine :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .setara-gsap-logo__base :global(path),
  .setara-gsap-logo__base :global(rect),
  .setara-gsap-logo__base :global(circle),
  .setara-gsap-logo__base :global(ellipse),
  .setara-gsap-logo__base :global(polygon),
  .setara-gsap-logo__base :global(polyline) {
    fill: currentColor !important;
    stroke: none !important;
  }

  /**
   * The scribble layer is a set of cloned paths appended INSIDE the same
   * base <svg>, so the blanket fill/stroke rule above would otherwise force
   * them filled and strokeless too, hiding the handwriting draw entirely.
   * Higher specificity here wins it back.
   */
  .setara-gsap-logo__base :global(.setara-gsap-logo__scribble-layer path) {
    fill: none !important;
    stroke: currentColor !important;
  }

  .setara-gsap-logo__shine :global(path),
  .setara-gsap-logo__shine :global(rect),
  .setara-gsap-logo__shine :global(circle),
  .setara-gsap-logo__shine :global(ellipse),
  .setara-gsap-logo__shine :global(polygon),
  .setara-gsap-logo__shine :global(polyline) {
    fill: var(--logo-shine-fill) !important;
    stroke: none !important;
  }

  .setara-gsap-logo__glow {
    position: absolute;
    left: 8%;
    right: 8%;
    bottom: -8%;
    height: 44%;
    z-index: 0;
    opacity: 0;
    pointer-events: none;
    border-radius: 999px;
    background: radial-gradient(
      ellipse at center,
      var(--logo-glow-inner),
      var(--logo-glow-outer) 44%,
      transparent 72%
    );
    filter: blur(12px);
  }
</style>
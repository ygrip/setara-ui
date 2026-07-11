<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import SetaraGsapLogo from './SetaraGsapLogo.svelte';
  import SetaraLoader from './SetaraLoader.svelte';

  import mountainSvg from '$lib/assets/mountain.svg?raw';
  import daySkySource from '$lib/assets/sky_day.svg?raw';
  import nightSkySource from '$lib/assets/sky_night.svg?raw';
  import sunSource from '$lib/assets/sun.svg?raw';
  import moonSource from '$lib/assets/moon.svg?raw';

  import cloudBig from '$lib/assets/cloud_big.svg?url';
  import cloudMedium from '$lib/assets/cloud_medium.svg?url';
  import cloudSmall from '$lib/assets/cloud_small.svg?url';

  type ThemeMode = 'light' | 'dark';
  type SkyTransitionPhase = 'idle' | 'priming' | 'running' | 'finishing';

  type Point = {
    x: number;
    y: number;
  };

  type CloudAsset = {
    className: string;
    url: string;
  };

  const BEE_IDLE_MS = 1_200;
  const BEE_FOLLOW_STIFFNESS = 0.16;
  const BEE_RETURN_STIFFNESS = 0.016;
  const BEE_FOLLOW_DAMPING = 0.78;
  const BEE_RETURN_DAMPING = 0.88;
  const BEE_ANGLE_EASE = 0.14;
  const BEE_MAX_SPEED = 36;
  const BEE_TRAIL_LENGTH = 16;
  const SKY_TRANSITION_MS = 640;

  const DISPLACEMENT_TEXTURE =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
        <rect width="256" height="256" fill="#737373"/>
        <polygon fill="#efefef" points="0,0 92,0 44,104 0,142"/>
        <polygon fill="#282828" points="92,0 196,0 148,118 44,104"/>
        <polygon fill="#bdbdbd" points="196,0 256,0 256,88 148,118"/>
        <polygon fill="#4a4a4a" points="0,142 44,104 112,178 0,256"/>
        <polygon fill="#dedede" points="44,104 148,118 112,178"/>
        <polygon fill="#1d1d1d" points="148,118 256,88 256,202 184,178"/>
        <polygon fill="#999999" points="112,178 184,178 256,256 0,256"/>
        <polygon fill="#f8f8f8" points="184,178 256,202 256,256"/>
      </svg>
    `);


  const daySkyMarkup = prepareSkySvg(daySkySource);
  const nightSkyMarkup = prepareSkySvg(nightSkySource);

  // CurtainsJS must rasterize SVG textures. Give the temporary transition
  // a deliberately large source, while the resting sky remains real SVG.
  const daySkyTextureUrl = createSkyTextureUrl(daySkySource, 3200, 1800);
  const nightSkyTextureUrl = createSkyTextureUrl(nightSkySource, 3200, 1800);

  const CAROUSEL_ITEMS = [
    {
      label: 'End-to-end test coverage',
      sub: 'From scenario design to automated execution, fully tracked.',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`
    },
    {
      label: 'Automated release gates',
      sub: 'Block bad builds automatically before they reach production.',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    },
    {
      label: 'Squad-level quality insights',
      sub: 'Health, coverage, and pass rates aligned across every team.',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
    }
  ] as const;

  const CLOUDS: CloudAsset[] = [
    {
      className: 'hero-cloud hero-cloud--main',
      url: cloudBig
    },
    {
      className: 'hero-cloud hero-cloud--left',
      url: cloudMedium
    },
    {
      className: 'hero-cloud hero-cloud--lower',
      url: cloudSmall
    }
  ];

  let carouselIdx = $state(0);
  let activeTheme = $state<ThemeMode>('light');
  // The sky's static (crisp) layer only flips to the new theme once the WebGL
  // curtain has actually revealed it — decoupled from activeTheme so the
  // sharp SVG layer never pops ahead of (or behind) the wipe.
  let displayedTheme = $state<ThemeMode>('light');
  let skyTransitioning = $state(false);

  let heroEl: HTMLElement | undefined = $state();
  let brandEl: HTMLElement | undefined = $state();
  let brandNameEl: HTMLElement | undefined = $state();
  let beeEl: HTMLDivElement | undefined = $state();
  let beeTrailEl: SVGPolylineElement | undefined = $state();
  let skyCanvasEl: HTMLDivElement | undefined = $state();
  let skyPlaneEl: HTMLDivElement | undefined = $state();

  let beeHome: Point = $state({ x: 40, y: 40 });
  let beeTargetPoint: Point = { x: 0, y: 0 };
  let beeCurrentPoint: Point = { x: 0, y: 0 };
  let beeVelocity: Point = { x: 0, y: 0 };
  let beeTrail: Point[] = [];
  let lastBeeAngle = 0;
  let beeReturning = false;
  let beeVisible = false;
  let beeIdleTimer: number | undefined;
  let beeRaf = 0;
  let lastBeeFrameTime = 0;

  let curtains: any;
  let skyPlane: any;
  let curtainsReady = false;
  let skyTransitionPhase: SkyTransitionPhase = 'idle';
  let currentTextureIndex = 1;
  let requestedTextureIndex = 1;
  let transitionTextureIndex = 1;
  let transitionProgress = 0;
  let transitionStartedAt = 0;
  let transitionToken = 0;
  let reducedMotionQuery: MediaQueryList | undefined;

  const VERTEX_SHADER = `
    precision mediump float;

    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;
    uniform mat4 activeTexMatrix;
    uniform mat4 nextTexMatrix;

    varying vec2 vTextureCoord;
    varying vec2 vActiveTextureCoord;
    varying vec2 vNextTextureCoord;

    void main() {
      gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
      vTextureCoord = aTextureCoord;
      vActiveTextureCoord = (activeTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
      vNextTextureCoord = (nextTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;

    varying vec2 vTextureCoord;
    varying vec2 vActiveTextureCoord;
    varying vec2 vNextTextureCoord;

    uniform float uTransitionProgress;
    uniform float uFromNight;
    uniform float uToNight;
    uniform sampler2D dayTex;
    uniform sampler2D nightTex;
    uniform sampler2D displacement;

    void main() {
      // Quintic "smootherstep" — silkier accel/decel than cubic smoothstep, no first/second
      // derivative discontinuity at the edges, so the wipe never appears to snap in or out.
      float t = clamp(uTransitionProgress, 0.0, 1.0);
      float blend = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      float warp = sin(blend * 3.14159265);

      vec4 displacementSample = texture2D(displacement, vTextureCoord);
      float displacementValue = displacementSample.r - 0.5;

      vec2 fromCoords = vActiveTextureCoord;
      vec2 toCoords = vNextTextureCoord;

      fromCoords.x += displacementValue * warp * 0.045;
      fromCoords.y += displacementValue * warp * 0.24;

      toCoords.x -= displacementValue * warp * 0.045;
      toCoords.y -= displacementValue * warp * 0.24;

      fromCoords = clamp(fromCoords, vec2(0.001), vec2(0.999));
      toCoords = clamp(toCoords, vec2(0.001), vec2(0.999));

      vec4 dayFromColor = texture2D(dayTex, fromCoords);
      vec4 nightFromColor = texture2D(nightTex, fromCoords);
      vec4 dayToColor = texture2D(dayTex, toCoords);
      vec4 nightToColor = texture2D(nightTex, toCoords);

      vec4 fromColor = mix(dayFromColor, nightFromColor, uFromNight);
      vec4 toColor = mix(dayToColor, nightToColor, uToNight);
      vec4 finalColor = mix(fromColor, toColor, blend);

      gl_FragColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);
    }
  `;

  onMount(() => {
    const root = document.documentElement;
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resolveTheme = (): ThemeMode => {
      const explicitTheme = root.dataset.theme;

      if (explicitTheme === 'dark' || explicitTheme === 'light') {
        return explicitTheme;
      }

      return colorScheme.matches ? 'dark' : 'light';
    };

    const syncTheme = () => {
      const nextTheme = resolveTheme();

      if (nextTheme === activeTheme) return;

      activeTheme = nextTheme;
      requestSkyTransition(nextTheme);
    };

    activeTheme = resolveTheme();
    displayedTheme = activeTheme;
    requestedTextureIndex = themeTextureIndex(activeTheme);
    currentTextureIndex = requestedTextureIndex;

    const themeObserver = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'attributes' &&
            mutation.attributeName === 'data-theme'
        )
      ) {
        syncTheme();
      }
    });

    themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    colorScheme.addEventListener('change', syncTheme);

    const carouselTimer = window.setInterval(() => {
      carouselIdx = (carouselIdx + 1) % CAROUSEL_ITEMS.length;
    }, 3_400);

    measureBeeHome();

    const resizeObserver = new ResizeObserver(() => {
      measureBeeHome();
      curtains?.resize?.();
    });

    if (heroEl) resizeObserver.observe(heroEl);
    if (brandEl) resizeObserver.observe(brandEl);
    if (brandNameEl) resizeObserver.observe(brandNameEl);

    const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;

    if (heroEl && supportsFinePointer && !reducedMotionQuery.matches) {
      heroEl.addEventListener('pointermove', handleBeePointerMove);
      heroEl.addEventListener('pointerleave', returnBeeHome);
    }

    void initialiseCurtains();

    return () => {
      window.clearInterval(carouselTimer);
      themeObserver.disconnect();
      colorScheme.removeEventListener('change', syncTheme);
      resizeObserver.disconnect();

      if (heroEl && supportsFinePointer) {
        heroEl.removeEventListener('pointermove', handleBeePointerMove);
        heroEl.removeEventListener('pointerleave', returnBeeHome);
      }

      if (beeIdleTimer) window.clearTimeout(beeIdleTimer);
      if (beeRaf) window.cancelAnimationFrame(beeRaf);

      transitionToken += 1;
      skyTransitionPhase = 'idle';
      skyTransitioning = false;
      skyPlane?.remove?.();
      curtains?.dispose?.();
    };
  });

  async function initialiseCurtains() {
    if (!skyCanvasEl || !skyPlaneEl) return;

    try {
      // svelte-check doesn't resolve the ambient module shim (src/app.d.ts) for dynamic imports.
      // @ts-ignore
      const { Curtains, Plane } = await import('curtainsjs');

      curtains = new Curtains({
        container: skyCanvasEl,
        watchScroll: false,
        pixelRatio: Math.min(2, window.devicePixelRatio)
      });

      curtains
        .onError(() => {
          transitionToken += 1;
          curtainsReady = false;
          skyTransitionPhase = 'idle';
          skyTransitioning = false;
          displayedTheme = activeTheme;
        })
        .onContextLost(() => {
          curtains.restoreContext();
        });

      curtains.disableDrawing();

      skyPlane = new Plane(curtains, skyPlaneEl, {
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          transitionProgress: {
            name: 'uTransitionProgress',
            type: '1f',
            value: 0
          },
          fromNight: {
            name: 'uFromNight',
            type: '1f',
            value: currentTextureIndex === 2 ? 1 : 0
          },
          toNight: {
            name: 'uToNight',
            type: '1f',
            value: currentTextureIndex === 2 ? 1 : 0
          }
        }
      });

      skyPlane
        .onLoading((texture: any) => {
          texture.setMinFilter(curtains.gl.LINEAR);
          texture.setMagFilter(curtains.gl.LINEAR);
        })
        .onReady(() => {
          curtainsReady = true;

          if (requestedTextureIndex !== currentTextureIndex) {
            void beginSkyTransition();
          }
        })
        .onRender(() => {
          if (skyTransitionPhase !== 'running') return;

          transitionProgress = Math.min(
            (performance.now() - transitionStartedAt) / SKY_TRANSITION_MS,
            1
          );

          skyPlane.uniforms.transitionProgress.value = transitionProgress;

          if (transitionProgress >= 1) {
            skyTransitionPhase = 'finishing';
            void finishSkyTransition(transitionToken);
          }
        });
    } catch {
      transitionToken += 1;
      curtainsReady = false;
      skyTransitionPhase = 'idle';
      skyTransitioning = false;
      displayedTheme = activeTheme;
    }
  }

  function requestSkyTransition(theme: ThemeMode) {
    requestedTextureIndex = themeTextureIndex(theme);

    if (!curtainsReady) {
      displayedTheme = theme;
      currentTextureIndex = requestedTextureIndex;
      return;
    }

    if (skyTransitionPhase !== 'idle') return;
    if (requestedTextureIndex === currentTextureIndex) return;

    void beginSkyTransition();
  }

  async function beginSkyTransition() {
    if (!skyPlane || !curtains || skyTransitionPhase !== 'idle') return;
    if (requestedTextureIndex === currentTextureIndex) return;

    if (reducedMotionQuery?.matches) {
      currentTextureIndex = requestedTextureIndex;
      transitionTextureIndex = currentTextureIndex;
      displayedTheme = textureIndexTheme(currentTextureIndex);
      transitionProgress = 0;
      transitionStartedAt = 0;
      skyTransitioning = false;

      const nightValue = currentTextureIndex === 2 ? 1 : 0;
      skyPlane.uniforms.transitionProgress.value = 0;
      skyPlane.uniforms.fromNight.value = nightValue;
      skyPlane.uniforms.toNight.value = nightValue;

      curtains.disableDrawing();
      return;
    }

    const token = ++transitionToken;

    transitionTextureIndex = requestedTextureIndex;
    transitionProgress = 0;
    transitionStartedAt = 0;
    skyTransitionPhase = 'priming';
    skyTransitioning = false;

    skyPlane.uniforms.transitionProgress.value = 0;
    skyPlane.uniforms.fromNight.value =
      currentTextureIndex === 2 ? 1 : 0;
    skyPlane.uniforms.toNight.value =
      transitionTextureIndex === 2 ? 1 : 0;

    // Render the old sky into the hidden WebGL canvas first. Revealing an
    // unprimed canvas is what caused the stale-frame flash.
    curtains.enableDrawing();

    await nextAnimationFrame();
    await nextAnimationFrame();

    if (
      token !== transitionToken ||
      skyTransitionPhase !== 'priming'
    ) {
      return;
    }

    // CurtainsJS now owns the complete visible transition. The canvas is
    // shown at full opacity while progress is still exactly zero.
    skyTransitioning = true;
    await tick();
    await nextAnimationFrame();

    if (
      token !== transitionToken ||
      skyTransitionPhase !== 'priming'
    ) {
      return;
    }

    transitionStartedAt = performance.now();
    skyTransitionPhase = 'running';
  }

  async function finishSkyTransition(token: number) {
    if (
      token !== transitionToken ||
      skyTransitionPhase !== 'finishing'
    ) {
      return;
    }

    skyPlane.uniforms.transitionProgress.value = 1;

    currentTextureIndex = transitionTextureIndex;
    displayedTheme = textureIndexTheme(currentTextureIndex);

    // Paint the sharp target SVG below the final CurtainsJS frame.
    await tick();
    await nextAnimationFrame();
    await nextAnimationFrame();

    if (
      token !== transitionToken ||
      skyTransitionPhase !== 'finishing'
    ) {
      return;
    }

    // No CSS crossfade here. At this point the canvas and inline SVG show
    // the exact same target sky, so removing the canvas is visually inert.
    skyTransitioning = false;
    await tick();
    await nextAnimationFrame();

    if (
      token !== transitionToken ||
      skyTransitionPhase !== 'finishing'
    ) {
      return;
    }

    const currentNightValue = currentTextureIndex === 2 ? 1 : 0;

    skyPlane.uniforms.transitionProgress.value = 0;
    skyPlane.uniforms.fromNight.value = currentNightValue;
    skyPlane.uniforms.toNight.value = currentNightValue;

    transitionProgress = 0;
    transitionStartedAt = 0;
    skyTransitionPhase = 'idle';
    curtains.disableDrawing();

    // A fast second toggle is queued instead of corrupting the current
    // transition or swapping a texture source halfway through a frame.
    if (requestedTextureIndex !== currentTextureIndex) {
      void beginSkyTransition();
    }
  }

  function nextAnimationFrame() {
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function themeTextureIndex(theme: ThemeMode) {
    return theme === 'dark' ? 2 : 1;
  }

  function textureIndexTheme(index: number): ThemeMode {
    return index === 2 ? 'dark' : 'light';
  }

  function prepareSkySvg(source: string, width?: number, height?: number) {
    return source.replace(/<svg\b([^>]*)>/, (_match, attributes: string) => {
      const cleanedAttributes = attributes
        .replace(/\swidth=(["']).*?\1/g, '')
        .replace(/\sheight=(["']).*?\1/g, '')
        .replace(/\spreserveAspectRatio=(["']).*?\1/g, '');

      const dimensions =
        width && height ? ` width="${width}" height="${height}"` : '';

      return `<svg${cleanedAttributes}${dimensions} preserveAspectRatio="xMidYMid slice">`;
    });
  }

  function createSkyTextureUrl(source: string, width: number, height: number) {
    const rasterSource = prepareSkySvg(source, width, height);

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rasterSource)}`;
  }

  function measureBeeHome() {
    if (!heroEl) return;

    const heroRect = heroEl.getBoundingClientRect();
    const targetRect = (brandNameEl ?? brandEl)?.getBoundingClientRect();
    if (!targetRect) return;

    beeHome = {
      x: targetRect.left - heroRect.left + targetRect.width * 0.5,
      y: targetRect.top - heroRect.top + targetRect.height * 0.5
    };
  }

  function handleBeePointerMove(event: PointerEvent) {
    if (!heroEl || !beeEl) return;

    const rect = heroEl.getBoundingClientRect();

    beeTargetPoint = clampBeePoint(
      {
        x: event.clientX - rect.left - beeHome.x,
        y: event.clientY - rect.top - beeHome.y
      },
      rect
    );

    beeReturning = false;
    beeVisible = true;

    if (beeIdleTimer) window.clearTimeout(beeIdleTimer);
    beeIdleTimer = window.setTimeout(returnBeeHome, BEE_IDLE_MS);

    startBeeAnimation();
  }

  function returnBeeHome() {
    if (!beeEl) return;

    if (beeIdleTimer) window.clearTimeout(beeIdleTimer);

    beeReturning = true;
    beeVisible = true;
    beeTargetPoint = { x: 0, y: 0 };

    startBeeAnimation();
  }

  function startBeeAnimation() {
    if (beeRaf) return;
    lastBeeFrameTime = 0;
    beeRaf = window.requestAnimationFrame(animateBee);
  }

  function animateBee(timestamp: number) {
    beeRaf = 0;

    if (!beeEl) return;

    const dt = lastBeeFrameTime ? timestamp - lastBeeFrameTime : 16.667;
    lastBeeFrameTime = timestamp;
    const dtScale = clamp(dt / 16.667, 0.25, 3);

    const target = beeReturning ? { x: 0, y: 0 } : beeTargetPoint;
    const stiffness = beeReturning ? BEE_RETURN_STIFFNESS : BEE_FOLLOW_STIFFNESS;
    const damping = beeReturning ? BEE_RETURN_DAMPING : BEE_FOLLOW_DAMPING;

    beeVelocity.x += (target.x - beeCurrentPoint.x) * stiffness * dtScale;
    beeVelocity.y += (target.y - beeCurrentPoint.y) * stiffness * dtScale;
    beeVelocity.x *= Math.pow(damping, dtScale);
    beeVelocity.y *= Math.pow(damping, dtScale);

    const speed = Math.hypot(beeVelocity.x, beeVelocity.y);

    if (speed > BEE_MAX_SPEED) {
      const ratio = BEE_MAX_SPEED / speed;
      beeVelocity.x *= ratio;
      beeVelocity.y *= ratio;
    }

    beeCurrentPoint.x += beeVelocity.x * dtScale;
    beeCurrentPoint.y += beeVelocity.y * dtScale;

    const adjustedSpeed = Math.hypot(beeVelocity.x, beeVelocity.y);

    if (adjustedSpeed > 0.06) {
      const nextAngle = Math.atan2(beeVelocity.y, beeVelocity.x) * (180 / Math.PI);
      lastBeeAngle = lerpAngle(lastBeeAngle, nextAngle, BEE_ANGLE_EASE * dtScale);
    }

    const distanceToTarget = Math.hypot(
      target.x - beeCurrentPoint.x,
      target.y - beeCurrentPoint.y
    );

    const absolutePoint = {
      x: beeHome.x + beeCurrentPoint.x,
      y: beeHome.y + beeCurrentPoint.y
    };

    beeTrail.push(absolutePoint);

    if (beeTrail.length > BEE_TRAIL_LENGTH) {
      beeTrail.shift();
    }

    beeTrailEl?.setAttribute(
      'points',
      beeTrail.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')
    );

    if (beeTrailEl) {
      beeTrailEl.style.opacity = `${Math.min(0.72, adjustedSpeed / 13)}`;
    }

    beeEl.style.setProperty('--bee-x', `${round(beeCurrentPoint.x)}px`);
    beeEl.style.setProperty('--bee-y', `${round(beeCurrentPoint.y)}px`);
    beeEl.style.setProperty('--bee-r', `${round(lastBeeAngle)}deg`);
    beeEl.style.setProperty('--bee-scale', `${round(1 + Math.min(adjustedSpeed / 100, 0.12), 3)}`);
    beeEl.style.setProperty('--bee-opacity', beeVisible ? '1' : '0');

    if (
      beeReturning &&
      distanceToTarget < 1.2 &&
      adjustedSpeed < 0.12
    ) {
      beeCurrentPoint = { x: 0, y: 0 };
      beeTargetPoint = { x: 0, y: 0 };
      beeVelocity = { x: 0, y: 0 };
      beeVisible = false;
      beeReturning = false;
      beeTrail = [];

      beeEl.style.setProperty('--bee-x', '0px');
      beeEl.style.setProperty('--bee-y', '0px');
      beeEl.style.setProperty('--bee-opacity', '0');

      if (beeTrailEl) {
        beeTrailEl.setAttribute('points', '');
        beeTrailEl.style.opacity = '0';
      }

      return;
    }

    if (beeVisible || distanceToTarget > 0.8 || adjustedSpeed > 0.08) {
      beeRaf = window.requestAnimationFrame(animateBee);
    }
  }

  function clampBeePoint(point: Point, rect: DOMRect): Point {
    const padding = 32;

    return {
      x: clamp(point.x, -beeHome.x + padding, rect.width - beeHome.x - padding),
      y: clamp(point.y, -beeHome.y + padding, rect.height - beeHome.y - padding)
    };
  }

  function lerpAngle(from: number, to: number, amount: number) {
    const delta = ((((to - from) % 360) + 540) % 360) - 180;
    return from + delta * amount;
  }

  function round(value: number, precision = 1) {
    const multiplier = 10 ** precision;
    return Math.round(value * multiplier) / multiplier;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
</script>

<section
  class="login-hero"
  class:theme-dark={activeTheme === 'dark'}
  aria-labelledby="login-heading"
  bind:this={heroEl}
>
  <div
    class="polygon-hero-bg"
    class:sky-transitioning={skyTransitioning}
    class:scene-dark={activeTheme === 'dark'}
    aria-hidden="true"
  >
    <div class="sky-static">
      <div
        class="sky-static-layer"
        class:sky-static-layer--active={displayedTheme === 'light'}
      >
        {@html daySkyMarkup}
      </div>
      <div
        class="sky-static-layer"
        class:sky-static-layer--active={displayedTheme === 'dark'}
      >
        {@html nightSkyMarkup}
      </div>
    </div>

    <div class="sky-curtains-canvas" bind:this={skyCanvasEl}></div>

    <div class="sky-plane" bind:this={skyPlaneEl}>
      <img data-sampler="displacement" src={DISPLACEMENT_TEXTURE} alt="" crossorigin="anonymous" />
      <img data-sampler="dayTex" src={daySkyTextureUrl} alt="" />
      <img data-sampler="nightTex" src={nightSkyTextureUrl} alt="" />
    </div>

    <div class="celestial-field">
      <div class="celestial celestial--sun" aria-hidden="true">
        {@html sunSource}
      </div>
      <div class="celestial celestial--moon" aria-hidden="true">
        {@html moonSource}
      </div>
    </div>

    <div class="cloud-layer">
      {#each CLOUDS as cloud}
        <div class={cloud.className}>
          <img
            class="cloud-image cloud-image--day"
            class:cloud-image--active={activeTheme === 'light'}
            src={cloud.url}
            alt=""
          />
          <img
            class="cloud-image cloud-image--night"
            class:cloud-image--active={activeTheme === 'dark'}
            src={cloud.url}
            alt=""
          />
        </div>
      {/each}
    </div>

    <svg class="bee-trail" viewBox="0 0 1600 900" preserveAspectRatio="none">
      <polyline bind:this={beeTrailEl} points="" />
    </svg>

    <div
      class="bee-home"
      bind:this={beeEl}
      style={`--bee-home-x: ${beeHome.x}px; --bee-home-y: ${beeHome.y}px;`}
    >
      <svg class="bee-poly" viewBox="0 0 72 50" aria-hidden="true">
        <polygon class="bee-wing bee-wing--top" points="26,20 18,5 31,1 39,16" />
        <polygon class="bee-wing bee-wing--bottom" points="28,28 17,41 32,46 40,31" />
        <polygon class="bee-tail" points="11,25 22,18 22,32" />
        <polygon class="bee-body bee-body--rear" points="20,17 34,13 42,19 40,32 27,36 18,29" />
        <polygon class="bee-body bee-body--middle" points="34,13 49,14 55,23 48,34 40,32 42,19" />
        <polygon class="bee-body bee-body--front" points="49,14 62,19 66,27 57,35 48,34 55,23" />
        <polygon class="bee-stripe bee-stripe--1" points="30,14 36,13 43,19 40,32 34,34 37,20" />
        <polygon class="bee-stripe bee-stripe--2" points="47,14 52,15 58,22 52,33 47,34 53,23" />
        <polygon class="bee-highlight" points="25,18 33,15 37,19 28,23" />
        <circle class="bee-eye" cx="59" cy="23" r="2.2" />
        <path class="bee-antenna" d="M58 19 Q62 12 67 14" />
        <path class="bee-antenna" d="M61 20 Q68 17 69 21" />
      </svg>
    </div>

    <div class="mountain-scape">
      {@html mountainSvg}
    </div>
  </div>

  <div class="hero-brand" aria-label="Setara" bind:this={brandEl}>
    <SetaraLoader
      mode="orbit"
      size={50}
      color="white"
    />
    <span class="hero-brand-name" bind:this={brandNameEl}>
      <SetaraGsapLogo
        size={170}
        color="white"
      />
    </span>
  </div>

  <div class="hero-copy">
    <h1 id="login-heading">
      Built for <strong>teams</strong><br />that care.
    </h1>
    <p>
      Track test scenarios, measure coverage, and automate release gates. One workspace for your
      whole squad.
    </p>
  </div>

  <div class="capability-carousel" aria-label="Platform features">
    <div class="carousel-track">
      {#key carouselIdx}
        <div
          class="capability-card"
          in:fly={{ y: 22, opacity: 0, duration: 420 }}
          out:fly={{ y: -22, opacity: 0, duration: 260 }}
        >
          <span class="capability-icon">{@html CAROUSEL_ITEMS[carouselIdx].icon}</span>
          <span class="capability-copy">
            <span class="capability-label">{CAROUSEL_ITEMS[carouselIdx].label}</span>
            <span class="capability-sub">{CAROUSEL_ITEMS[carouselIdx].sub}</span>
          </span>
        </div>
      {/key}
    </div>

    <div class="carousel-dots">
      {#each CAROUSEL_ITEMS as item, index}
        <button
          type="button"
          class="carousel-dot"
          class:carousel-dot--active={index === carouselIdx}
          aria-label={`Show ${item.label}`}
          aria-current={index === carouselIdx ? 'true' : undefined}
          onclick={() => (carouselIdx = index)}
        ></button>
      {/each}
    </div>
  </div>
</section>

<style>
  .login-hero {
    --hero-copy-ink: #073844;
    --hero-copy-muted: #235866;
    --hero-copy-shadow:
      0 1px 0 rgba(255, 255, 255, 0.38),
      0 8px 26px rgba(15, 89, 96, 0.12);
    --hero-accent: #006f68;
    --hero-accent-shadow: 0 0 20px rgba(34, 201, 183, 0.18);

    --hero-card-bg: rgba(239, 255, 251, 0.72);
    --hero-card-border: rgba(5, 92, 100, 0.14);
    --hero-card-color: #073844;
    --hero-card-muted: rgba(7, 56, 68, 0.76);
    --hero-dot-bg: rgba(7, 56, 68, 0.26);
    --hero-dot-active: #087f77;

    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(22px, 3.5vw, 38px);
    padding: clamp(32px, 6vw, 80px);
    isolation: isolate;
    overflow: hidden;
    background: #0b4f59;
  }

  .login-hero.theme-dark {
    --hero-copy-ink: #f3fffc;
    --hero-copy-muted: rgba(229, 255, 249, 0.82);
    --hero-copy-shadow:
      0 1px 1px rgba(0, 0, 0, 0.62),
      0 10px 24px rgba(0, 0, 0, 0.46);
    --hero-accent: #79f0d9;
    --hero-accent-shadow: 0 0 22px rgba(121, 240, 217, 0.34);

    --hero-card-bg: rgba(7, 31, 42, 0.56);
    --hero-card-border: rgba(202, 255, 245, 0.18);
    --hero-card-color: #f4fffc;
    --hero-card-muted: rgba(228, 255, 249, 0.74);
    --hero-dot-bg: rgba(220, 255, 248, 0.26);
    --hero-dot-active: #7df2dc;

    background: #061923;
  }

  .polygon-hero-bg {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: #0b4f59;
  }

  .sky-static,
  .sky-curtains-canvas,
  .sky-plane {
    position: absolute;
    inset: 0;
  }

  /*
    The resting sky is always genuine inline SVG. It never passes through
    a canvas, so its polygon edges stay vector-sharp at every DPR and size.
  */
  .sky-static {
    z-index: 0;
  }

  .sky-static-layer {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    transition: none;
  }

  .sky-static-layer--active {
    opacity: 1;
    visibility: visible;
  }

  .sky-static-layer :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    shape-rendering: geometricPrecision;
    text-rendering: geometricPrecision;
  }

  /*
    CurtainsJS is only a temporary transition surface. Once the transition
    finishes, this layer is hidden and the sharp inline SVG remains visible.
  */
  .sky-curtains-canvas {
    z-index: 1;
    opacity: 1;
    visibility: hidden;
    pointer-events: none;
    transition: none;
  }

  .sky-transitioning .sky-curtains-canvas {
    visibility: visible;
  }

  .sky-curtains-canvas :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sky-plane {
    z-index: -1;
    width: 100%;
    height: 100%;
    visibility: hidden;
  }

  .sky-plane img {
    display: none;
  }

  .celestial-field {
    position: absolute;
    inset: 0;
    z-index: 2;
  }

  .celestial {
    position: absolute;
    right: clamp(150px, 22vw, 340px);
    top: clamp(24px, 7vh, 78px);
    width: clamp(76px, 8vw, 118px);
    overflow: visible;
    transform-origin: 50% 50%;
    filter: drop-shadow(0 10px 24px rgba(23, 110, 104, 0.2));
    transition:
      opacity 0.4s ease,
      transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .celestial--sun {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }

  .celestial :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }

  .celestial--sun :global(.sun-svg) {
    animation: sun-idle 70s linear infinite;
    transform-origin: 50% 50%;
  }

  .celestial--moon :global(.moon-svg) {
    animation: moon-idle 110s linear infinite reverse;
    transform-origin: 50% 50%;
  }

  @keyframes sun-idle {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes moon-idle {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .celestial--moon {
    opacity: 0;
    transform: translate3d(110px, 70px, 0) rotate(-24deg) scale(0.58);
    filter: drop-shadow(0 0 20px rgba(178, 237, 236, 0.22));
  }

  .scene-dark .celestial--sun {
    opacity: 0;
    transform: translate3d(124px, 78px, 0) rotate(38deg) scale(0.54);
  }

  .scene-dark .celestial--moon {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }

  .cloud-layer {
    position: absolute;
    inset: 0;
    z-index: 3;
  }

  .hero-cloud {
    position: absolute;
    transform-origin: center;
    transition: opacity 0.65s ease;
    animation: cloud-drift 38s ease-in-out infinite alternate;
  }

  .hero-cloud--left {
    animation-name: cloud-drift-flipped;
    animation-duration: 44s;
    animation-delay: -14s;
  }

  .hero-cloud--lower {
    animation-duration: 32s;
    animation-delay: -22s;
  }

  @keyframes cloud-drift {
    0% {
      transform: translate3d(3%, 0, 0);
    }
    100% {
      transform: translate3d(-3%, 0.8%, 0);
    }
  }

  @keyframes cloud-drift-flipped {
    0% {
      transform: scaleX(-1) rotate(-3deg) translate3d(3%, 0, 0);
    }
    100% {
      transform: scaleX(-1) rotate(-3deg) translate3d(-3%, 0.8%, 0);
    }
  }

  .cloud-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: auto;
    opacity: 0;
    transition: opacity 0.72s ease;
  }

  .cloud-image--active {
    opacity: 1;
  }

  .hero-cloud--main {
    right: -24%;
    top: -8%;
    width: min(70vw, 920px);
    aspect-ratio: 16 / 9;
    opacity: 0.92;
  }

  .hero-cloud--left {
    left: -17%;
    top: 25%;
    width: min(44vw, 600px);
    aspect-ratio: 16 / 9;
    opacity: 0.8;
    transform: scaleX(-1) rotate(-3deg);
  }

  .hero-cloud--lower {
    right: 20%;
    bottom: 5%;
    width: min(33vw, 450px);
    aspect-ratio: 16 / 9;
    opacity: 0.6;
  }

  .theme-dark .hero-cloud--main {
    opacity: 0.8;
  }

  .theme-dark .hero-cloud--left {
    opacity: 0.6;
  }

  .theme-dark .hero-cloud--lower {
    opacity: 0.4;
  }

  .mountain-scape {
    --mountain-snow: #effffd;
    --mountain-snow-soft: #c5f4ed;
    --mountain-snow-shadow: #9edfd8;

    position: absolute;
    left: -3%;
    right: -3%;
    bottom: -1px;
    z-index: 4;
    height: clamp(260px, 48%, 520px);
    pointer-events: none;
  }

  .mountain-scape :global(svg),
  .mountain-scape :global(.mountain-scape-svg) {
    display: block;
    width: 110%;
    height: 100%;
    overflow: visible;
  }

  .theme-dark .mountain-scape {
    --mountain-snow: #7eafb4;
    --mountain-snow-soft: #568993;
    --mountain-snow-shadow: #315f6c;
    opacity: 0.86;
  }

  .bee-trail {
    position: absolute;
    inset: 0;
    z-index: 5;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .bee-trail polyline {
    fill: none;
    stroke: rgba(101, 238, 210, 0.72);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1 10;
    opacity: 0;
    filter: drop-shadow(0 0 5px rgba(91, 239, 211, 0.46));
    transition: opacity 0.2s ease;
  }

  .bee-home {
    --bee-x: 0px;
    --bee-y: 0px;
    --bee-r: 0deg;
    --bee-scale: 1;
    --bee-opacity: 0;

    position: absolute;
    left: 0;
    top: 0;
    z-index: 6;
    width: 1px;
    height: 1px;
    transform: translate3d(var(--bee-home-x, 40px), var(--bee-home-y, 40px), 0);
  }

  .bee-poly {
    position: absolute;
    left: -24px;
    top: -17px;
    width: 48px;
    height: 34px;
    overflow: visible;
    opacity: var(--bee-opacity);
    transform:
      translate3d(var(--bee-x), var(--bee-y), 0)
      rotate(var(--bee-r))
      scale(var(--bee-scale));
    transform-origin: 50% 50%;
    filter: drop-shadow(0 6px 10px rgba(4, 53, 57, 0.22));
    transition: opacity 0.18s ease;
    animation: bee-hover 0.42s ease-in-out infinite alternate;
  }

  .bee-wing {
    fill: rgba(231, 255, 250, 0.82);
    stroke: rgba(76, 196, 180, 0.34);
    stroke-width: 1;
    transform-origin: 35px 25px;
    animation: wing-flap 0.16s ease-in-out infinite alternate;
  }

  .bee-wing--bottom {
    animation-delay: -0.08s;
  }

  .bee-tail {
    fill: #053840;
  }

  .bee-body--rear {
    fill: #64e3c9;
  }

  .bee-body--middle {
    fill: #28b9a8;
  }

  .bee-body--front {
    fill: #e8fff9;
  }

  .bee-stripe {
    fill: #073b43;
  }

  .bee-highlight {
    fill: rgba(242, 255, 252, 0.7);
  }

  .bee-eye {
    fill: #051f27;
  }

  .bee-antenna {
    fill: none;
    stroke: #073b43;
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .hero-brand,
  .hero-copy,
  .capability-carousel {
    position: relative;
    z-index: 7;
  }

  .hero-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    filter: drop-shadow(0 8px 18px rgba(5, 63, 67, 0.2));
  }

  .hero-brand-name {
    display: inline-flex;
    align-items: center;
  }

  .hero-copy {
    max-width: 620px;
    isolation: isolate;
  }

  .hero-copy::before {
    content: '';
    position: absolute;
    inset: -32px;
    z-index: -1;
    border-radius: 36px;
    background: radial-gradient(
      circle at 30% 45%,
      rgba(229, 255, 250, 0.22),
      rgba(229, 255, 250, 0.06) 55%,
      transparent 100%
    );
    pointer-events: none;
  }

  .theme-dark .hero-copy::before {
    background: radial-gradient(
      circle at 30% 45%,
      rgba(2, 21, 29, 0.26),
      rgba(2, 21, 29, 0.09) 55%,
      transparent 100%
    );
  }

  .hero-copy h1 {
    max-width: 16ch;
    margin: 0;
    color: var(--hero-copy-ink);
    font-size: clamp(2rem, 4.2vw, 3.8rem);
    line-height: 1.08;
    letter-spacing: -0.02em;
    text-shadow: var(--hero-copy-shadow);
    transition:
      color 0.45s ease,
      text-shadow 0.45s ease;
  }

  .hero-copy strong {
    color: var(--hero-accent);
    text-shadow: var(--hero-accent-shadow);
  }

  .hero-copy p {
    max-width: 520px;
    margin: 16px 0 0;
    color: var(--hero-copy-muted);
    font-size: clamp(0.9rem, 1.3vw, 1.06rem);
    line-height: 1.72;
    text-shadow: var(--hero-copy-shadow);
    transition:
      color 0.45s ease,
      text-shadow 0.45s ease;
  }

  .capability-carousel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 480px;
  }

  .carousel-track {
    position: relative;
    height: 100px;
    overflow: hidden;
  }

  .capability-card {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border: 1px solid var(--hero-card-border);
    border-radius: var(--radius, 16px);
    background: var(--hero-card-bg);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 12px 30px rgba(5, 53, 59, 0.18);
  }

  .capability-icon {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 11px;
    color: var(--hero-card-color);
    background: color-mix(in srgb, var(--hero-card-color) 10%, transparent);
  }

  .capability-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .capability-label {
    color: var(--hero-card-color);
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .capability-sub {
    color: var(--hero-card-muted);
    font-size: 0.76rem;
    line-height: 1.45;
  }

  .carousel-dots {
    display: flex;
    gap: 7px;
  }

  .carousel-dot {
    width: 20px;
    height: 4px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--hero-dot-bg);
    cursor: pointer;
    transition:
      width 0.25s ease,
      background 0.2s ease;
  }

  .carousel-dot:focus-visible {
    outline: 2px solid var(--hero-dot-active);
    outline-offset: 4px;
  }

  .carousel-dot--active {
    width: 36px;
    background: var(--hero-dot-active);
  }

  @keyframes bee-hover {
    from {
      translate: 0 -1px;
    }

    to {
      translate: 0 1.5px;
    }
  }

  @keyframes wing-flap {
    from {
      transform: rotate(-9deg) scaleY(1);
      opacity: 0.9;
    }

    to {
      transform: rotate(9deg) scaleY(0.48);
      opacity: 0.52;
    }
  }

  @media (max-width: 980px) {
    .login-hero {
      position: fixed;
      inset: 0;
      z-index: 0;
      width: 100vw;
      min-height: 100svh;
      min-height: 100dvh;
      padding: 0;
      gap: 0;
      pointer-events: none;
    }

    .hero-brand {
      position: absolute;
      left: 20px;
      top: 18px;
      z-index: 8;
      opacity: 0.9;
      transform: scale(0.72);
      transform-origin: top left;
    }

    .hero-copy {
      position: absolute;
      left: 22px;
      top: clamp(108px, 17svh, 146px);
      z-index: 8;
      display: block;
      max-width: min(440px, calc(100vw - 44px));
    }

    .hero-copy h1 {
      max-width: 13ch;
      font-size: clamp(1.58rem, 8vw, 2.7rem);
      line-height: 1.05;
    }

    .hero-copy p {
      max-width: 30ch;
      margin-top: 10px;
      font-size: clamp(0.84rem, 3.8vw, 0.98rem);
      line-height: 1.48;
    }

    .hero-copy::before {
      inset: -20px;
    }

    .capability-carousel,
    .bee-home,
    .bee-trail {
      display: none;
    }

    .celestial {
      right: 20px;
      top: 22px;
      width: clamp(72px, 18vw, 98px);
    }

    .hero-cloud--main {
      right: -31%;
      top: 2%;
      width: 94vw;
      opacity: 0.92;
    }

    .hero-cloud--left {
      left: -34%;
      top: 30%;
      width: 76vw;
      opacity: 0.8;
    }

    .hero-cloud--lower {
      right: -34%;
      bottom: 17%;
      width: 80vw;
      opacity: 0.4;
    }

    .theme-dark .hero-cloud--main {
      opacity: 0.8;
    }

    .theme-dark .hero-cloud--left {
      opacity: 0.4;
    }

    .theme-dark .hero-cloud--lower {
      opacity: 0.6;
    }

    .mountain-scape {
      left: -8%;
      right: -8%;
      bottom: -1px;
      z-index: 4;
      height: 42%;
      opacity: 0.96;
    }

    .theme-dark .mountain-scape {
      opacity: 0.82;
    }

    :global(.login-card),
    :global(.login-form),
    :global(.login-content),
    :global(.login-container),
    :global(.login-shell) {
      position: relative;
      z-index: 1;
    }

    :global(.theme-toggle),
    :global(.theme-switcher) {
      position: relative;
      z-index: 2;
    }

    :global(.login-panel) {
      padding-top: clamp(300px, 42svh, 400px) !important;
    }
  }

  @media (max-width: 420px) {
    .hero-brand {
      left: 16px;
      top: 14px;
      transform: scale(0.62);
    }

    .hero-copy {
      left: 18px;
      top: clamp(92px, 15svh, 122px);
      max-width: calc(100vw - 36px);
    }

    .hero-copy h1 {
      font-size: clamp(1.42rem, 8.8vw, 2.3rem);
    }

    .hero-copy p {
      max-width: 27ch;
      font-size: 0.82rem;
    }

    .hero-cloud--main {
      right: -42%;
      width: 106vw;
    }

    .hero-cloud--left {
      left: -48%;
      top: 34%;
      width: 86vw;
    }

    .hero-cloud--lower {
      right: -48%;
      bottom: 16%;
      width: 90vw;
    }

    .celestial {
      right: 18%;
      top: 7%;
      width: 74px;
    }

    :global(.login-panel) {
      padding-top: clamp(300px, 41svh, 380px) !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .celestial,
    .cloud-image,
    .hero-copy h1,
    .hero-copy p {
      transition: none;
    }

    .celestial--sun :global(.sun-svg),
    .celestial--moon :global(.moon-svg),
    .cloud-image {
      animation: none;
    }

    .bee-poly,
    .bee-wing {
      animation: none;
    }

    .bee-home,
    .bee-trail {
      display: none;
    }
  }
</style>

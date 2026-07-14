import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

// `@sapphi-red/web-noise-suppressor` subclasses the browser-only `AudioWorkletNode` global at
// import time, so these files can only be verified by source inspection here (matching this
// codebase's existing convention for DOM-coupled voice modules) — the actual runtime behavior is
// covered by the enhancer-capabilities/audio-constraints unit tests (pure logic, no DOM) plus a
// real browser smoke test and production-bundle inspection.
describe('AudioEnhancer abstraction (setara-f05x.10)', () => {
  it('is the only public contract — no file outside enhancer/ imports the vendor package directly', () => {
    const files = [
      'src/lib/voice/audio/audio-capture-session.ts',
      'src/lib/voice/sidecar-voice.svelte.ts',
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), /@sapphi-red\/web-noise-suppressor/, `${file} must not import the vendor package directly`);
    }
    assert.match(read('src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts'), /from '@sapphi-red\/web-noise-suppressor'/);
    assert.match(read('src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts'), /from '@sapphi-red\/web-noise-suppressor'/);
  });

  it('pins an exact dependency version with a committed lockfile entry', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.dependencies['@sapphi-red/web-noise-suppressor'], '0.3.5');
    assert.doesNotMatch(pkg.dependencies['@sapphi-red/web-noise-suppressor'], /[\^~]/);
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(lock.packages['node_modules/@sapphi-red/web-noise-suppressor'].version, '0.3.5');
  });

  it('exposes requestedMode/activeMode/fallbackUsed/fallbackReason on every enhancer', () => {
    const iface = read('src/lib/voice/audio/enhancer/audio-enhancer.ts');
    assert.match(iface, /readonly requestedMode: AudioSuppressionMode/);
    assert.match(iface, /readonly activeMode: Exclude<AudioSuppressionMode, 'auto'>/);
    assert.match(iface, /readonly fallbackUsed: boolean/);
    assert.match(iface, /readonly fallbackReason: string \| null/);
    assert.match(iface, /diagnostics\(\): AudioEnhancerDiagnostics/);
  });

  it('resolves auto to speex, falls back explicit modes to browser when unsupported, and never throws', () => {
    const factory = read('src/lib/voice/audio/enhancer/enhancer-factory.ts');
    const resolveBody = factory.slice(factory.indexOf('export function resolveAudioEnhancerMode'), factory.indexOf('function buildEnhancer'));

    assert.match(resolveBody, /if \(selection\.requested === 'none'\) return 'none';/);
    assert.match(resolveBody, /if \(selection\.requested === 'browser'\) return 'browser';/);
    assert.match(resolveBody, /if \(selection\.requested === 'speex'\) return capabilities\.speexSupported \? 'speex' : 'browser';/);
    assert.match(resolveBody, /if \(selection\.preferredEnhancedMode === 'speex' && capabilities\.speexSupported\) return 'speex';/);
    assert.match(resolveBody, /return 'browser';\n\}/);

    const createBody = factory.slice(factory.indexOf('export async function createAudioEnhancer'));
    assert.match(createBody, /catch \(error\) \{\s*return new PassthroughEnhancer\('browser', \{/);
  });

  it('never runs two suppression algorithms at once — passthrough modes add no Web Audio node', () => {
    const browserEnhancer = read('src/lib/voice/audio/enhancer/browser-enhancer.ts');
    const connectBody = browserEnhancer.slice(browserEnhancer.indexOf('connect(source: AudioNode)'), browserEnhancer.indexOf('setBypass'));
    assert.match(connectBody, /return source;/);
    assert.doesNotMatch(connectBody, /createGain|AudioWorkletNode|new /);
  });

  it('builds a bypassable wet/dry graph so setBypass() is a real audio-routing toggle, not a no-op', () => {
    const speex = read('src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts');
    const setBypassBody = speex.slice(speex.indexOf('setBypass('), speex.indexOf('async destroy('));
    assert.match(setBypassBody, /this\.dryGain\.gain\.value = bypass \? 1 : 0;/);
    assert.match(setBypassBody, /this\.wetGain\.gain\.value = bypass \? 0 : 1;/);
  });

  it('lazy-loads and caches the Speex WASM binary and worklet module instead of on every construction', () => {
    const speex = read('src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts');
    assert.match(speex, /const loadSpeexWasmCached = memoizeAsync\(\(\) => loadSpeex\(\{ url: speexWasmUrl \}\)\);/);
    assert.match(speex, /await ensureWorkletModuleLoaded\(context, speexWorkletUrl\);/);
    const loader = read('src/lib/voice/audio/enhancer/worklet-loader.ts');
    assert.match(loader, /export function memoizeAsync/);
    assert.match(loader, /A failed attempt is not cached, so the next call retries cleanly\./);
  });

  it('uses Vite ?url imports (already-compiled package assets) rather than a bare new URL()', () => {
    const speex = read('src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts');
    assert.match(speex, /import speexWorkletUrl from '@sapphi-red\/web-noise-suppressor\/speexWorklet\.js\?url';/);
    assert.match(speex, /import speexWasmUrl from '@sapphi-red\/web-noise-suppressor\/speex\.wasm\?url';/);
  });

  it('destroys the WorkletNode and every gain node it created, and never reuses a destroyed enhancer', () => {
    const speex = read('src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts');
    const destroyBody = speex.slice(speex.indexOf('async destroy('), speex.indexOf('diagnostics()'));
    assert.match(destroyBody, /this\.node\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.node\?\.destroy\(\);/);
    assert.match(destroyBody, /this\.dryGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.wetGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.outputGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.node = null;/);
  });

  it('destroy() on AudioCaptureSession also destroys the enhancer it owns', () => {
    const session = read('src/lib/voice/audio/audio-capture-session.ts');
    const destroyBody = session.slice(session.indexOf('destroy(): void'));
    assert.match(destroyBody, /void this\.enhancer\?\.destroy\(\)\.catch\(\(\) => \{/);
    assert.match(destroyBody, /this\.enhancer = null;/);
  });
});

describe('RNNoise enhancer (setara-f05x.11)', () => {
  it('selects rnnoise only through explicit request, and auto stays on browser-native until promoted', () => {
    const factory = read('src/lib/voice/audio/enhancer/enhancer-factory.ts');
    const resolveBody = factory.slice(factory.indexOf('export function resolveAudioEnhancerMode'), factory.indexOf('function buildEnhancer'));

    assert.match(resolveBody, /if \(selection\.requested === 'rnnoise'\) return capabilities\.rnnoiseSupported \? 'rnnoise' : 'browser';/);
    // auto checks the speex branch first — rnnoise can only win auto if a caller opts preferredEnhancedMode into it.
    const speexAutoIdx = resolveBody.indexOf("preferredEnhancedMode === 'speex' && capabilities.speexSupported");
    const rnnoiseAutoIdx = resolveBody.indexOf("preferredEnhancedMode === 'rnnoise' && capabilities.rnnoiseSupported");
    assert.ok(speexAutoIdx >= 0 && rnnoiseAutoIdx > speexAutoIdx);

    // Neither enhanced mode is the production auto default — see the "STT accuracy regression" test below.
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    assert.match(voice, /preferredEnhancedMode: 'browser'/);

    assert.match(factory, /buildEnhancer\(mode: 'speex' \| 'rnnoise'\)/);
    assert.match(factory, /return new SapphiRedRnnoiseEnhancer\(\);/);
  });

  it('fixes the STT accuracy regression: auto defaults to browser-native, not Speex, until corpus-validated', () => {
    // Speex is a narrowband (8kHz-era) DSP preprocessor; run unconditionally on full wideband (48kHz)
    // mic input via the `auto` default, it measurably hurt STT accuracy for every capable browser
    // (effectively everyone) without ever completing the WER/CER corpus validation the design's own
    // risk table required first. This test pins the fix: `auto` must resolve to browser-native.
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    const selectionBody = voice.slice(
      voice.indexOf('private noiseSuppressionSelection(): AudioEnhancerSelection'),
      voice.indexOf('private microphoneConstraints(): MediaTrackConstraints'),
    );
    assert.match(selectionBody, /preferredEnhancedMode: 'browser'/);
    assert.doesNotMatch(selectionBody, /preferredEnhancedMode: 'speex'/);

    const factory = read('src/lib/voice/audio/enhancer/enhancer-factory.ts');
    assert.match(factory, /preferredEnhancedMode: 'speex' \| 'rnnoise' \| 'browser'/);
  });

  it('still preloads and preserves explicit speex/rnnoise opt-in for users who select it', () => {
    const voice = read('src/lib/voice/sidecar-voice.svelte.ts');
    assert.match(voice, /import \{ resolveAudioEnhancerMode, preloadAudioEnhancer, type AudioEnhancerSelection \} from '\.\/audio\/enhancer\/enhancer-factory';/);
    const ensureCtxBody = voice.slice(voice.indexOf('private ensureAudioContext('), voice.indexOf('private useLegacyScriptProcessor('));
    assert.match(ensureCtxBody, /resolvedMode === 'speex' \|\| resolvedMode === 'rnnoise'/);
    assert.match(ensureCtxBody, /void preloadAudioEnhancer\(this\.audioCtx, resolvedMode\)/);

    const factory = read('src/lib/voice/audio/enhancer/enhancer-factory.ts');
    assert.match(factory, /export async function preloadAudioEnhancer/);
  });

  it('builds a bypassable wet/dry graph identical in shape to the Speex enhancer', () => {
    const rnnoise = read('src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts');
    const setBypassBody = rnnoise.slice(rnnoise.indexOf('setBypass('), rnnoise.indexOf('async destroy('));
    assert.match(setBypassBody, /this\.dryGain\.gain\.value = bypass \? 1 : 0;/);
    assert.match(setBypassBody, /this\.wetGain\.gain\.value = bypass \? 0 : 1;/);
  });

  it('lazy-loads and caches the RNNoise WASM binary (regular + SIMD) and worklet module', () => {
    const rnnoise = read('src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts');
    assert.match(rnnoise, /loadRnnoise\(\{ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl \}\)/);
    assert.match(rnnoise, /await ensureWorkletModuleLoaded\(context, rnnoiseWorkletUrl\);/);
  });

  it('uses Vite ?url imports for the worklet and both wasm binaries rather than a bare new URL()', () => {
    const rnnoise = read('src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts');
    assert.match(rnnoise, /import rnnoiseWorkletUrl from '@sapphi-red\/web-noise-suppressor\/rnnoiseWorklet\.js\?url';/);
    assert.match(rnnoise, /import rnnoiseWasmUrl from '@sapphi-red\/web-noise-suppressor\/rnnoise\.wasm\?url';/);
    assert.match(rnnoise, /import rnnoiseSimdWasmUrl from '@sapphi-red\/web-noise-suppressor\/rnnoise_simd\.wasm\?url';/);
  });

  it('destroys the WorkletNode and every gain node it created, mirroring the Speex teardown', () => {
    const rnnoise = read('src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts');
    const destroyBody = rnnoise.slice(rnnoise.indexOf('async destroy('), rnnoise.indexOf('diagnostics(): AudioEnhancerDiagnostics'));
    assert.match(destroyBody, /this\.node\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.node\?\.destroy\(\);/);
    assert.match(destroyBody, /this\.dryGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.wetGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.outputGain\?\.disconnect\(\);/);
    assert.match(destroyBody, /this\.node = null;/);
  });

  it('reports cpuLoad/overrunCount/quietSpeechRatio as null rather than fabricated numbers', () => {
    const iface = read('src/lib/voice/audio/enhancer/audio-enhancer.ts');
    assert.match(iface, /cpuLoad: number \| null;/);
    assert.match(iface, /overrunCount: number \| null;/);
    assert.match(iface, /quietSpeechRatio: number \| null;/);

    for (const file of [
      'src/lib/voice/audio/enhancer/sapphi-red-rnnoise-enhancer.ts',
      'src/lib/voice/audio/enhancer/sapphi-red-enhancer.ts',
      'src/lib/voice/audio/enhancer/browser-enhancer.ts',
    ]) {
      const source = read(file);
      const diagnosticsBody = source.slice(source.indexOf('diagnostics()'));
      assert.match(diagnosticsBody, /cpuLoad: null,/, `${file} diagnostics() must report cpuLoad: null`);
      assert.match(diagnosticsBody, /overrunCount: null,/, `${file} diagnostics() must report overrunCount: null`);
      assert.match(diagnosticsBody, /quietSpeechRatio: null,?/, `${file} diagnostics() must report quietSpeechRatio: null`);
    }
  });

  it('reuses the shared no-double-suppression constraint builder — no rnnoise-specific mic path', () => {
    const constraints = read('src/lib/voice/audio/audio-constraints.ts');
    assert.match(constraints, /mode === 'speex' \|\| mode === 'rnnoise'/);
  });
});

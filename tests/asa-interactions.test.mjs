import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA interaction contracts', () => {
  it('uses cursor history without sending the entire transcript as agent context', () => {
    const api = read('src/lib/api/asa.ts');
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(api, /getAsaMessages\(before\?: string, limit = 30\)/);
    assert.match(api, /params\.set\('before', before\)/);
    assert.match(store, /this\.mergeMessages\(page\.items, this\.messages\)/);
    assert.match(store, /this\.historyCursor = page\.nextCursor/);
    assert.doesNotMatch(api, /conversationId/);
  });

  it('keeps the panel anchored and exposes thinking feedback', () => {
    const source = read('src/lib/components/AsaOrb.svelte');

    assert.match(source, /asa\.thinkingText/);
    assert.match(source, /await asa\.loadOlderMessages\(\)/);
    assert.match(source, /aria-label="Close ASA"/);
    assert.match(source, /event\.key !== 'Escape'/);
    assert.match(source, /tick\(\)\.then\(\(\) => orbEl\?\.focus\(\)\)/);
    assert.match(source, /window\.addEventListener\('keydown', onWindowKeydown\)/);
    assert.match(source, /onpointerdown=\{onPanelPointerDown\}/);
    assert.match(source, /class:panel--moving=\{panelMoving\}/);
    assert.match(source, /resizeRight - panelW/);
    assert.match(source, /top: 3px;[\s\S]*left: 3px;[\s\S]*cursor: nw-resize/);
    assert.match(source, /max-width: calc\(100vw - 16px\)/);
    assert.match(source, /window\.addEventListener\('resize', fitToViewport\)/);
    assert.match(source, /window\.innerWidth - ORB_SIZE/);
    assert.match(source, /backdrop-filter: blur\(18px\) saturate\(140%\)/);
    assert.match(source, /var\(--color-surface\) 86%, transparent/);
    assert.match(source, /aria-label=\{asaVoice\.enabled \? 'Toggle ASA voice listening' : 'Start ASA voice listening'\}/);
    assert.match(source, /onclick=\{toggleOrbVoice\}/);
    assert.match(source, /Say “Hi ASA”/);
    assert.doesNotMatch(source, /glass-container|class=”|role=”/);
  });

  it('keeps voice local, opt-in, pinned, and transcript-reviewed', () => {
    const source = read('src/lib/voice/asa-voice.svelte.ts');
    const manifest = JSON.parse(read('src/lib/voice/model-manifest.json'));

    assert.match(source, /getUserMedia\(\{ audio: true \}\)/);
    const wakeRouter = read('src/lib/voice/wake-router.ts');
    assert.match(wakeRouter, /\(\?:hi\|hello\)/);
    assert.match(source, /this\.state = 'reviewing'/);
    assert.match(source, /MoonshineSttEngine/);
    assert.match(source, /runanywhere-adapters/);
    const adapters = read('src/lib/voice/runanywhere-adapters.ts');
    assert.match(adapters, /@runanywhere\/web-onnx/);
    assert.equal(manifest.dependencies[0].package, '@moonshine-ai/moonshine-js');
    assert.equal(manifest.dependencies[0].version, '0.1.29');
    assert.equal(manifest.dependencies[0].license, 'MIT');
    assert.equal(manifest.dependencies[1].package, '@ricky0123/vad-web');
    assert.equal(manifest.dependencies[1].version, '0.0.30');
    assert.equal(manifest.dependencies[1].license, 'ISC');
  });

  it('allows the blob-backed Sherpa helper module required by RunAnywhere', () => {
    const app = read('src/app.html');
    const runtime = read('node_modules/@runanywhere/web-onnx/dist/Foundation/SherpaHelperLoader.js');

    assert.match(runtime, /URL\.createObjectURL\(blob\)/);
    assert.match(runtime, /import\(\/\* @vite-ignore \*\/ blobUrl\)/);
    assert.match(app, /script-src[^;]*\bblob:/);
  });
});

describe('ASA action registry', () => {
  it('registers all documented action types in the store', () => {
    const source = read('src/lib/stores/asa.svelte.ts');
    const api = read('src/lib/api/asa.ts');

    // All 8 versioned action types must be registered
    const expectedActions = [
      'navigate:v1',
      'open_modal:v1',
      'close_modal:v1',
      'show_toast:v1',
      'show_form:v1',
      'select_option:v1',
      'highlight:v1',
      'focus_element:v1',
    ];
    for (const action of expectedActions) {
      assert.match(source, new RegExp(action.replace(':', '\\:')), `Missing handler for ${action}`);
    }

    // Unknown actions must be observable but not crash the store
    assert.match(source, /unknownActionEvents/);
    assert.match(source, /Unsupported action type/);
  });

  it('negotiates capabilities on session init', () => {
    const source = read('src/lib/stores/asa.svelte.ts');
    const api = read('src/lib/api/asa.ts');

    assert.match(source, /negotiateCapabilities/);
    assert.match(api, /CLIENT_SUPPORTED_ACTIONS/);
    assert.match(api, /\/api\/asa\/capabilities/);
  });

  it('handles versioned action types from backend events', () => {
    const source = read('src/lib/stores/asa.svelte.ts');

    // Must handle both 'navigate:v1' (new) and unversioned 'navigate' (legacy fallback)
    assert.match(source, /action\.type\.includes\(':'\)/);
    assert.match(source, /\`\$\{action\.type\}:v1\`/);
  });
});

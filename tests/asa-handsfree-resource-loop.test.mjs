import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA hands-free resource loop guard', () => {
  it('makes hands-free arming idempotent across reactive effects and async VAD setup', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.match(sidecar, /private armingHandsFree: Promise<void> \| null = null/);
    assert.match(sidecar, /private handsFreePanelActive = false/);
    assert.match(sidecar, /if \(this\.armingHandsFree\) return this\.armingHandsFree/);
    assert.match(sidecar, /this\.armingHandsFree = this\.doArmHandsFree\(\)\.finally\(\(\) => \{ this\.armingHandsFree = null; \}\)/);
    assert.match(sidecar, /private async doArmHandsFree\(\): Promise<void>/);
    assert.match(sidecar, /this\.handsFreePanelActive = active/);
    assert.match(sidecar, /if \(v\) \{[\s\S]*if \(this\.handsFreePanelActive\) this\.syncHandsFree\(true\)/);
    assert.match(sidecar, /if \(this\.streaming \|\| this\.sttWs\) return false/);
    assert.match(sidecar, /this\.pendingSttFrames = \[\]/);
    assert.match(sidecar, /this\.pendingSttFrames\.length < MAX_PENDING_STT_FRAMES/);
    assert.doesNotMatch(orb, /\$effect\(\(\) => \{[\s\S]*sidecarVoice\.armHandsFree\(\)/);
    assert.match(orb, /sidecarVoice\.syncHandsFree\(asa\.open && asa\.voiceSidecar\)/);
  });
});

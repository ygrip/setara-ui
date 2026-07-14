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
    assert.match(sidecar, /const arming = this\.doArmHandsFree\(\)/);
    assert.match(sidecar, /if \(this\.armingHandsFree === arming\) this\.armingHandsFree = null/);
    assert.match(sidecar, /private async doArmHandsFree\(\): Promise<void>/);
    assert.match(sidecar, /this\.handsFreePanelActive = active/);
    assert.match(sidecar, /if \(v\) \{[\s\S]*if \(this\.handsFreePanelActive\) this\.syncHandsFree\(true\)/);
    assert.match(sidecar, /await this\.openSttSession\('hands_free'\)/);
    assert.match(sidecar, /if \(this\.sttSession\?\.isReady && this\.sttMode === mode\) return/);
    assert.match(sidecar, /Core closes an idle relay after its deadline/);
    assert.doesNotMatch(sidecar, /pendingSttFrames|MAX_PENDING_STT_FRAMES/);
    assert.doesNotMatch(orb, /\$effect\(\(\) => \{[\s\S]*sidecarVoice\.armHandsFree\(\)/);
    assert.match(orb, /sidecarVoice\.syncHandsFree\(asa\.open && asa\.voiceSidecar\)/);
  });

  it('cannot resurrect capture from stale permission, VAD, final, or queued rearm work', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const arm = sidecar.slice(
      sidecar.indexOf('private async doArmHandsFree'),
      sidecar.indexOf('disarmHandsFree(): void'),
    );
    const final = sidecar.slice(
      sidecar.indexOf('private handleSttSessionFinal'),
      sidecar.indexOf('setVoice('),
    );

    assert.match(arm, /if \(!this\.handsFreeRuntimeActive \|\| !this\.handsFree/);
    assert.match(arm, /this\.isHandsFreeArmCurrent\(generation\)/);
    assert.match(arm, /this\.releaseStaleHandsFreeStream\(stream\)/);
    assert.match(arm, /if \(vad\) void vad\.destroy\(\)/);
    assert.match(arm, /this\.destroySttSession\(session\)/);
    assert.match(arm, /this\.status === 'listening'/);
    assert.match(sidecar, /if \(!this\.handsFree \|\| !this\.handsFreeRuntimeActive\) return;[\s\S]*this\.turnState = 'armed'/);
    assert.match(final, /if \(this\.sttSession !== session \|\| this\.sttFinalizing\) return/);
    assert.match(final, /const generation = this\.handsFreeGeneration/);
    assert.match(final, /this\.refreshHandsFreeSession\(generation\)/);
    assert.match(sidecar, /private async refreshHandsFreeSession\(generation: number\)[\s\S]*this\.isHandsFreeArmCurrent\(generation\)[\s\S]*this\.status === 'listening'/);
    assert.match(sidecar, /this\.handsFreeRuntimeActive = false;[\s\S]*this\.handsFreeGeneration \+= 1/);
  });

  it('releases stream, session, and monitor nodes on VAD setup failure or disarm', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const fail = sidecar.slice(sidecar.indexOf('private fail('));

    assert.match(sidecar, /if \(!ctx\) \{[\s\S]*this\.fail\('Microphone monitoring is unavailable/);
    assert.match(sidecar, /catch \{[\s\S]*this\.fail\('Microphone monitoring could not start/);
    assert.match(sidecar, /private stopVadMonitor\(\): void \{[\s\S]*this\.vadSource\?\.disconnect\(\)[\s\S]*this\.analyser\?\.disconnect\(\)/);
    assert.match(sidecar, /disarmHandsFree\(\): void \{[\s\S]*this\.stopVadMonitor\(\)[\s\S]*this\.destroySttSession\(\)[\s\S]*this\.releaseStream\(true\)/);
    assert.match(fail, /this\.stopPcmCapture\(\)[\s\S]*this\.destroySttSession\(\)[\s\S]*this\.releaseStream\(true\)/);
    assert.match(sidecar, /private releaseStaleHandsFreeStream\(stream: MediaStream\)[\s\S]*track\.stop\(\)/);
  });
});

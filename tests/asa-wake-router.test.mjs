import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeVoiceTranscript } from '../src/lib/voice/wake-router.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('ASA wake transcript routing', () => {
  it('keeps listening after unrelated speech without reopening capture', () => {
    assert.deepEqual(routeVoiceTranscript('wake', 'please open the projects page'), {
      action: 'continue',
      nextMode: 'wake'
    });
  });

  it('recognizes supported wake phrases and an ASR-spelled acronym', () => {
    const cases = [
      ['Hi ASA show my projects', 'show my projects'],
      ['Hello ASA, list failed builds', 'list failed builds'],
      ['hello, A.S.A. open dashboard', 'open dashboard']
    ];

    for (const [transcript, command] of cases) {
      assert.deepEqual(routeVoiceTranscript('wake', transcript), {
        action: 'review',
        command,
        nextMode: 'command'
      });
    }
  });

  it('switches an isolated wake phrase to command capture without reopening the microphone', () => {
    assert.deepEqual(routeVoiceTranscript('wake', 'Hello ASA'), {
      action: 'continue',
      nextMode: 'command'
    });
    assert.deepEqual(routeVoiceTranscript('command', 'show the latest build'), {
      action: 'review',
      command: 'show the latest build',
      nextMode: 'command'
    });
  });

  it('ignores empty VAD transcripts in both modes', () => {
    assert.deepEqual(routeVoiceTranscript('wake', '   '), { action: 'continue', nextMode: 'wake' });
    assert.deepEqual(routeVoiceTranscript('command', ''), { action: 'continue', nextMode: 'command' });
  });

  it('keeps wake-once state machine explicit in sidecar voice', () => {
    const sidecar = read('src/lib/voice/sidecar-voice.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.match(sidecar, /turnState = \$state<VoiceTurnState>\('idle'\)/);
    assert.match(sidecar, /wakeMode = \$state<WakeMode>\('wake'\)/);
    assert.match(sidecar, /const route = routeVoiceTranscript\(this\.wakeMode, transcript\.text\)/);
    assert.match(sidecar, /this\.wakeMode = route\.nextMode/);
    assert.match(sidecar, /resolvedText: route\.command/);
    assert.match(sidecar, /this\.speakChain = this\.speakChain\.then\(\(\) => \{[\s\S]*!this\.handsFreeRuntimeActive[\s\S]*this\.turnState = 'armed';[\s\S]*void this\.armHandsFree\(\)/);
    assert.match(sidecar, /this\.turnState = 'paused'/);
    assert.match(sidecar, /this\.wakeMode = 'wake'/);
    assert.match(sidecar, /this\.stopAudio\(\); \/\/ barge-in/);
    assert.match(orb, /sidecarVoice\.disarmHandsFree\(\)/);
  });
});

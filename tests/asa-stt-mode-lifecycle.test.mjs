import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STT_FRAME_BYTES } from '../src/lib/voice/stt-stream/frame-encoder.ts';
import {
  STT_MODE_POLICIES,
  sttFinalDisposition,
} from '../src/lib/voice/stt-stream/mode-policy.ts';
import { SttSession } from '../src/lib/voice/stt-stream/stt-session.ts';

describe('ASA STT mode lifecycle', () => {
  it('opens every mode with its configured limit and mode-specific completion policy', async () => {
    assert.equal(STT_MODE_POLICIES.command.maxDurationSeconds, 15);
    assert.equal(STT_MODE_POLICIES.hands_free.maxDurationSeconds, 30);
    assert.equal(STT_MODE_POLICIES.dictation.maxDurationSeconds, 300);

    for (const [mode, reason] of [
      ['command', 'user_stop'],
      ['hands_free', 'vad_silence'],
      ['dictation', 'user_stop'],
    ]) {
      const socket = new CaptureSocket();
      const session = new SttSession({ start: startFor(mode), socketFactory: () => socket });
      const opening = session.open();
      socket.open();
      assert.equal(socket.controls[0].mode, mode);
      assert.equal(
        socket.controls[0].maxDurationSeconds,
        STT_MODE_POLICIES[mode].maxDurationSeconds,
      );
      socket.message(readyEvent(300));
      await opening;
      session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
      const final = session.stop(reason);
      assert.deepEqual(socket.controls.at(-1), { type: 'flush', reason });
      socket.message(finalEvent('provider_final', 'authoritative transcript', 20));
      const result = await final;
      assert.equal(
        sttFinalDisposition(mode, result),
        mode === 'dictation' ? 'review' : 'auto_submit',
      );
      session.destroy();
    }
  });

  it('keeps degraded command and hands-free finals reviewable, never executable', () => {
    const degraded = {
      text: 'review this recovered text',
      finality: 'connection_lost_partial',
      provider: 'faster_whisper',
      model: 'distil-small.en',
      durationMs: 1_000,
      latencyMs: 0,
      fallbackUsed: false,
      audioDroppedMs: 20,
      degraded: true,
      transport: {
        framesProduced: 50,
        framesSent: 49,
        framesDropped: 1,
        audioProducedMs: 1_000,
        audioSentMs: 980,
        audioDroppedMs: 20,
        maxBufferedAmount: 0,
        reconnects: 0,
        congestionStops: 0,
      },
    };
    assert.equal(sttFinalDisposition('command', degraded), 'review');
    assert.equal(sttFinalDisposition('hands_free', degraded), 'review');
    assert.equal(sttFinalDisposition('dictation', { ...degraded, degraded: false }), 'review');
    assert.equal(
      sttFinalDisposition('hands_free', { ...degraded, text: '', finality: 'cancelled' }),
      'discard',
    );
  });

  for (const seconds of [63, 300]) {
    it(`streams ${seconds}s incrementally with beginning, middle, and end frames intact`, async () => {
      const totalFrames = seconds * 50;
      const middle = Math.floor(totalFrames / 2);
      const socket = new CaptureSocket(new Set([0, middle, totalFrames - 1]));
      const session = new SttSession({
        start: startFor('dictation'),
        socketFactory: () => socket,
      });
      const opening = session.open();
      socket.open();
      socket.message(readyEvent(300));
      await opening;

      for (let index = 0; index < totalFrames; index += 1) {
        const frame = new Uint8Array(STT_FRAME_BYTES);
        if (index === 0) frame[0] = 11;
        if (index === middle) frame[0] = 22;
        if (index === totalFrames - 1) frame[0] = 33;
        session.sendPcm(frame);
      }

      assert.equal(socket.binaryCount, totalFrames);
      assert.equal(socket.checkpoints.get(0)[0], 11);
      assert.equal(socket.checkpoints.get(middle)[0], 22);
      assert.equal(socket.checkpoints.get(totalFrames - 1)[0], 33);
      assert.equal(session.transportStats.audioProducedMs, seconds * 1_000);
      assert.equal(session.transportStats.audioDroppedMs, 0);

      const completion = session.stop('user_stop');
      socket.message(
        finalEvent(
          'provider_final',
          `beginning marker middle marker end marker ${seconds}`,
          seconds * 1_000,
        ),
      );
      const result = await completion;
      assert.match(result.text, /beginning marker/);
      assert.match(result.text, /middle marker/);
      assert.match(result.text, /end marker/);
      assert.equal(result.degraded, false);
      session.destroy();
    });
  }
});

function startFor(mode) {
  return {
    type: 'start',
    protocolVersion: '2',
    sessionId: `voice-${mode}`,
    requestId: `request-${mode}`,
    mode,
    provider: 'auto',
    audio: {
      sampleRate: 16_000,
      channels: 1,
      sampleFormat: 's16le',
      frameDurationMs: 20,
    },
    maxDurationSeconds: STT_MODE_POLICIES[mode].maxDurationSeconds,
  };
}

function readyEvent(maxDurationSeconds) {
  return {
    type: 'ready',
    protocolVersion: '2',
    provider: 'faster_whisper',
    model: 'distil-small.en',
    supportsPartials: true,
    maxDurationSeconds,
  };
}

function finalEvent(finality, text, durationMs) {
  return {
    type: 'final',
    text,
    finality,
    provider: 'faster_whisper',
    model: 'distil-small.en',
    durationMs,
    latencyMs: 100,
    fallbackUsed: false,
    audioDroppedMs: 0,
  };
}

class CaptureSocket {
  readyState = 0;
  bufferedAmount = 0;
  binaryType = 'blob';
  listeners = new Map();
  controls = [];
  binaryCount = 0;
  checkpoints = new Map();

  constructor(checkpointIndexes = new Set()) {
    this.checkpointIndexes = checkpointIndexes;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(value) {
    if (typeof value === 'string') {
      this.controls.push(JSON.parse(value));
      return;
    }
    const index = this.binaryCount;
    this.binaryCount += 1;
    if (this.checkpointIndexes.has(index)) {
      this.checkpoints.set(index, new Uint8Array(value).slice());
    }
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(value) {
    this.emit('message', { data: JSON.stringify(value) });
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

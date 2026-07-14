import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STT_FRAME_BYTES,
  SttFrameEncoder,
} from '../src/lib/voice/stt-stream/frame-encoder.ts';
import {
  SttSession,
  canAutoSubmitSttFinal,
  isAuthoritativeSttFinalResult,
  isReviewableSttFinal,
} from '../src/lib/voice/stt-stream/stt-session.ts';

const start = {
  type: 'start',
  protocolVersion: '2',
  sessionId: 'voice-session-1',
  requestId: 'request-1',
  mode: 'command',
  provider: 'auto',
  audio: {
    sampleRate: 16_000,
    channels: 1,
    sampleFormat: 's16le',
    frameDurationMs: 20,
  },
  maxDurationSeconds: 30,
};

describe('ASA STT v2 session', () => {
  it('encodes arbitrary PCM chunks into exact frames without a frame queue', () => {
    const encoder = new SttFrameEncoder();
    const frames = [];

    encoder.write(new Uint8Array(100).fill(1), (frame) => frames.push(frame));
    assert.equal(frames.length, 0);
    assert.equal(encoder.pendingBytes, 100);

    encoder.write(new Uint8Array(STT_FRAME_BYTES - 100).fill(2), (frame) => frames.push(frame));
    assert.equal(frames.length, 1);
    assert.equal(frames[0].byteLength, STT_FRAME_BYTES);
    assert.equal(encoder.pendingBytes, 0);

    encoder.write(new Uint8Array(STT_FRAME_BYTES * 2), (frame) => frames.push(frame));
    assert.equal(frames.length, 3);
    assert.equal(encoder.pendingBytes, 0);
    encoder.destroy();
  });

  it('opens through the authenticated factory and sends no audio before ready', async () => {
    const socket = new FakeSocket();
    let factoryCalls = 0;
    const session = new SttSession({
      start,
      socketFactory: () => {
        factoryCalls += 1;
        return socket;
      },
    });

    const opening = session.open();
    assert.equal(factoryCalls, 1);
    assert.equal(session.sendPcm(new Uint8Array(STT_FRAME_BYTES)).status, 'not_ready');
    assert.equal(socket.binaryMessages.length, 0);

    socket.open();
    assert.deepEqual(socket.jsonMessages[0], start);
    assert.equal(session.sendPcm(new Uint8Array(STT_FRAME_BYTES)).status, 'not_ready');
    assert.equal(socket.binaryMessages.length, 0);

    socket.message(readyEvent(300));
    const ready = await opening;
    assert.equal(ready.maxDurationSeconds, 300);
    assert.equal(session.state, 'ready');

    const delivery = session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
    assert.equal(delivery.status, 'sent');
    assert.equal(delivery.framesSent, 1);
    assert.equal(socket.binaryMessages.length, 1);
    assert.equal(socket.binaryMessages[0].byteLength, STT_FRAME_BYTES);
  });

  it('rejects a ready capability smaller than the requested duration', async () => {
    const socket = new FakeSocket();
    const session = new SttSession({ start, socketFactory: () => socket });
    const opening = session.open();
    socket.open();
    socket.message(readyEvent(15));

    await assert.rejects(opening, (error) => error.code === 'STT_INVALID_MESSAGE');
    assert.equal(session.state, 'closed');
    assert.equal(socket.closeCalls, 1);
  });

  it('rejects open immediately when the server reports an error before ready', async () => {
    const socket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const session = new SttSession({
      start,
      socketFactory: () => socket,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    });
    const opening = session.open();
    const completion = session.completion();
    socket.open();

    socket.message({
      type: 'error',
      code: 'STT_PROVIDER_UNAVAILABLE',
      message: 'Provider is unavailable.',
      retryable: true,
    });

    const [openResult, completionResult] = await Promise.allSettled([opening, completion]);
    assert.equal(openResult.status, 'rejected');
    assert.equal(completionResult.status, 'rejected');
    assert.strictEqual(openResult.reason, completionResult.reason);
    assert.equal(openResult.reason.code, 'STT_PROVIDER_UNAVAILABLE');
    assert.equal(openResult.reason.message, 'Provider is unavailable.');
    assert.equal(openResult.reason.retryable, true);
    assert.equal(session.state, 'closed');
    assert.equal(socket.closeCalls, 1);
    assert.equal(socket.listenerCount, 0);
    assert.equal(scheduler.activeTaskCount, 0);
  });

  it('uses high and low watermarks as deterministic hysteresis without queuing audio', async () => {
    const socket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const flow = [];
    const session = new SttSession({
      start,
      socketFactory: () => socket,
      highWatermarkBytes: 100,
      lowWatermarkBytes: 20,
      sustainedCongestionMs: 1_000,
      now: () => scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
      onFlowControl: (event) => flow.push(event),
    });
    await openReady(session, socket);

    socket.bufferedAmount = 100;
    const blocked = session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
    assert.equal(blocked.framesDropped, 1);
    assert.equal(session.isPressurePaused, true);
    assert.equal(socket.binaryMessages.length, 0);

    socket.bufferedAmount = 21;
    session.checkPressure();
    assert.equal(session.isPressurePaused, true);

    socket.bufferedAmount = 20;
    session.checkPressure();
    assert.equal(session.isPressurePaused, false);
    const resumed = session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
    assert.equal(resumed.framesSent, 1);
    assert.equal(session.transportStats.framesDropped, 1);
    assert.equal(session.transportStats.audioDroppedMs, 20);
    assert.deepEqual(flow.map((event) => event.paused), [true, false]);
  });

  it('drops and measures a large congested input synchronously without retaining a frame queue', async () => {
    const socket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const session = new SttSession({
      start,
      socketFactory: () => socket,
      highWatermarkBytes: 100,
      lowWatermarkBytes: 20,
      sustainedCongestionMs: 1_000,
      now: () => scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    });
    await openReady(session, socket);
    socket.bufferedAmount = 100;

    const delivery = session.sendPcm(new Uint8Array(STT_FRAME_BYTES * 500));

    assert.equal(delivery.framesProduced, 500);
    assert.equal(delivery.framesDropped, 500);
    assert.equal(socket.binaryMessages.length, 0);
    assert.equal(session.transportStats.audioDroppedMs, 10_000);
    session.destroy();
  });

  it('stops and flushes once when congestion is sustained and exposes dropped audio', async () => {
    const socket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const session = new SttSession({
      start,
      socketFactory: () => socket,
      highWatermarkBytes: 100,
      lowWatermarkBytes: 20,
      sustainedCongestionMs: 100,
      pressurePollMs: 25,
      finalTimeoutMs: 1_000,
      now: () => scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    });
    await openReady(session, socket);
    const completion = session.completion();

    socket.bufferedAmount = 100;
    session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
    scheduler.advance(100);

    assert.equal(session.state, 'flushing');
    assert.equal(countControls(socket, 'flush'), 1);
    assert.equal(socket.jsonMessages.at(-1).reason, 'client_shutdown');
    assert.equal(session.transportStats.congestionStops, 1);

    socket.message(finalEvent('provider_final'));
    const result = await completion;
    assert.equal(result.finality, 'provider_final');
    assert.equal(result.audioDroppedMs, 20);
    assert.equal(result.degraded, true);
    assert.equal(canAutoSubmitSttFinal(result), false);
    assert.equal(isReviewableSttFinal(result), true);
  });

  it('counts a synchronous binary send failure before snapshotting the degraded final', async () => {
    const socket = new FakeSocket();
    const session = new SttSession({ start, socketFactory: () => socket });
    await openReady(session, socket);
    socket.message(partialEvent('editable partial'));
    socket.throwOnBinary = true;
    const completion = session.completion();

    const delivery = session.sendPcm(new Uint8Array(STT_FRAME_BYTES));
    const result = await completion;

    assert.equal(delivery.framesDropped, 1);
    assert.equal(result.finality, 'connection_lost_partial');
    assert.equal(result.transport.framesDropped, 1);
    assert.equal(result.transport.audioDroppedMs, 20);
    assert.equal(result.audioDroppedMs, 20);
  });

  it('flushes exactly once, resets a finalized utterance, and cancels exactly once', async () => {
    const socket = new FakeSocket();
    const session = new SttSession({ start, socketFactory: () => socket });
    await openReady(session, socket);

    const first = session.stop('user_stop');
    const second = session.stop('vad_silence');
    assert.strictEqual(first, second);
    assert.equal(countControls(socket, 'flush'), 1);

    socket.message(finalEvent('provider_final'));
    const result = await first;
    assert.equal(canAutoSubmitSttFinal(result), true);
    assert.equal(session.reset(), true);
    assert.equal(countControls(socket, 'reset'), 1);
    assert.equal(session.state, 'ready');

    const cancelled = session.cancel();
    session.cancel();
    assert.equal(cancelled.finality, 'cancelled');
    assert.equal(cancelled.text, '');
    assert.equal(countControls(socket, 'cancel'), 1);
    assert.equal(canAutoSubmitSttFinal(cancelled), false);
    assert.equal(isReviewableSttFinal(cancelled), false);
  });

  it('returns tagged degraded partials on close and final timeout without ordinary promotion', async () => {
    const closedSocket = new FakeSocket();
    const closedSession = new SttSession({ start, socketFactory: () => closedSocket });
    await openReady(closedSession, closedSocket);
    closedSocket.message(partialEvent('create a release'));
    const closedCompletion = closedSession.completion();
    closedSocket.serverClose();
    const closed = await closedCompletion;
    assert.equal(closed.finality, 'connection_lost_partial');
    assert.equal(closed.text, 'create a release');
    assert.equal(canAutoSubmitSttFinal(closed), false);
    assert.equal(isReviewableSttFinal(closed), true);

    const errorSocket = new FakeSocket();
    const errorSession = new SttSession({ start, socketFactory: () => errorSocket });
    await openReady(errorSession, errorSocket);
    errorSocket.message(partialEvent('editable partial'));
    const errorCompletion = errorSession.completion();
    errorSocket.error();
    const errored = await errorCompletion;
    assert.equal(errored.finality, 'connection_lost_partial');
    assert.equal(errored.text, 'editable partial');
    assert.equal(canAutoSubmitSttFinal(errored), false);

    const timeoutSocket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const timeoutSession = new SttSession({
      start,
      socketFactory: () => timeoutSocket,
      finalTimeoutMs: 100,
      now: () => scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    });
    await openReady(timeoutSession, timeoutSocket);
    timeoutSocket.message(partialEvent('draft command'));
    const timed = timeoutSession.stop('user_stop');
    scheduler.advance(100);
    const timeout = await timed;
    assert.equal(timeout.finality, 'partial_timeout');
    assert.equal(timeout.text, 'draft command');
    assert.equal(canAutoSubmitSttFinal(timeout), false);
  });

  it('classifies recovered finals and releases listeners and socket state on destroy', async () => {
    const socket = new FakeSocket();
    const session = new SttSession({ start, socketFactory: () => socket });
    await openReady(session, socket);
    const completion = session.completion();

    session.destroy();

    const cancelled = await completion;
    assert.equal(cancelled.finality, 'cancelled');
    assert.equal(socket.listenerCount, 0);
    assert.equal(socket.closeCalls, 1);
    assert.equal(session.state, 'closed');

    const recovered = {
      ...cancelled,
      text: 'safe recovered command',
      finality: 'local_recovered_final',
      audioDroppedMs: 0,
      degraded: false,
    };
    assert.equal(isAuthoritativeSttFinalResult(recovered), true);
    assert.equal(canAutoSubmitSttFinal(recovered), true);
  });

  it('settles completion when destroyed from idle or while connecting', async () => {
    const idleSession = new SttSession({ start, socketFactory: () => new FakeSocket() });
    const idleCompletion = idleSession.completion();
    idleSession.destroy();
    assert.equal((await idleCompletion).finality, 'cancelled');
    assert.equal(idleSession.state, 'closed');

    const socket = new FakeSocket();
    const connectingSession = new SttSession({ start, socketFactory: () => socket });
    const opening = connectingSession.open();
    const connectingCompletion = connectingSession.completion();
    connectingSession.destroy();

    await assert.rejects(opening, (error) => error.code === 'STT_CANCELLED');
    assert.equal((await connectingCompletion).finality, 'cancelled');
    assert.equal(connectingSession.state, 'closed');
    assert.equal(socket.listenerCount, 0);
    assert.equal(socket.closeCalls, 1);
  });
});

async function openReady(session, socket) {
  const opening = session.open();
  socket.open();
  socket.message(readyEvent(300));
  await opening;
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

function partialEvent(text) {
  return {
    type: 'partial',
    sequence: 1,
    text,
    committedText: text,
    unstableText: '',
    audioReceivedMs: 500,
  };
}

function finalEvent(finality) {
  return {
    type: 'final',
    text: 'create a release plan',
    finality,
    provider: 'faster_whisper',
    model: 'distil-small.en',
    durationMs: 1_000,
    latencyMs: 100,
    fallbackUsed: finality === 'local_recovered_final',
    audioDroppedMs: 0,
  };
}

function countControls(socket, type) {
  return socket.jsonMessages.filter((message) => message.type === type).length;
}

class FakeSocket {
  readyState = 0;
  bufferedAmount = 0;
  binaryType = 'blob';
  closeCalls = 0;
  throwOnBinary = false;
  sent = [];
  listeners = new Map();

  get jsonMessages() {
    return this.sent
      .filter((message) => typeof message === 'string')
      .map((message) => JSON.parse(message));
  }

  get binaryMessages() {
    return this.sent.filter((message) => message instanceof ArrayBuffer);
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data) {
    if (this.readyState !== 1) throw new Error('socket not open');
    if (this.throwOnBinary && data instanceof ArrayBuffer) throw new Error('send failed');
    this.sent.push(data);
  }

  close() {
    this.closeCalls += 1;
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.dispatch('open', {});
  }

  message(value) {
    this.dispatch('message', { data: JSON.stringify(value) });
  }

  serverClose() {
    this.readyState = 3;
    this.dispatch('close', {});
  }

  error() {
    this.dispatch('error', {});
  }

  dispatch(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class ManualScheduler {
  now = 0;
  tasks = [];

  get activeTaskCount() {
    return this.tasks.filter((task) => !task.cancelled).length;
  }

  schedule = (callback, delayMs) => {
    const task = { callback, at: this.now + delayMs, cancelled: false };
    this.tasks.push(task);
    return task;
  };

  cancel = (task) => {
    task.cancelled = true;
  };

  advance(milliseconds) {
    const target = this.now + milliseconds;
    while (true) {
      const next = this.tasks
        .filter((task) => !task.cancelled && task.at <= target)
        .sort((left, right) => left.at - right.at)[0];
      if (!next) break;
      next.cancelled = true;
      this.now = next.at;
      next.callback();
    }
    this.now = target;
  }
}

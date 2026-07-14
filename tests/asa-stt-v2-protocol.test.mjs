import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SttProtocolError,
  isAuthoritativeSttFinality,
  parseSttClientControl,
  parseSttServerEvent,
  sttCorrelationMetadata,
} from '../src/lib/voice/stt-stream/protocol.ts';

const start = {
  type: 'start',
  protocolVersion: '2',
  sessionId: 'uuid',
  requestId: 'request-42',
  mode: 'command',
  provider: 'auto',
  audio: {
    sampleRate: 16000,
    channels: 1,
    sampleFormat: 's16le',
    frameDurationMs: 20,
  },
  language: 'en',
  prompt: 'Voice command for ASA inside Setara.',
  hotwords: ['ASA', 'Setara', 'Raksara'],
  maxDurationSeconds: 30,
};

describe('ASA STT WebSocket protocol v2', () => {
  it('parses the plan start and event examples', () => {
    assert.deepEqual(parseSttClientControl(JSON.stringify(start)), start);
    assert.equal(
      parseSttClientControl({ type: 'flush', reason: 'user_stop' }).reason,
      'user_stop',
    );
    assert.equal(parseSttClientControl({ type: 'reset' }).type, 'reset');
    assert.equal(parseSttClientControl({ type: 'cancel' }).type, 'cancel');

    assert.equal(
      parseSttServerEvent({
        type: 'ready',
        protocolVersion: '2',
        provider: 'faster_whisper',
        model: 'distil-small.en',
        supportsPartials: true,
        maxDurationSeconds: 300,
      }).type,
      'ready',
    );
    assert.equal(
      parseSttServerEvent({
        type: 'partial',
        sequence: 18,
        text: 'create a release plan',
        committedText: 'create a release',
        unstableText: 'plan',
        audioReceivedMs: 4600,
      }).type,
      'partial',
    );
    assert.equal(
      parseSttServerEvent({
        type: 'final',
        text: 'create a release plan for Raksara',
        finality: 'provider_final',
        provider: 'faster_whisper',
        model: 'distil-small.en',
        durationMs: 6120,
        latencyMs: 840,
        fallbackUsed: false,
        audioDroppedMs: 0,
      }).type,
      'final',
    );
    assert.equal(
      parseSttServerEvent({
        type: 'error',
        code: 'STT_BACKPRESSURE',
        message: 'Audio could not be processed in real time.',
        retryable: true,
      }).type,
      'error',
    );
  });

  it('rejects incompatible versions, modes, formats, finality, provider policy, and oversize controls', () => {
    assertProtocolError({ ...start, protocolVersion: '1' }, 'STT_INVALID_MESSAGE');
    assertProtocolError({ ...start, mode: 'meeting' }, 'STT_INVALID_MESSAGE');
    assertProtocolError(
      { ...start, audio: { ...start.audio, sampleRate: 48000 } },
      'STT_INVALID_MESSAGE',
    );
    assertProtocolError({ ...start, provider: 'openai' }, 'STT_PROVIDER_NOT_ALLOWED');
    assert.equal(
      parseSttClientControl({ ...start, provider: 'openai' }, { allowProviderOverride: true }).provider,
      'openai',
    );
    assert.throws(
      () => parseSttClientControl(JSON.stringify({ ...start, prompt: 'x'.repeat(8_192) })),
      (error) => error instanceof SttProtocolError && error.code === 'STT_CONTROL_TOO_LARGE',
    );
    assert.throws(
      () =>
        parseSttServerEvent({
          type: 'final',
          text: 'unsafe',
          finality: 'guessed_final',
          provider: 'faster_whisper',
          model: 'distil-small.en',
          durationMs: 1,
          latencyMs: 1,
          fallbackUsed: false,
          audioDroppedMs: 0,
        }),
      (error) => error instanceof SttProtocolError && error.code === 'STT_INVALID_MESSAGE',
    );
  });

  it('marks only authoritative finalities and exposes ID-only correlation metadata', () => {
    assert.equal(isAuthoritativeSttFinality('provider_final'), true);
    assert.equal(isAuthoritativeSttFinality('local_recovered_final'), true);
    assert.equal(isAuthoritativeSttFinality('partial_timeout'), false);
    assert.deepEqual(sttCorrelationMetadata(parseSttClientControl(start), 'core-relay'), {
      requestId: 'request-42',
      sessionId: 'uuid',
      clientId: 'core-relay',
    });
    assert.equal('text' in sttCorrelationMetadata(parseSttClientControl(start)), false);
    assert.equal('audio' in sttCorrelationMetadata(parseSttClientControl(start)), false);
  });

  it('normalizes bounded identity fields and rejects whitespace-only values', () => {
    assert.equal(parseSttClientControl({ ...start, provider: ' auto ' }).provider, 'auto');
    const ready = parseSttServerEvent({
      type: 'ready',
      protocolVersion: '2',
      provider: ' faster_whisper ',
      model: ' distil-small.en ',
      supportsPartials: true,
      maxDurationSeconds: 300,
    });
    assert.equal(ready.provider, 'faster_whisper');
    assert.equal(ready.model, 'distil-small.en');
    const error = parseSttServerEvent({
      type: 'error',
      code: ' STT_BACKPRESSURE ',
      message: ' Audio could not be processed. ',
      retryable: true,
    });
    assert.equal(error.code, 'STT_BACKPRESSURE');
    assert.equal(error.message, 'Audio could not be processed.');

    for (const field of ['code', 'message']) {
      assert.throws(
        () =>
          parseSttServerEvent({
            type: 'error',
            code: 'STT_BACKPRESSURE',
            message: 'stream failed',
            retryable: true,
            [field]: '   ',
          }),
        (protocolError) =>
          protocolError instanceof SttProtocolError &&
          protocolError.code === 'STT_INVALID_MESSAGE',
      );
    }
    for (const field of ['provider', 'model']) {
      assert.throws(
        () =>
          parseSttServerEvent({
            type: 'ready',
            protocolVersion: '2',
            provider: 'faster_whisper',
            model: 'distil-small.en',
            supportsPartials: true,
            maxDurationSeconds: 300,
            [field]: '   ',
          }),
        (protocolError) =>
          protocolError instanceof SttProtocolError &&
          protocolError.code === 'STT_INVALID_MESSAGE',
      );
    }
  });
});

function assertProtocolError(value, code) {
  assert.throws(
    () => parseSttClientControl(value),
    (error) => error instanceof SttProtocolError && error.code === code,
  );
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PcmRingBuffer } from '../src/lib/voice/audio/pcm-ring-buffer.ts';

function samples(...values) {
  return Int16Array.from(values);
}

describe('PcmRingBuffer', () => {
  it('withholds a frame until enough samples have been pushed', () => {
    const ring = new PcmRingBuffer(100);
    ring.push(samples(1, 2, 3));
    assert.equal(ring.takeFrame(5), null);
    ring.push(samples(4, 5));
    assert.deepEqual(Array.from(ring.takeFrame(5)), [1, 2, 3, 4, 5]);
    assert.equal(ring.available, 0);
  });

  it('preserves exact sample order across many small pushes (arbitrary quantum sizes)', () => {
    const ring = new PcmRingBuffer(50);
    const chunkSizes = [1, 3, 7, 2, 5];
    let next = 0;
    for (const size of chunkSizes) {
      const chunk = Int16Array.from({ length: size }, () => next++);
      ring.push(chunk);
    }
    const frame = ring.takeFrame(chunkSizes.reduce((a, b) => a + b, 0));
    assert.deepEqual(Array.from(frame), Array.from({ length: next }, (_, i) => i));
  });

  it('drops the oldest samples and counts an overrun once capacity is exceeded (main-thread stall)', () => {
    const ring = new PcmRingBuffer(10);
    // Simulate a stalled drain: push far more than capacity before anything is read.
    for (let batch = 0; batch < 5; batch++) {
      ring.push(Int16Array.from({ length: 4 }, (_, i) => batch * 4 + i));
    }
    assert.equal(ring.available, 10);
    assert.ok(ring.overruns > 0, 'expected overrun to be counted once capacity was exceeded');
    // The buffer must still hold the most recent samples, not garbage — PCM is preserved, not lost.
    const frame = ring.takeFrame(10);
    assert.deepEqual(Array.from(frame), Array.from({ length: 10 }, (_, i) => 10 + i));
  });

  it('keeps only the most recent capacity worth of samples when a single push exceeds capacity', () => {
    const ring = new PcmRingBuffer(5);
    ring.push(Int16Array.from({ length: 12 }, (_, i) => i));
    assert.equal(ring.available, 5);
    assert.ok(ring.overruns > 0);
    assert.deepEqual(Array.from(ring.takeFrame(5)), [7, 8, 9, 10, 11]);
  });

  it('clear() resets available samples without touching the overrun counter', () => {
    const ring = new PcmRingBuffer(4);
    ring.push(samples(1, 2, 3, 4, 5, 6)); // triggers one overrun
    const overrunsBefore = ring.overruns;
    ring.clear();
    assert.equal(ring.available, 0);
    assert.equal(ring.overruns, overrunsBefore);
  });

  it('rejects a non-positive capacity', () => {
    assert.throws(() => new PcmRingBuffer(0));
  });
});

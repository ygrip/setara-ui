import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript } from '../src/lib/voice/transcript-normalizer.ts';

describe('normalizeTranscript', () => {
  const versions = [
    ['version one point zero point one', 'version 1.0.1'],
    ['one point zero point one', '1.0.1'],
    ['Version nineteen point twenty-one point one hundred', 'Version 19.21.100'],
    ['release thirty point forty two!', 'release 30.42!']
  ];

  for (const [input, expected] of versions) {
    it(`normalizes semantic version: ${input}`, () => {
      const result = normalizeTranscript(input);
      assert.equal(result.rawText, input);
      assert.equal(result.normalizedText, expected);
      assert.ok(result.appliedRules.includes('semantic-version'));
    });
  }

  const sprints = [
    ['sprint zero', 'sprint 0'],
    ['Sprint twenty four', 'Sprint 24'],
    ['sprint ninety-nine', 'sprint 99'],
    ['sprint one hundred, please', 'sprint 100, please']
  ];

  for (const [input, expected] of sprints) {
    it(`normalizes sprint number: ${input}`, () => {
      assert.equal(normalizeTranscript(input).normalizedText, expected);
    });
  }

  it('canonicalizes whitespace and punctuation boundaries', () => {
    const result = normalizeTranscript('  create   build  one point two ,then test!Now  ');
    assert.equal(result.normalizedText, 'create build 1.2, then test! Now');
    assert.deepEqual(result.appliedRules, ['whitespace', 'punctuation-spacing', 'semantic-version']);
  });

  it('preserves unrelated prose, digits, and entity spelling', () => {
    const input = 'Create one build for Raksara Core with twenty reviewers.';
    assert.deepEqual(normalizeTranscript(input), {
      rawText: input,
      normalizedText: input,
      appliedRules: []
    });
  });

  it('does not convert malformed or out-of-grammar number phrases', () => {
    const input = 'version one point point two; sprint hundred five; one hundred one items';
    assert.equal(normalizeTranscript(input).normalizedText, input);
  });

  it('falls back to language-neutral cleanup for non-English input', () => {
    const result = normalizeTranscript('  sprint twenty four , versi one point two  ', 'id-ID');
    assert.equal(result.normalizedText, 'sprint twenty four, versi one point two');
    assert.deepEqual(result.appliedRules, ['whitespace', 'punctuation-spacing']);
  });

  it('is deterministic and idempotent', () => {
    const first = normalizeTranscript('  Sprint twenty-one : version one point zero  ');
    const second = normalizeTranscript(first.normalizedText);
    assert.equal(second.normalizedText, first.normalizedText);
    assert.deepEqual(second.appliedRules, []);
    assert.deepEqual(normalizeTranscript(first.rawText), first);
  });

  it('handles empty and whitespace-only input', () => {
    assert.deepEqual(normalizeTranscript(''), { rawText: '', normalizedText: '', appliedRules: [] });
    assert.deepEqual(normalizeTranscript('   '), {
      rawText: '   ',
      normalizedText: '',
      appliedRules: ['whitespace']
    });
  });
});

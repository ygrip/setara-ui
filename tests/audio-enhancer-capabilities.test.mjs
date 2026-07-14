import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectEnhancerCapabilities,
  resetEnhancerCapabilityCache,
} from '../src/lib/voice/audio/enhancer/enhancer-capabilities.ts';

describe('detectEnhancerCapabilities (setara-f05x.10)', () => {
  it('reports no support at all outside a browser (no AudioContext/AudioWorkletNode global)', () => {
    resetEnhancerCapabilityCache();
    const capabilities = detectEnhancerCapabilities();
    assert.equal(capabilities.audioWorklet, false);
    assert.equal(capabilities.speexSupported, false);
    assert.equal(capabilities.rnnoiseSupported, false);
  });

  it('detects WASM SIMD support via the standard minimal-module probe', () => {
    resetEnhancerCapabilityCache();
    const capabilities = detectEnhancerCapabilities();
    // Node's V8 supports the WASM SIMD proposal, so this should resolve true in the test runner.
    assert.equal(typeof capabilities.wasmSimd, 'boolean');
    assert.equal(capabilities.wasm, true);
  });

  it('never throws if WebAssembly.validate rejects the probe bytes', () => {
    resetEnhancerCapabilityCache();
    const original = WebAssembly.validate;
    WebAssembly.validate = () => {
      throw new Error('boom');
    };
    try {
      const capabilities = detectEnhancerCapabilities();
      assert.equal(capabilities.wasmSimd, false);
    } finally {
      WebAssembly.validate = original;
      resetEnhancerCapabilityCache();
    }
  });
});

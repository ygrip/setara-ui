export interface EnhancerCapabilities {
  audioWorklet: boolean;
  wasm: boolean;
  wasmSimd: boolean;
  speexSupported: boolean;
  rnnoiseSupported: boolean;
}

// The canonical minimal-module SIMD probe (also used by the `wasm-feature-detect` package):
// a single function returning a v128 constant, valid only under the SIMD proposal.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  26, 11,
]);

let cachedSimd: boolean | null = null;

function detectWasmSimd(): boolean {
  if (cachedSimd !== null) return cachedSimd;
  try {
    cachedSimd = typeof WebAssembly !== 'undefined' && WebAssembly.validate(SIMD_PROBE);
  } catch {
    cachedSimd = false;
  }
  return cachedSimd;
}

export function detectEnhancerCapabilities(): EnhancerCapabilities {
  const audioWorklet =
    typeof window !== 'undefined' &&
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    'audioWorklet' in AudioContext.prototype;
  const wasm = typeof WebAssembly !== 'undefined';
  const wasmSimd = wasm && detectWasmSimd();

  return {
    audioWorklet,
    wasm,
    wasmSimd,
    speexSupported: audioWorklet && wasm,
    rnnoiseSupported: audioWorklet && wasm,
  };
}

/** Test-only: clears the memoized SIMD probe result. */
export function resetEnhancerCapabilityCache(): void {
  cachedSimd = null;
}

// Shared between the Speex and RNNoise enhancers (setara-f05x.10/.11): AudioWorklet modules can
// only be added once per BaseAudioContext, and WASM binaries are unnecessary to re-fetch once
// loaded. Cache both per browser session so repeated `initialize()` calls (new utterance, mode
// re-selection) are cheap and never re-register the same processor name twice.
const loadedWorkletModules = new WeakMap<AudioContext, Set<string>>();

export async function ensureWorkletModuleLoaded(context: AudioContext, workletUrl: string): Promise<void> {
  let loaded = loadedWorkletModules.get(context);
  if (!loaded) {
    loaded = new Set();
    loadedWorkletModules.set(context, loaded);
  }
  if (loaded.has(workletUrl)) return;
  await context.audioWorklet.addModule(workletUrl);
  loaded.add(workletUrl);
}

/** Memoizes an async loader. A failed attempt is not cached, so the next call retries cleanly. */
export function memoizeAsync<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (!cached) {
      cached = loader().catch((error: unknown) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  };
}

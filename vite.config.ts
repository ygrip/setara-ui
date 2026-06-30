import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';

// Self-host the @ricky0123/vad-web (Silero) model + onnxruntime-web wasm flat under /vad/ so
// hands-free VAD works on air-gapped/on-prem deployments (no CDN). Loaded lazily only when
// hands-free arms. We only ship the single-thread WASM (numThreads=1 in ml-vad.ts → no jsep,
// no SharedArrayBuffer/COOP-COEP). vite-plugin-static-copy preserved the node_modules/ path
// under dest, so we copy flat ourselves.
const VAD_ASSETS: Array<[string, string]> = [
  ['node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js', 'vad.worklet.bundle.min.js'],
  ['node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx', 'silero_vad_v5.onnx'],
  ['node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx', 'silero_vad_legacy.onnx'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.wasm'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.mjs'],
];
const VAD_MIME: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm' };
function copyVadAssetsPlugin() {
  return {
    name: 'copy-vad-assets',
    // Build: copy flat into the client output (served at /vad/<file>).
    writeBundle() {
      const out = '.svelte-kit/output/client/vad';
      mkdirSync(out, { recursive: true });
      for (const [src, name] of VAD_ASSETS) copyFileSync(src, join(out, name));
    },
    // Dev: serve straight from node_modules so we don't commit 16MB of binaries to git.
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b?: Buffer) => void; statusCode: number }, next: () => void) => void) => void } }) {
      const byName = new Map(VAD_ASSETS.map(([src, name]) => [name, src]));
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/vad\/([^/?]+)/);
        const src = m && byName.get(m[1]);
        if (!src) return next();
        const ext = m![1].slice(m![1].lastIndexOf('.'));
        res.setHeader('Content-Type', VAD_MIME[ext] ?? 'application/octet-stream');
        try { res.end(readFileSync(src)); } catch { res.statusCode = 404; res.end(); }
      });
    }
  };
}

function pruneUnusedSvelteKitServerImport() {
  return {
    name: 'prune-unused-sveltekit-server-import',
    apply: 'build' as const,
    closeBundle() {
      const file = '.svelte-kit/output/server/index.js';
      let code: string;
      try {
        code = readFileSync(file, 'utf8');
      } catch {
        return;
      }
      const occurrences = code.match(/try_get_request_store/g)?.length ?? 0;
      if (occurrences !== 1) return;
      const next = code.replace(
        'import { with_request_store, merge_tracing, try_get_request_store } from "@sveltejs/kit/internal/server";',
        'import { with_request_store, merge_tracing } from "@sveltejs/kit/internal/server";'
      );
      if (next !== code) writeFileSync(file, next);
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    copyVadAssetsPlugin(),
    pruneUnusedSvelteKitServerImport(),
    sveltekit(),
  ],
  ssr: {
    // layercake ships uncompiled .svelte files in dist/; tell Vite to bundle
    // them through the Svelte plugin instead of letting Node's ESM loader fail.
    noExternal: ['layerchart', 'layercake']
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@revolist')) return 'vendor-revogrid';
          if (id.includes('chart.js')) return 'vendor-charts';
          if (id.includes('highlight.js') || id.includes('marked')) return 'vendor-markdown';
if (id.includes('@melt-ui') || id.includes('bits-ui') || id.includes('formsnap') || id.includes('sveltekit-superforms')) {
            return 'vendor-ui-primitives';
          }
          if (id.includes('@tanstack')) return 'vendor-table';
        }
      },
      onwarn(warning, warn) {
        if (
          warning.message.includes('"try_get_request_store" is imported from external module "@sveltejs/kit/internal/server" but never used')
        ) {
          return;
        }
        warn(warning);
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    headers: {
      // Required for SharedArrayBuffer (ort-wasm-simd-threaded.mjs initializes it unconditionally).
      // 'credentialless' instead of 'require-corp' so cross-origin resources (fonts etc.) keep working.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'humvee-dramatize-uncured.ngrok-free.dev',
      '.ngrok-free.dev'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
});

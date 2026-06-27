import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { createReadStream, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';

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

function sherpaOnnxAssets(): Plugin {
  const sourceDir = resolve('node_modules/@runanywhere/web-onnx/wasm/sherpa');
  const contentTypes: Record<string, string> = {
    '.js': 'text/javascript; charset=utf-8',
    '.wasm': 'application/wasm'
  };

  return {
    name: 'sherpa-onnx-assets',
    configureServer(server) {
      server.middlewares.use('/sherpa', (request, response, next) => {
        const filename = request.url?.split('?')[0].replace(/^\//, '');
        if (!filename || filename.includes('..')) return next();
        const file = join(sourceDir, filename);
        if (!existsSync(file)) return next();
        response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(response);
      });
    },
    generateBundle() {
      for (const filename of readdirSync(sourceDir)) {
        const file = join(sourceDir, filename);
        this.emitFile({
          type: 'asset',
          fileName: `sherpa/${filename}`,
          source: readFileSync(file)
        });
      }
    }
  };
}

const ORT_WASM_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];
const VAD_STATIC_FILES = ['silero_vad_legacy.onnx', 'silero_vad_v5.onnx', 'vad.worklet.bundle.min.js'];

function serveStaticDir(server: ViteDevServer, urlPrefix: string, dir: string, allowList?: string[]) {
  const mime: Record<string, string> = {
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.wasm': 'application/wasm',
    '.onnx': 'application/octet-stream',
  };
  server.middlewares.use(urlPrefix, (req, res, next) => {
    const filename = req.url?.split('?')[0].replace(/^\//, '');
    if (!filename || filename.includes('..')) return next();
    if (allowList && !allowList.includes(filename)) return next();
    const file = join(dir, filename);
    if (!existsSync(file)) return next();
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
}

function voiceWasmAssets(): Plugin {
  const ortDir = resolve('node_modules/onnxruntime-web/dist');
  const ortMsDir = resolve('node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist');
  const vadDir = resolve('node_modules/@ricky0123/vad-web/dist');

  return {
    name: 'voice-wasm-assets',
    configureServer(server) {
      serveStaticDir(server, '/ort', ortDir, ORT_WASM_FILES);
      serveStaticDir(server, '/ort-ms', ortMsDir, ORT_WASM_FILES);
      serveStaticDir(server, '/vad', vadDir, VAD_STATIC_FILES);
    },
    generateBundle() {
      for (const f of ORT_WASM_FILES) {
        const full = join(ortDir, f);
        if (existsSync(full)) this.emitFile({ type: 'asset', fileName: `ort/${f}`, source: readFileSync(full) });
      }
      for (const f of ORT_WASM_FILES) {
        const full = join(ortMsDir, f);
        if (existsSync(full)) this.emitFile({ type: 'asset', fileName: `ort-ms/${f}`, source: readFileSync(full) });
      }
      for (const f of VAD_STATIC_FILES) {
        const full = join(vadDir, f);
        if (existsSync(full)) this.emitFile({ type: 'asset', fileName: `vad/${f}`, source: readFileSync(full) });
      }
    }
  };
}

/**
 * Patches @moonshine-ai/moonshine-js bundle: the bundled onnxruntime-web 1.22.0-dev
 * hardcodes CDN wasmPaths which COEP (Cross-Origin-Embedder-Policy) blocks at runtime.
 * Replace with local /ort-ms/ path served by voiceWasmAssets().
 */
function patchMoonshineOrtCdn(): Plugin {
  return {
    name: 'patch-moonshine-ort-cdn',
    enforce: 'pre',
    load(id) {
      if (!id.includes('@moonshine-ai/moonshine-js')) return null;
      const filePath = id.split('?')[0];
      const code = readFileSync(filePath, 'utf8');
      if (!code.includes('cdn.jsdelivr.net')) return null;
      return code.replace(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@[^"']+\/dist\//g,
        '/ort-ms/'
      );
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    sherpaOnnxAssets(),
    voiceWasmAssets(),
    patchMoonshineOrtCdn(),
    pruneUnusedSvelteKitServerImport(),
    sveltekit(),
  ],
  optimizeDeps: {
    exclude: ['@moonshine-ai/moonshine-js'],
  },
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
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});

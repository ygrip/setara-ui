import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';

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
  plugins: [pruneUnusedSvelteKitServerImport(), sveltekit()],
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
    port: 5173
  }
});

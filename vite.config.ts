import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
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

export default defineConfig({
  plugins: [tailwindcss(), pruneUnusedSvelteKitServerImport(), sveltekit()],
  ssr: {
    // layercake ships uncompiled .svelte files in dist/; tell Vite to bundle
    // them through the Svelte plugin instead of letting Node's ESM loader fail.
    noExternal: ['layerchart', 'layercake', 'flowbite-svelte']
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
          if (id.includes('flowbite')) return 'vendor-flowbite';
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

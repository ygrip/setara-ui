declare global {
  const __APP_VERSION__: string;
  const __BUILD_SHA__: string;

  namespace App {
  }
}

// @revolist/svelte-datagrid ships types at dist/lib/ but package.json "types"
// field points to non-existent dist/index.d.ts — shim it here.
declare module '@revolist/svelte-datagrid' {
  export * from '@revolist/svelte-datagrid/dist/lib/index';
}

// curtainsjs ships no type declarations at all.
declare module 'curtainsjs' {
  export const Curtains: any;
  export const Plane: any;
}

export {};

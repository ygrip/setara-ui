declare global {
  namespace App {
  }
}

// @revolist/svelte-datagrid ships types at dist/lib/ but package.json "types"
// field points to non-existent dist/index.d.ts — shim it here.
declare module '@revolist/svelte-datagrid' {
  export * from '@revolist/svelte-datagrid/dist/lib/index';
}

export {};

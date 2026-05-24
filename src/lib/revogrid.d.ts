/**
 * @revolist/svelte-datagrid packages its Svelte component wrapper but the
 * "types" field in package.json points to a non-existent file. This ambient
 * shim makes TypeScript and svelte-check resolve the module without errors.
 *
 * Rich column/type imports come from @revolist/revogrid which has correct types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module '@revolist/svelte-datagrid' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RevoGrid: any;
  export default RevoGrid;
  export { RevoGrid };
}

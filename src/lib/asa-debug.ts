/**
 * ASA debug logging. Enable with
 * `localStorage.setItem('asa.debug','1')` then reload. Use to trace the
 * voice/STT pipeline and the chat SSE stream when something silently fails.
 */
const enabled =
  (typeof localStorage !== 'undefined' && localStorage.getItem('asa.debug') === '1');

export function asaLog(scope: string, ...args: unknown[]): void {
  if (enabled) console.debug(`%c[asa:${scope}]`, 'color:#7c3aed', ...args);
}

export function asaWarn(scope: string, ...args: unknown[]): void {
  if (enabled) console.warn(`[asa:${scope}]`, ...args);
}

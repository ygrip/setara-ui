import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function loadStreamBatcher() {
  const source = read('src/lib/stores/stream-batcher.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const encoded = Buffer.from(output).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

describe('ASA stream batching', () => {
  it('coalesces many token chunks while preserving exact final content', async () => {
    const { StreamBatcher } = await loadStreamBatcher();
    const flushed = [];
    const scheduled = [];
    const cleared = [];
    let nextHandle = 1;

    const batcher = new StreamBatcher({
      delayMs: 50,
      onFlush: (content) => flushed.push(content),
      setTimeoutFn: (callback, delayMs) => {
        const handle = nextHandle++;
        scheduled.push({ handle, callback, delayMs });
        return handle;
      },
      clearTimeoutFn: (handle) => cleared.push(handle),
    });

    for (const token of ['A', 'S', 'A', ' ', 'reply']) {
      batcher.push(token);
    }

    assert.equal(flushed.length, 0);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delayMs, 50);

    scheduled[0].callback();
    assert.deepEqual(flushed, ['ASA reply']);

    batcher.push(' keeps');
    batcher.push(' exact');
    batcher.flush();

    assert.deepEqual(flushed, ['ASA reply', ' keeps exact']);
    assert.equal(flushed.join(''), 'ASA reply keeps exact');
    assert.ok(cleared.includes(2));
  });

  it('wires ASA store token events through the batcher and flushes terminal paths', () => {
    const store = read('src/lib/stores/asa.svelte.ts');

    assert.match(store, /const TOKEN_FLUSH_INTERVAL_MS = 50/);
    assert.match(store, /new StreamBatcher\(\{/);
    assert.match(store, /tokenBatcher\.push\(String\(event\.payload\.content \?\? ''\)\)/);
    assert.match(store, /case 'done':[\s\S]*?tokenBatcher\.flush\(\)/);
    assert.match(store, /case 'error':[\s\S]*?tokenBatcher\.flush\(\)/);
    assert.match(store, /cancel\(\) \{[\s\S]*?this\.flushActiveTokenBuffer\?\.\(\)/);
  });

  it('invokes browser timers through globalThis so Firefox keeps the required receiver', () => {
    const batcher = read('src/lib/stores/stream-batcher.ts');

    assert.match(batcher, /globalThis\.setTimeout\(callback, delayMs\)/);
    assert.match(batcher, /globalThis\.clearTimeout\(handle\)/);
  });

  it('reconciles a missing or partial token stream with the authoritative completed content', async () => {
    const { reconcileCompletedContent } = await loadStreamBatcher();

    assert.equal(reconcileCompletedContent('', 'Complete answer'), 'Complete answer');
    assert.equal(reconcileCompletedContent('**Partial', '**Complete answer**'), '**Complete answer**');
    assert.equal(reconcileCompletedContent('Complete answer', ''), 'Complete answer');
  });
});

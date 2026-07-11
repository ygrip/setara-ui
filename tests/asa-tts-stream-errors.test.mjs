import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadStreamErrors() {
  const source = readFileSync(join(root, 'src/lib/voice/stream-errors.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

describe('ASA TTS stream errors', () => {
  it('treats Firefox NS_BASE_STREAM_CLOSED as EOF only after audio data arrived', async () => {
    const { classifyPcmStreamError } = await loadStreamErrors();
    const firefoxClosed = new TypeError('NetworkError: Network request failed (NS_BASE_STREAM_CLOSED)');

    assert.equal(classifyPcmStreamError(firefoxClosed, 2048), 'eof');
    assert.equal(classifyPcmStreamError(firefoxClosed, 0), 'fallback');
    assert.equal(classifyPcmStreamError(new Error('decoder failed'), 2048), 'failed');
  });
});

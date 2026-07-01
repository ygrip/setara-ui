import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadAccumulator() {
  const source = readFileSync(join(root, 'src/lib/stores/asa-turn-accumulator.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

describe('ASA backend event replay', () => {
  it('applies every streamed token exactly once through the render batch', () => {
    const store = readFileSync(join(root, 'src/lib/stores/asa.svelte.ts'), 'utf8');
    const tokenCase = store.match(/case 'token': \{([\s\S]*?)break;/)?.[1] ?? '';

    assert.doesNotMatch(tokenCase, /turn\.apply\(event\)/);
    assert.match(tokenCase, /tokenBatcher\.push\(String\(event\.payload\.content \?\? ''\)\)/);
  });

  it('renders token chunks and reconciles the authoritative done content', async () => {
    const { AsaTurnAccumulator } = await loadAccumulator();
    const turn = new AsaTurnAccumulator();
    const events = [
      { eventType: 'timing', payload: { phase: 'routing_llm', durationMs: 13154 } },
      { eventType: 'thinking', payload: { content: 'Analyzing your request' } },
      { eventType: 'speech', payload: { text: 'Here is the answer.' } },
      { eventType: 'token', payload: { content: '**' } },
      { eventType: 'token', payload: { content: 'What I can do' } },
      { eventType: 'token', payload: { content: '**\n\n- Identify improvements.' } },
      { eventType: 'done', payload: { content: '**What I can do**\n\n- Identify improvements.' } },
    ];

    for (const event of events) turn.apply(event);

    assert.equal(turn.content, '**What I can do**\n\n- Identify improvements.');
    assert.equal(turn.thinkingText, null);
    assert.equal(turn.done, true);
  });

  it('never renders a streamed protocol separator as assistant content', async () => {
    const { AsaTurnAccumulator, normalizeAssistantContent } = await loadAccumulator();
    const turn = new AsaTurnAccumulator();

    turn.appendToken('===');
    assert.equal(turn.content, '');

    turn.appendToken('\n**Visible answer**');
    assert.equal(turn.content, '**Visible answer**');
    turn.apply({ eventType: 'done', payload: { content: '===BODY===\n**Visible answer**' } });
    assert.equal(turn.content, '**Visible answer**');
    assert.equal(normalizeAssistantContent('Spoken preamble\n===\n**History answer**'), '**History answer**');
  });
});

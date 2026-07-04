import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('ASA irreversible action confirmation', () => {
  it('renders approve and reject controls and returns only the signed token and decision', () => {
    const api = read('src/lib/api/asa.ts');
    const store = read('src/lib/stores/asa.svelte.ts');
    const orb = read('src/lib/components/AsaOrb.svelte');

    assert.match(api, /confirmationToken: opts\.confirmation\.token/);
    assert.match(api, /confirmationDecision: opts\.confirmation\.decision/);
    assert.match(store, /async confirmAction\(action: AsaAction, decision: 'APPROVE' \| 'REJECT'\)/);
    assert.match(store, /\{ token, decision \}/);
    assert.match(orb, /action\.type === 'confirm_required'/);
    assert.match(orb, /confirmAction\(action, 'REJECT'\)/);
    assert.match(orb, /confirmAction\(action, 'APPROVE'\)/);
  });
});

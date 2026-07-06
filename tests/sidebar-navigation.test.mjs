import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const layout = readFileSync(join(root, 'src/routes/(app)/+layout.svelte'), 'utf8');

describe('Sidebar navigation', () => {
  it('keeps primary navigation without pin controls or persisted pin state', () => {
    assert.doesNotMatch(layout, /setara_pinned/);
    assert.doesNotMatch(layout, /pinnedItems|pinOptions|togglePin|isPinned/);
    assert.doesNotMatch(layout, /class="pin-(?:btn|toggle)"/);
    assert.doesNotMatch(layout, />Pinned</);

    for (const label of ['Dashboard', 'Projects', 'Plans', 'Overview']) {
      assert.match(layout, new RegExp(`\\n\\s*${label}\\n`));
    }
  });

  it('preserves active and disabled navigation states', () => {
    assert.match(layout, /class:nav-item--active=/);
    assert.match(layout, /class:nav-item--dimmed=/);
    assert.match(layout, /aria-disabled=/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const card = readFileSync(join(root, 'src/lib/components/projects/ProjectCard.svelte'), 'utf8');
const progress = readFileSync(join(root, 'src/lib/components/projects/ProjectMetricProgress.svelte'), 'utf8');
const badge = readFileSync(join(root, 'src/lib/components/projects/ProjectStatusBadge.svelte'), 'utf8');

describe('Project health card', () => {
  it('communicates health and missing evidence without color-only meaning', () => {
    assert.match(card, /ProjectStatusBadge status=\{project\.healthStatus\}/);
    assert.match(card, /No runs yet/);
    assert.match(card, /project\.totalScenarios > 0[\s\S]*'N\/A'/);
    assert.match(badge, /presentation\.icon/);
    assert.match(badge, /text: 'Critical'/);
  });

  it('uses semantic progress and keyboard-safe whole-card navigation', () => {
    assert.match(progress, /role="progressbar"/);
    assert.match(progress, /aria-valuenow=\{boundedValue\}/);
    assert.match(card, /<a[\s\S]*href=\{`\/projects\/\$\{project\.projectKey\}`\}/);
    assert.match(card, /:focus-visible/);
  });
});

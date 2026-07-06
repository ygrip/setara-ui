import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, 'src/lib/api/statistics.ts'), 'utf8');

describe('Squad quality API', () => {
  it('uses one typed aggregate endpoint', () => {
    assert.match(source, /export type SquadQualityOverview/);
    assert.match(source, /apiFetch\(`\/api\/squads\/\$\{squadId\}\/quality-overview\$\{suffix\}`\)/);
  });

  it('keeps missing data and attention categories explicit in mock mode', () => {
    assert.match(source, /export async function createMockSquadQualityOverview/);
    assert.match(source, /totalScenarios > 0[\s\S]*: null/);
    assert.match(source, /finished > 0[\s\S]*: null/);
    assert.match(source, /noScenarios/);
    assert.match(source, /noRecentRun/);
    assert.match(source, /highFailureRate/);
  });
});

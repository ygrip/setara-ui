import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(join(root, 'src/routes/(app)/squads/[squadId]/+page.svelte'), 'utf8');
const loader = readFileSync(join(root, 'src/routes/(app)/squads/[squadId]/+page.ts'), 'utf8');

describe('Squad quality route', () => {
  it('loads one aggregate response and delegates section visuals', () => { assert.equal((loader.match(/await getSquadQualityOverview\(/g) ?? []).length, 1); for (const component of ['SquadHeader', 'SquadMetricStrip', 'OverallCoveragePanel', 'SquadTrendPanel', 'SquadNeedsAttention', 'SquadProjectsTable']) assert.match(page, new RegExp(`<${component}`)); });
  it('keeps range changes race-safe and preserves stale data', () => { assert.match(page, /const requestId = \+\+requestSequence/); assert.match(page, /requestId === requestSequence/); assert.match(page, /Showing the latest available view/); assert.match(page, /nextStart\.setUTCDate\(nextStart/); });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Critical component interaction guardrails', () => {
  it('keeps build verification guarded by execution and pass-rate checks', () => {
    const source = read('src/routes/(app)/projects/[projectKey]/builds/[buildId]/+page.svelte');

    assert.match(source, /function checkVerifyGate\(\): boolean/);
    assert.match(source, /latestStatus === 'NOT_EXECUTED'/);
    assert.match(source, /All scenarios must be executed before verifying/);
    assert.match(source, /passPercentage[\s\S]*< 80/);
    assert.match(source, /hasFailed[\s\S]*verifyNotesOpen = true/);
    assert.match(source, /disabled=\{verifying \|\| !verifyNotes\.trim\(\)\}/);
    assert.match(source, /verifyBuild\(data\.projectKey, build\.id/);
  });

  it('keeps release-plan close gated by verified builds and explicit notes flow', () => {
    const source = read('src/routes/(app)/squads/[squadId]/release-plans/[planId]/+page.svelte');

    assert.match(source, /const canClose = \$derived/);
    assert.match(source, /verifiedBuilds[\s\S]*totalBuilds/);
    assert.match(source, /disabled=\{!canClose \|\| busy\}/);
    assert.match(source, /Close Release Plan/);
    assert.match(source, /Sign-off Notes/);
    assert.match(source, /closeSquadPlan\(data\.squadId, data\.planId/);
  });

  it('keeps scenario creation AI suggestions editable, contextual, and non-blocking', () => {
    const source = read('src/routes/(app)/projects/[projectKey]/repository/scenarios/new/+page.svelte');

    assert.match(source, /suggestScenarioSteps/);
    assert.match(source, /scenarioName: name\.trim\(\)/);
    assert.match(source, /directoryNodeId: nodeId \|\| undefined/);
    assert.match(source, /tags: tags\.length > 0/);
    assert.match(source, /existingSteps: detailSteps\.filter/);
    assert.match(source, /AI-generated drafts — review and edit each step before saving/);
    assert.match(source, /SetaraStepGridEditor/);
    assert.match(source, /TagInput/);
    assert.match(source, /disabled=\{!name\.trim\(\) \|\| busy \|\| suggesting\}/);
  });

  it('keeps report export as a one-button menu with coherent error display', () => {
    const source = read('src/lib/components/ReportExportMenu.svelte');

    assert.match(source, /aria-haspopup="menu"/);
    assert.match(source, /handleExport\('pdf'\)/);
    assert.match(source, /handleExport\('xlsx'\)/);
    assert.match(source, /previewMode/);
    assert.match(source, /notify\.error/);
    assert.match(source, /Connect a live Setara backend to download reports/);
    assert.match(source, /Could not export/);
    assert.doesNotMatch(source, /window\.location\.href/);
  });

  it('keeps AI review loading and error states visible while requests run', () => {
    const source = read('src/lib/components/AiReviewPanel.svelte');

    assert.match(source, /AiThinkingPanel/);
    assert.match(source, /loading = true/);
    assert.match(source, /getApiBaseUrl/);
    assert.match(source, /fetch\(apiReviewUrl\(\), \{ method: 'POST', headers: authHeaders\(\) \}\)/);
    assert.match(source, /JSON\.parse\(data\) as AiReviewResult/);
    assert.match(source, /normalizeErrorMessage/);
    assert.match(source, /AppAlert tone="error"/);
    assert.match(source, /Request AI Review/);
    assert.match(source, /AI-generated analysis — always verify/);
  });
});

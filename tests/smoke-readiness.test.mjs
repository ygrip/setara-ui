import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Frontend smoke readiness', () => {
  it('keeps primary mock-mode routes present for browser smoke coverage', () => {
    const routes = [
      'src/routes/(app)/dashboard/+page.svelte',
      'src/routes/(app)/projects/+page.svelte',
      'src/routes/(app)/projects/[projectKey]/+page.svelte',
      'src/routes/(app)/projects/[projectKey]/repository/+page.svelte',
      'src/routes/(app)/projects/[projectKey]/repository/scenarios/new/+page.svelte',
      'src/routes/(app)/projects/[projectKey]/executions/+page.svelte',
      'src/routes/(app)/projects/[projectKey]/executions/[runId]/+page.svelte',
      'src/routes/(app)/squads/[squadId]/release-plans/+page.svelte',
      'src/routes/(app)/squads/[squadId]/release-plans/[planId]/+page.svelte'
    ];

    const missing = routes.filter((route) => !existsSync(join(root, route)));
    assert.deepEqual(missing, []);
  });

  it('keeps CI running fast frontend verification before build', () => {
    const workflow = read('.github/workflows/ci.yml');
    const checkIndex = workflow.indexOf('npm run check');
    const testIndex = workflow.indexOf('npm run test:ui');
    const buildIndex = workflow.indexOf('npm run build');

    assert.ok(checkIndex > -1, 'CI should run npm run check');
    assert.ok(testIndex > -1, 'CI should run npm run test:ui');
    assert.ok(buildIndex > -1, 'CI should run npm run build');
    assert.ok(checkIndex < buildIndex, 'check should run before build');
    assert.ok(testIndex < buildIndex, 'test:ui should run before build');
  });

  it('keeps Docker image runnable as non-root with health checks and runtime config args', () => {
    const dockerfile = read('Dockerfile');

    assert.match(dockerfile, /FROM node:22-alpine AS deps/);
    assert.match(dockerfile, /ARG VITE_SETARA_API_BASE_URL=/);
    assert.match(dockerfile, /ARG VITE_SETARA_WS_BASE_URL=/);
    assert.match(dockerfile, /USER node/);
    assert.match(dockerfile, /EXPOSE 3000/);
    assert.match(dockerfile, /HEALTHCHECK[\s\S]*localhost:3000\//);
    assert.match(dockerfile, /CMD \["node", "build"\]/);
  });

  it('keeps GHCR workflow configured for package publishing', () => {
    const workflow = read('.github/workflows/docker-publish.yml');

    assert.match(workflow, /REGISTRY: ghcr\.io/);
    assert.match(workflow, /packages: write/);
    assert.match(workflow, /docker\/login-action@v3/);
    assert.match(workflow, /docker\/metadata-action@v5/);
    assert.match(workflow, /docker\/build-push-action@v6/);
    assert.match(workflow, /type=sha/);
    assert.match(workflow, /type=raw,value=latest/);
  });
});

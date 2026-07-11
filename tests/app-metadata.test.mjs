import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('login and application footers use shared release metadata', () => {
  const login = read('src/routes/login/+page.svelte');
  const layout = read('src/routes/(app)/+layout.svelte');

  for (const source of [login, layout]) {
    assert.match(source, /APP_VERSION_LABEL/);
    assert.match(source, /APP_BUILD_LABEL/);
  }
  assert.doesNotMatch(layout, /v0\.1\.0/);
});

test('Docker publishing injects the source image build SHA', () => {
  assert.match(read('Dockerfile'), /ARG VITE_BUILD_SHA=dev/);
  assert.match(
    read('.github/workflows/docker-publish.yml'),
    /VITE_BUILD_SHA=\$\{\{ github\.sha \}\}/
  );
});

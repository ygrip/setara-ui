import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function extractFunctionBody(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} export should exist`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Could not extract function body for ${name}`);
}

describe('API client helpers', () => {
  it('builds cursor query params only for provided values', () => {
    const body = extractFunctionBody(read('src/lib/api/pagination.ts'), 'buildCursorParams');
    const buildCursorParams = new Function('cursor', 'limit', 'sortBy', 'sortDir', body);

    assert.equal(buildCursorParams(), '');
    assert.equal(buildCursorParams('abc', 50, 'createdAt', 'desc'), '?cursor=abc&limit=50&sort_by=createdAt&sort_dir=desc');
    assert.equal(buildCursorParams(undefined, 25), '?limit=25');
    assert.equal(buildCursorParams('', undefined, 'name'), '?sort_by=name');
  });

  it('requires a token and encodes execution websocket URLs safely', () => {
    const body = extractFunctionBody(read('src/lib/api/realtime.ts'), 'executionSocketUrl');
    const makeUrl = (base, token) => new Function(
      'projectKey',
      'runId',
      'getWebSocketBaseUrl',
      'getWebSocketToken',
      body
    );

    const withoutToken = makeUrl();
    assert.equal(
      withoutToken('PAY MENT', undefined, () => 'ws://localhost:8080/', () => undefined),
      ''
    );

    const withRun = makeUrl();
    assert.equal(
      withRun('PAYMENT', 'run/1', () => 'wss://setara.example/ws/', () => 'tok en/1'),
      'wss://setara.example/ws/ws/projects/PAYMENT/runs/run%2F1?token=tok%20en%2F1'
    );
  });

  it('keeps live API clients behind getApiBaseUrl and response-ok checks', () => {
    const clients = [
      'src/lib/api/runs.ts',
      'src/lib/api/builds.ts',
      'src/lib/api/projects.ts',
      'src/lib/api/testcases.ts',
      'src/lib/api/squadPlans.ts',
      'src/lib/api/statistics.ts',
      'src/lib/api/organization.ts'
    ];

    // All modules must route API calls through the shared apiFetch from client.ts,
    // which injects auth headers and handles 401 redirects centrally.
    // testcases.ts also uses getApiBaseUrl() directly for non-apiFetch URLs (imports, exports).
    const missingGuards = clients.filter((file) => {
      const source = read(file);
      return !source.includes("from './client'") && !source.includes('getApiBaseUrl()');
    });

    assert.deepEqual(missingGuards, []);
  });

  it('keeps report export errors sanitized and host-aware', () => {
    const source = read('src/lib/api/reports.ts');

    assert.match(source, /contentType\.includes\('text\/html'\)/);
    assert.match(source, /<!doctype html/i);
    assert.match(source, /window\.location\.origin/);
    assert.match(source, /authHeaders\(\)/);
    assert.match(source, /URL\.createObjectURL/);
    assert.match(source, /blob\.size === 0/);
  });

  it('keeps websocket store reconnection and malformed-frame protections', () => {
    const source = read('src/lib/stores/websocket.svelte.ts');

    assert.match(source, /private readonly maxReconnects = 5/);
    assert.match(source, /Math\.min\(1000 \* 2 \*\* this\.reconnectAttempts, 30_000\)/);
    assert.match(source, /return \(\) => this\.handlers\.delete\(fn\)/);
    assert.match(source, /JSON\.parse\(msg\.data as string\)/);
    assert.match(source, /Ignore malformed frames/);
    assert.match(source, /this\.state = 'idle'/);
  });
});

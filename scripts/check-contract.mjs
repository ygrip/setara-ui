#!/usr/bin/env node
/**
 * check-contract.mjs
 *
 * Fetches the live OpenAPI spec from a running backend and verifies that
 * the key paths and response shapes expected by the UI are still present.
 *
 * Usage:
 *   node scripts/check-contract.mjs [BACKEND_URL]
 *   # or
 *   npm run check:contract
 *
 * Set SETARA_API_URL env var to override the default http://localhost:8080.
 * Exit 0 = all checks pass. Exit 1 = spec unreachable or shape mismatch.
 */

const BASE_URL = process.env.SETARA_API_URL ?? process.argv[2] ?? 'http://localhost:8080';
const SPEC_URL = `${BASE_URL}/q/openapi`;

let passed = 0;
let failed = 0;

function ok(msg) { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++; }

async function fetchSpec() {
  const res = await fetch(SPEC_URL);
  if (!res.ok) throw new Error(`GET ${SPEC_URL} → ${res.status}`);
  const text = await res.text();
  // Quarkus returns YAML by default; parse it naively by looking for key strings
  return text;
}

function checkPath(spec, path) {
  if (spec.includes(`'${path}'`) || spec.includes(`"${path}"`) || spec.includes(`${path}:`)) {
    ok(`Spec includes path: ${path}`);
  } else {
    fail(`Spec MISSING path: ${path} — hand-written types may have drifted`);
  }
}

function checkField(spec, field, context) {
  if (spec.includes(field)) {
    ok(`Spec includes field '${field}' (${context})`);
  } else {
    fail(`Spec MISSING field '${field}' (${context}) — UI type may be stale`);
  }
}

console.log('');
console.log('Setara API contract check (UI type drift detector)');
console.log(`Backend: ${BASE_URL}`);
console.log('─'.repeat(50));

try {
  console.log('\n[1/4] Fetching OpenAPI spec…');
  const spec = await fetchSpec();
  ok(`GET ${SPEC_URL} → 200`);

  console.log('\n[2/4] Required API paths…');
  const REQUIRED_PATHS = [
    '/api/projects',
    '/api/tribes',
    '/api/plans',
    '/api/automation/sessions',
    '/api/automation/runs',
    '/api/admin/dlq',
  ];
  for (const path of REQUIRED_PATHS) checkPath(spec, path);

  console.log('\n[3/4] Key response shape fields (pagination)…');
  checkField(spec, 'nextCursor', 'CursorPage envelope');
  checkField(spec, 'items', 'CursorPage envelope');

  console.log('\n[4/4] Execution event contract fields…');
  checkField(spec, 'projectKey', 'ExecutionEvent / project reference');
  checkField(spec, 'runId', 'ExecutionEvent');

  console.log('\n' + '─'.repeat(50));
  if (failed === 0) {
    console.log(`✓ All ${passed} contract checks passed.`);
    console.log('  Tip: run `npm run generate:types` to regenerate src/lib/api/openapi.d.ts');
  } else {
    console.error(`✗ ${failed} checks failed — regenerate types: npm run generate:types`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n✗ Could not reach backend at ${BASE_URL}: ${err.message}`);
  console.error('  Start the backend first: cd setara-platform && make infra && cd ../setara-core && mvn quarkus:dev');
  process.exit(1);
}
console.log('');

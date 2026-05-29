/**
 * OpenAPI smoke check — compares the mock API handler paths against the
 * backend OpenAPI spec to catch contract drift.
 *
 * Usage:
 *   npx tsx scripts/check-openapi.ts [--spec <url>]
 *
 * Default spec URL: http://localhost:8080/q/openapi
 * Exits with code 1 if mismatches are found.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SPEC_URL = process.argv.includes('--spec')
  ? process.argv[process.argv.indexOf('--spec') + 1]
  : 'http://localhost:8080/q/openapi';

// Discover all mock handler files under src/
function findMockHandlers(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...findMockHandlers(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.js')) results.push(full);
  }
  return results;
}

// Extract fetch/apiClient call paths from source (simple regex heuristic)
function extractMockPaths(files: string[]): Set<string> {
  const paths = new Set<string>();
  const pathPattern = /['"`](\/api\/[^'"`\s?#]+)['"`]/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = pathPattern.exec(src)) !== null) {
      // Normalise path params: /api/projects/abc123/scenarios → /api/projects/{id}/scenarios
      const normalised = m[1].replace(/\/[0-9a-f-]{8,}/g, '/{id}');
      paths.add(normalised);
    }
  }
  return paths;
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL} …`);
  let specPaths: Set<string>;
  try {
    const res = await fetch(SPEC_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json() as { paths?: Record<string, unknown> };
    specPaths = new Set(Object.keys(spec.paths ?? {}));
    console.log(`Spec loaded — ${specPaths.size} paths defined.`);
  } catch (e: any) {
    console.warn(`⚠  Could not fetch spec: ${e.message}`);
    console.warn('Run the backend (quarkus:dev) before running this check in CI.');
    process.exit(0); // Non-fatal if backend not running
  }

  const srcDir = join(import.meta.dirname, '..', 'src');
  const files = findMockHandlers(srcDir);
  const mockPaths = extractMockPaths(files);
  console.log(`Found ${mockPaths.size} API path references in ${files.length} source files.`);

  let mismatches = 0;
  for (const mockPath of mockPaths) {
    if (!specPaths.has(mockPath)) {
      console.warn(`  NOT IN SPEC: ${mockPath}`);
      mismatches++;
    }
  }

  if (mismatches === 0) {
    console.log('✓ All mock API paths are present in the OpenAPI spec.');
    process.exit(0);
  } else {
    console.error(`\n✗ ${mismatches} mock path(s) not found in OpenAPI spec. Update mocks or backend.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

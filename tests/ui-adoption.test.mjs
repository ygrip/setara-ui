import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ['src/routes', 'src/lib/components', 'src/lib/ui'];
const ignoredDirs = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

function walk(dir, predicate, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, predicate, acc);
    } else if (predicate(path)) {
      acc.push(path);
    }
  }
  return acc;
}

function sourceFiles(...extensions) {
  return sourceRoots.flatMap((sourceRoot) =>
    walk(join(root, sourceRoot), (path) => extensions.includes(extname(path)))
  );
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function offenders(files, pattern) {
  return files
    .filter((file) => pattern.test(read(file)))
    .map((file) => relative(root, file));
}

describe('Setara UI adoption guardrails', () => {
  it('does not reintroduce bespoke page-level error-banner styles', () => {
    const files = sourceFiles('.svelte');
    const matches = offenders(files, /class=["'][^"']*\berror-banner\b|\.error-banner\b/);
    assert.deepEqual(matches, []);
  });

  it('keeps report export behind the shared export menu instead of raw links', () => {
    const files = sourceFiles('.svelte', '.ts');
    const matches = offenders(files, /localhost:8080\/api\/|href=["'][^"']*\/api\/[^"']*format=|window\.location(?:\.href)?\s*=\s*["'`][^"'`]*\/api\//);
    assert.deepEqual(matches, []);
  });

  it('keeps the shared UI wrapper layer in place for feedback and overlays', () => {
    const required = [
      'src/lib/ui/feedback/AppAlert.svelte',
      'src/lib/ui/feedback/AppToastViewport.svelte',
      'src/lib/ui/overlay/AppModal.svelte',
      'src/lib/ui/overlay/AppDropdown.svelte',
      'src/lib/ui/navigation/AppStepper.svelte'
    ];

    const missing = required.filter((file) => {
      try {
        return !statSync(join(root, file)).isFile();
      } catch {
        return true;
      }
    });

    assert.deepEqual(missing, []);
  });
});

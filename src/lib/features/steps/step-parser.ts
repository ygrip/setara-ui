/**
 * Frontend step parser - mirrors the backend StepCellParser logic.
 *
 * Priority order:
 *  1. Gherkin keyword prefix (Given/When/Then/And/But)
 *  2. Newline split (multiline)
 *  3. Numbered list  (1. / 1) / 1:)
 *  4. Bullet list    (-, *, •)
 *  5. Semicolon split
 *  6. Pipe split
 *  7. Single step (whole text)
 */

import type { StepGridRow, StepKeyword } from '$lib/components/scenario/step-grid.types';
import { emptyRow, reorder } from '$lib/components/scenario/step-grid.types';

const KEYWORDS: StepKeyword[] = ['GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'];
const KEYWORD_RE = /^(given|when|then|and|but)\b\s*/i;
const NUMBERED_RE = /^\s*(\d+[\.\)\:])\s+/;
const BULLET_RE = /^\s*[-*•]\s+/;

function extractKeyword(line: string): { keyword: StepKeyword; text: string } {
  const match = line.match(KEYWORD_RE);
  if (match) {
    const kw = match[1].toUpperCase() as StepKeyword;
    const text = line.slice(match[0].length).trim();
    return { keyword: kw, text };
  }
  return { keyword: '', text: line.trim() };
}

function toRows(lines: string[]): StepGridRow[] {
  const filtered = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  return reorder(filtered.map((line) => {
    const { keyword, text } = extractKeyword(line);
    const row = emptyRow(0);
    row.keyword = keyword;
    row.text = text;
    return row;
  }));
}

/** Try to detect and split Gherkin step text into rows. */
function tryGherkin(raw: string): StepGridRow[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasKeyword = lines.some((l) => KEYWORD_RE.test(l));
  if (!hasKeyword || lines.length < 2) return null;
  return toRows(lines);
}

/** Split on newlines. */
function byNewline(raw: string): StepGridRow[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return toRows(lines);
}

/** Split on numbered list items. */
function byNumbered(raw: string): StepGridRow[] | null {
  const lines = raw.split('\n');
  const numbered = lines.filter((l) => NUMBERED_RE.test(l));
  if (numbered.length < 2) return null;
  return toRows(numbered.map((l) => l.replace(NUMBERED_RE, '')));
}

/** Split on bullet list items. */
function byBullet(raw: string): StepGridRow[] | null {
  const lines = raw.split('\n');
  const bulleted = lines.filter((l) => BULLET_RE.test(l));
  if (bulleted.length < 2) return null;
  return toRows(bulleted.map((l) => l.replace(BULLET_RE, '')));
}

/** Split on semicolons. */
function bySemicolon(raw: string): StepGridRow[] | null {
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return toRows(parts);
}

/** Split on pipes. */
function byPipe(raw: string): StepGridRow[] | null {
  const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return toRows(parts);
}

/**
 * Parse free-form text into step rows.
 * Returns at least one row (the whole text as a single step) if nothing else matches.
 */
export function parseStepsFromText(raw: string): StepGridRow[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  return (
    tryGherkin(text) ??
    byNewline(text) ??
    byNumbered(text) ??
    byBullet(text) ??
    bySemicolon(text) ??
    byPipe(text) ??
    toRows([text])
  );
}

/**
 * Normalize keywords in a list of rows:
 *  - Capitalize existing keywords (GIVEN → GIVEN, given → GIVEN)
 *  - Rows without a keyword that follow a Given get AND assigned
 */
export function normalizeKeywords(rows: StepGridRow[]): StepGridRow[] {
  let lastMajor: StepKeyword = '';
  return rows.map((r) => {
    const kw = r.keyword.toUpperCase() as StepKeyword;
    if (KEYWORDS.includes(kw)) {
      const normalized = kw as StepKeyword;
      if (normalized === 'GIVEN' || normalized === 'WHEN' || normalized === 'THEN') {
        lastMajor = normalized;
      }
      return { ...r, keyword: normalized };
    }
    // No keyword - assign AND if we have context
    if (lastMajor) return { ...r, keyword: 'AND' };
    return r;
  });
}

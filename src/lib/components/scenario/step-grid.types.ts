// ── Step grid types ───────────────────────────────────────────────────────────

export type StepKeyword = 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT' | '';

export interface StepGridRow {
  /** Stable unique id for list tracking (not sent to backend) */
  _id: string;
  order: number;
  keyword: StepKeyword;
  text: string;
  description: string;
  expectation: string;
  /** Client-side validation state */
  _error?: string;
}

/** Shape sent to/received from the backend */
export interface BackendStep {
  id?: string;
  sequenceNo: number;
  keyword: string;
  name: string;
  description: string | null;
  expectation: string | null;
}

export function toBackendSteps(rows: StepGridRow[]): BackendStep[] {
  return rows
    .filter((r) => r.text.trim() !== '')
    .map((r, i) => ({
      sequenceNo: i + 1,
      keyword: r.keyword,
      name: r.text.trim(),
      description: r.description?.trim() || null,
      expectation: r.expectation?.trim() || null
    }));
}

export function fromBackendSteps(steps: BackendStep[]): StepGridRow[] {
  return steps.map((s, i) => ({
    _id: crypto.randomUUID(),
    order: i + 1,
    keyword: (s.keyword ?? '') as StepKeyword,
    text: s.name ?? '',
    description: s.description ?? '',
    expectation: s.expectation ?? ''
  }));
}

export function emptyRow(order: number): StepGridRow {
  return {
    _id: crypto.randomUUID(),
    order,
    keyword: '',
    text: '',
    description: '',
    expectation: ''
  };
}

export function validateRows(rows: StepGridRow[]): StepGridRow[] {
  return rows.map((r) => ({
    ...r,
    _error: r.text.trim() === '' ? 'Step text is required' : undefined
  }));
}

export function reorder(rows: StepGridRow[]): StepGridRow[] {
  return rows.map((r, i) => ({ ...r, order: i + 1 }));
}

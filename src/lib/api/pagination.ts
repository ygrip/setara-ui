/** Paginated response envelope for cursor-based list endpoints. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

/**
 * Builds a query-string suffix for cursor pagination params including optional sort.
 * Returns an empty string when no params are provided.
 */
export function buildCursorParams(
  cursor?: string,
  limit?: number,
  sortBy?: string,
  sortDir?: string
): string {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit !== undefined) params.set('limit', String(limit));
  if (sortBy) params.set('sort_by', sortBy);
  if (sortDir) params.set('sort_dir', sortDir);
  const str = params.toString();
  return str ? `?${str}` : '';
}

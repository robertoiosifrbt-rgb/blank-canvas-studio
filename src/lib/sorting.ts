/**
 * ACHU-E005: Shared sorting utilities for Admin list pages.
 * Case-insensitive text sort, numeric sort, date sort.
 * Null/missing values sort last regardless of direction.
 */

export type SortDir = 'asc' | 'desc';

/** Extract a comparable value from a record. */
type Accessor<T> = (r: T) => string | number | boolean | null | undefined;

function coerceNum(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function coerceStr(v: any): string | null {
  if (v == null || v === '') return null;
  return String(v).toLowerCase();
}

/**
 * Generic comparator factory.
 * Null values always sort last regardless of direction.
 */
function compare(a: any, b: any, dir: SortDir, kind: 'text' | 'number' | 'date'): number {
  const aNull = a == null || a === '';
  const bNull = b == null || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls last
  if (bNull) return -1;

  let cmp = 0;
  if (kind === 'number') {
    cmp = (coerceNum(a) ?? 0) - (coerceNum(b) ?? 0);
  } else if (kind === 'date') {
    cmp = String(a).localeCompare(String(b));
  } else {
    cmp = (coerceStr(a) ?? '').localeCompare(coerceStr(b) ?? '');
  }
  return dir === 'desc' ? -cmp : cmp;
}

export interface SortField<T> {
  key: string;
  label: string;
  accessor: Accessor<T>;
  kind: 'text' | 'number' | 'date';
}

/**
 * Sort an array by a primary field + optional tiebreaker.
 * Never mutates the source array.
 */
export function sortRecords<T>(
  records: T[],
  field: SortField<T>,
  dir: SortDir,
  tiebreaker?: SortField<T>,
  tiebreakerDir?: SortDir,
): T[] {
  return [...records].sort((a, b) => {
    const cmp = compare(field.accessor(a), field.accessor(b), dir, field.kind);
    if (cmp !== 0 || !tiebreaker) return cmp;
    return compare(tiebreaker.accessor(a), tiebreaker.accessor(b), tiebreakerDir ?? dir, tiebreaker.kind);
  });
}

/** Read sort state from URLSearchParams, falling back to defaults. */
export function readSortParams(sp: URLSearchParams, defaultField: string, defaultDir: SortDir): { sortBy: string; sortDir: SortDir } {
  const sortBy = sp.get('sortBy') || defaultField;
  const d = sp.get('sortDir');
  const sortDir: SortDir = d === 'asc' || d === 'desc' ? d : defaultDir;
  return { sortBy, sortDir };
}

/** Write sort params without clobbering other search params. */
export function writeSortParams(
  sp: URLSearchParams,
  sortBy: string,
  sortDir: SortDir,
  setSp: (next: URLSearchParams, opts?: { replace?: boolean }) => void,
) {
  const next = new URLSearchParams(sp);
  next.set('sortBy', sortBy);
  next.set('sortDir', sortDir);
  setSp(next, { replace: true });
}

/**
 * Shared safe paginated fetch helper for backend endpoints.
 * Stops when hasMore is false, when returned records are empty,
 * and caps at MAX_RECORDS to prevent infinite loops.
 */
const MAX_RECORDS = 200_000;
const PAGE_SIZE = 2000;

export type FetchAllOptions = {
  /** ⚠️ Se trimite mai departe la `finder` neatins — de-aia `unknown`, nu o formă inventată. */
  filters?: unknown;
  fields?: string[];
  /** When true, throws on pagination anomalies instead of silently returning partial data.
   *  Use for financial totals endpoints where incomplete data would produce wrong numbers. */
  strict?: boolean;
};

export async function fetchAll<T extends { id: string }>(
  finder: (params: { limit: number; offset: number; filters?: unknown; fields?: string[] }) => Promise<{ records: T[]; hasMore: boolean }>,
  options?: FetchAllOptions,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;
  let emptyPages = 0;
  const strict = options?.strict ?? false;

  while (hasMore) {
    const res = await finder({
      limit: PAGE_SIZE,
      offset,
      ...(options?.filters ? { filters: options.filters } : {}),
      ...(options?.fields ? { fields: options.fields } : {}),
    });

    if (res.records.length === 0) {
      emptyPages++;
      if (emptyPages >= 2 || !res.hasMore) break;
      if (strict) {
        throw new Error('Pagination inconsistency: empty page received with hasMore=true. Financial data may be incomplete.');
      }
      console.warn(`fetchAll: empty page at offset ${offset} with hasMore=true. Breaking to prevent infinite loop.`);
      break;
    }

    emptyPages = 0;
    all.push(...res.records);
    hasMore = res.hasMore;
    offset += res.records.length;

    if (all.length >= MAX_RECORDS) {
      if (strict) {
        throw new Error(`Pagination cap reached (${MAX_RECORDS} records). Financial data may be incomplete.`);
      }
      console.warn(`fetchAll: hit max record cap (${MAX_RECORDS}). Results may be incomplete.`);
      break;
    }
  }

  return all;
}

export async function searchAll<T extends { id: string }>(
  finder: (params: { limit: number; offset: number }) => Promise<{ records: T[]; hasMore: boolean }>,
  match: (r: T) => boolean,
  maxResults: number,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  let hasMore = true;
  let emptyPages = 0;

  while (hasMore && results.length < maxResults) {
    const res = await finder({ limit: PAGE_SIZE, offset });

    if (res.records.length === 0) {
      emptyPages++;
      if (emptyPages >= 2 || !res.hasMore) break;
      console.warn(`searchAll: empty page at offset ${offset} with hasMore=true. Breaking.`);
      break;
    }

    emptyPages = 0;
    for (const r of res.records) {
      if (match(r)) {
        results.push(r);
        if (results.length >= maxResults) break;
      }
    }
    hasMore = res.hasMore;
    offset += res.records.length;

    if (offset >= MAX_RECORDS) break;
  }

  return results;
}


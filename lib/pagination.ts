/**
 * Pagination helper for PostgREST reads.
 *
 * PostgREST caps a single response at ~1000 rows even when no explicit `.limit()`
 * is set (the project's `db_max_rows` is unset, which does NOT mean unlimited).
 * Any code that fetches a full list and then counts/aggregates it in JS silently
 * undercounts once the scoped result passes ~1000 rows — per-item pages stay
 * correct while totals freeze, which is the fingerprint of this bug. This froze
 * the Yi-Future National Dashboard delegate total at 1003 while real
 * registrations were 1080+ (fixed in #572).
 *
 * Use `fetchAllRows` whenever a query can return more than ~1000 rows and the
 * rows are aggregated in JS. The caller's `makePage` MUST apply a stable
 * `.order(...)` and `.range(from, to)` so pages don't overlap or skip.
 *
 * If you only need a count (not the rows), prefer
 * `select("*", { count: "exact", head: true })` instead — it returns the true,
 * uncapped count with zero rows transferred.
 */
export const POSTGREST_PAGE = 1000;

export async function fetchAllRows<T>(
  makePage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += POSTGREST_PAGE) {
    const { data, error } = await makePage(from, from + POSTGREST_PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < POSTGREST_PAGE) break;
  }
  return all;
}

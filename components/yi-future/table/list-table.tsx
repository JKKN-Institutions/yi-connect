import Link from "next/link";

/**
 * Server-side search + pagination for the big national admin lists.
 *
 * The whole list is fetched on the server (the ~1000-row cap is gone), then
 * filtered by `?q=` and sliced by `?page=` so the page only ever renders the
 * current page of rows — keeps these tables from dumping 1,400+ rows into one
 * scroll, and lets chapters find a row by typing. Same URL-param model the
 * region/chapter/college filters already use, so it's all one navigation.
 */

export const LIST_PAGE_SIZE = 100;

/** Slice a filtered list for the current 1-based-in-UI page (0-based input). */
export function pageSlice<T>(rows: T[], page: number, pageSize = LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;
  return {
    pageRows: rows.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    rangeStart: rows.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, rows.length),
  };
}

export function ListSearchForm({
  action,
  q,
  placeholder,
  hidden = [],
}: {
  action: string;
  q: string;
  placeholder?: string;
  /** Other filter params to carry through the search submit. */
  hidden?: { name: string; value: string }[];
}) {
  return (
    <form method="get" action={action} className="flex items-center gap-2">
      {hidden.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder ?? "Search…"}
        className="w-full sm:w-96 text-sm px-3 py-2 rounded-lg border border-[#1a1a3e]/15 bg-white text-[#1a1a3e] placeholder:text-[#1a1a3e]/40 focus:outline-none focus:border-[#F5A623]"
      />
      <button
        type="submit"
        className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#1a1a3e]/30 bg-white text-[#1a1a3e] hover:bg-[#1a1a3e]/5"
      >
        Search
      </button>
      {q ? (
        <Link
          href={
            action +
            (hidden.length
              ? "?" +
                hidden
                  .map(
                    (h) =>
                      `${encodeURIComponent(h.name)}=${encodeURIComponent(h.value)}`
                  )
                  .join("&")
              : "")
          }
          className="text-xs font-semibold text-[#1a1a3e]/50 hover:text-[#1a1a3e] underline"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

export function ListPager({
  hrefForPage,
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  filteredCount,
  total,
  noun = "rows",
}: {
  hrefForPage: (page: number) => string;
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  filteredCount: number;
  total: number;
  noun?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs text-[#1a1a3e]/60 border-t border-[#1a1a3e]/5">
      <span>
        Showing{" "}
        <span className="font-semibold text-[#1a1a3e]">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of {filteredCount}
        {filteredCount !== total ? ` (filtered from ${total})` : ""} {noun}
      </span>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          {page > 0 ? (
            <Link
              href={hrefForPage(page - 1)}
              className="px-2.5 py-1 rounded border border-[#1a1a3e]/20 bg-white font-semibold text-[#1a1a3e] hover:border-[#1a1a3e]/40"
            >
              ← Prev
            </Link>
          ) : (
            <span className="px-2.5 py-1 rounded border border-[#1a1a3e]/10 text-[#1a1a3e]/30">
              ← Prev
            </span>
          )}
          <span className="px-1.5">
            Page {page + 1} / {pageCount}
          </span>
          {page < pageCount - 1 ? (
            <Link
              href={hrefForPage(page + 1)}
              className="px-2.5 py-1 rounded border border-[#1a1a3e]/20 bg-white font-semibold text-[#1a1a3e] hover:border-[#1a1a3e]/40"
            >
              Next →
            </Link>
          ) : (
            <span className="px-2.5 py-1 rounded border border-[#1a1a3e]/10 text-[#1a1a3e]/30">
              Next →
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

/**
 * "Print all" — opens the browser's print dialog. The page ships @page A4
 * landscape CSS with one certificate per page, so printing (or Save as PDF)
 * produces the whole stack in one go.
 */
export function PrintAllButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={count === 0}
      className="vv-no-print inline-flex items-center gap-2 rounded-full bg-[#3B0A45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
    >
      Print all ({count})
    </button>
  );
}

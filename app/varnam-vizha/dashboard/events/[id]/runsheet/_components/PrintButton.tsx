"use client";

/**
 * "Print run sheet" — triggers the browser's print dialog. The page ships
 * @media print CSS that hides the site chrome (header/nav/footer) and every
 * .vv-no-print element, so what comes out is a clean paper run sheet.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="vv-no-print inline-flex items-center gap-2 rounded-full bg-[#3B0A45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33]"
    >
      Print run sheet
    </button>
  );
}

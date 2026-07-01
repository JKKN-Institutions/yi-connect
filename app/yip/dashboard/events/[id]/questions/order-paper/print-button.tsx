"use client";

import { Printer } from "lucide-react";

/** Screen-only button that opens the browser print dialog (→ Save as PDF).
 *  Hidden in the printed output via the `no-print` class. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#C2691A] px-4 py-2 text-sm font-semibold text-white"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  );
}

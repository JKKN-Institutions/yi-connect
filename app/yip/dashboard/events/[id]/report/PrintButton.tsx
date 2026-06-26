"use client";

/**
 * Print / Save-as-PDF trigger for the Chapter Round Report. Opens the browser
 * print dialog; the report's print styles (report-print.css) hide the app
 * chrome + this button and add page breaks so it prints as a clean PDF.
 */
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-lg bg-[#1a1a3e] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a1a3e]/90"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  );
}

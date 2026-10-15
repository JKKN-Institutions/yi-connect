"use client";

/** Opens the browser's print dialog; the page's print styles hide everything but the sheet. */
export function PrintButton() {
  return (
    <button type="button" className="rx-btn rx-btn-quiet" onClick={() => window.print()} data-testid="print-stage-sheet">
      Print the stage sheet
    </button>
  );
}

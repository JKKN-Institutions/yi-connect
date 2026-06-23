"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/yip/ui/button";

/**
 * Print / Save-as-PDF trigger for the Scoring & Awards Guide. The guide is a
 * static explainer admins want to share, so a one-click "Save as PDF" (via the
 * browser print dialog) is the simplest share path. Hidden from the printout
 * itself (`print:hidden`).
 */
export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 size-4" />
      Print / Save as PDF
    </Button>
  );
}

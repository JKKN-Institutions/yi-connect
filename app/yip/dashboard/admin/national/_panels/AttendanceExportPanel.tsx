"use client";

import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/yip/ui/button";
import { exportNationalAttendance } from "@/app/yip/actions/national-attendance-export";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "Attendance Export" (all-chapter delegate + check-in CSV).
//
// The one file the national team sends onward: every delegate in every real
// chapter round with Day 1 / Day 2 check-in. Client component (needs a browser
// download); all gating + all reading happens server-side in
// exportNationalAttendance, which is requireSuperAdmin-gated and fails closed.
//
// The privacy line below is load-bearing, not decoration: it tells whoever
// downloads this exactly what is and isn't in the file before they forward it.
// ═══════════════════════════════════════════════════════════════════════

export function AttendanceExportPanel() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    const res = await exportNationalAttendance();
    setLoading(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(
      `Downloaded ${res.data.count.toLocaleString("en-IN")} delegates from ` +
        `${res.data.chapterCount} chapters (${res.data.eventCount} rounds).`
    );

    // Never let un-attributable rows pass unnoticed into a national figure —
    // they're at the bottom of the file with a blank Chapter, and the user has
    // to know they're there before quoting the total.
    if (res.data.unassignedCount > 0) {
      toast.warning(
        `${res.data.unassignedCount.toLocaleString("en-IN")} of those rows come ` +
          `from a round with no chapter name and are listed at the bottom with a ` +
          `blank Chapter. Check them before quoting the total.`,
        { duration: 10000 }
      );
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#1a1a3e]/8 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-[#1a1a3e]/8 px-5 py-4">
        <FileSpreadsheet className="size-4 shrink-0 text-[#FF9933]" />
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a3e]">
            Attendance Export
          </h2>
          <p className="text-[12px] text-[#1a1a3e]/50">
            Every delegate, every chapter, with Day 1 &amp; Day 2 check-in — one
            spreadsheet for national reporting.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-[260px] flex-1 space-y-2">
          <p className="text-[13px] leading-relaxed text-[#1a1a3e]/60">
            One row per delegate: Zone, Chapter, Event, Student, School, Class,
            Constituency No., and whether they checked in on each day (with the
            time, in IST). Demo rounds are excluded.
          </p>
          <p className="rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2 text-[12px] leading-relaxed text-[#1a1a3e]/55">
            <span className="font-medium text-[#1a1a3e]/70">
              No contact details.
            </span>{" "}
            Phone numbers, parent phone numbers, email addresses and access codes
            are left out so this file is safe to forward.
          </p>
        </div>

        <Button onClick={handleDownload} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download Attendance CSV
        </Button>
      </div>
    </section>
  );
}

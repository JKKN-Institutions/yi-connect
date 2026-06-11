"use client";

/**
 * Quarterly review CSV export control (Phase 15) — quarter/year picker +
 * download button. Calls the national-gated exportQuarterlyCsv action and
 * triggers a browser download of the returned CSV string (no route handler;
 * the action returns { csv, filename }).
 */

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { exportQuarterlyCsv } from "@/app/youth-academy/actions/national-reports";

const QUARTERS = [
  { value: 1, label: "Q1 (Jan–Mar)" },
  { value: 2, label: "Q2 (Apr–Jun)" },
  { value: 3, label: "Q3 (Jul–Sep)" },
  { value: 4, label: "Q4 (Oct–Dec)" },
];

const FIRST_PROGRAM_YEAR = 2026;

export function QuarterlyExport() {
  // The current quarter/year depend on the wall clock, which differs between
  // the server render and the client hydration (clock + timezone). Initialise
  // to a deterministic constant so server and client HTML match, then resolve
  // the real "now" after mount. This avoids a hydration mismatch.
  const [quarter, setQuarter] = useState(1);
  const [year, setYear] = useState(FIRST_PROGRAM_YEAR);
  const [maxYear, setMaxYear] = useState(FIRST_PROGRAM_YEAR);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const now = new Date();
    setQuarter(Math.floor(now.getMonth() / 3) + 1);
    setYear(now.getFullYear());
    setMaxYear(now.getFullYear());
  }, []);

  const years: number[] = [];
  for (let y = maxYear; y >= Math.min(FIRST_PROGRAM_YEAR, maxYear); y--) {
    years.push(y);
  }

  function onDownload() {
    startTransition(async () => {
      const result = await exportQuarterlyCsv({ quarter, year });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.data.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${result.data.filename}`);
    });
  }

  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Quarterly review export
      </h2>
      <p className="mt-1 text-[11px] text-slate-400">
        One CSV row per academy: sessions by category, active days, students
        engaged and certified, norm status, qualitative notes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="quarterly-export-quarter">
          Quarter
        </label>
        <select
          id="quarterly-export-quarter"
          className={selectClass}
          value={quarter}
          onChange={(e) => setQuarter(Number(e.target.value))}
          disabled={pending}
        >
          {QUARTERS.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="quarterly-export-year">
          Year
        </label>
        <select
          id="quarterly-export-year"
          className={selectClass}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={pending}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDownload}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          <Download className="size-4" />
          {pending ? "Preparing…" : "Download CSV"}
        </button>
      </div>
    </div>
  );
}

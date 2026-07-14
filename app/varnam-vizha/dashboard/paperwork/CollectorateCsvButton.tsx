"use client";

import { Download } from "lucide-react";

export type CollectorateRow = {
  title: string;
  start_date: string | null;
  end_date: string | null;
  venue_address: string | null;
  category: string | null;
  max_capacity: number | null;
  public_slug: string | null;
};

/** Quote a cell for CSV (RFC 4180: wrap in quotes, double embedded quotes). */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** "12-09-2026" in IST. */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(d)
    .replace(/\//g, "-");
}

/** "6:30 PM" in IST. */
function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
}

function buildCsv(rows: CollectorateRow[]): string {
  const header = [
    "S.No",
    "Event",
    "Date (DD-MM-YYYY)",
    "Time",
    "Venue",
    "Category",
    "Expected participants",
    "Public page URL",
  ];
  const lines = [header.map(csvCell).join(",")];
  rows.forEach((r, i) => {
    const startTime = fmtTime(r.start_date);
    const endTime = fmtTime(r.end_date);
    const time =
      startTime && endTime && endTime !== startTime
        ? `${startTime} - ${endTime}`
        : startTime;
    const participants =
      typeof r.max_capacity === "number" && r.max_capacity > 0
        ? String(r.max_capacity)
        : "approx. 200";
    const url = r.public_slug
      ? `${window.location.origin}/varnam-vizha/events/${r.public_slug}`
      : "";
    lines.push(
      [
        String(i + 1),
        r.title ?? "",
        fmtDate(r.start_date),
        time,
        r.venue_address ?? "",
        r.category ?? "",
        participants,
        url,
      ]
        .map((c) => csvCell(String(c)))
        .join(",")
    );
  });
  // Prepend BOM so Excel reads UTF-8 (Tamil names) correctly.
  return "﻿" + lines.join("\r\n");
}

/**
 * One-click replacement for the hand-built Excel the committee prepared for
 * the Collectorate every year: every edition event with date, time, venue and
 * expected participants.
 */
export function CollectorateCsvButton({ rows }: { rows: CollectorateRow[] }) {
  const onExport = () => {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `varnam-vizha-collectorate-sheet-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-2 rounded-full bg-[#D6336C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b02a59] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download className="size-4" />
      Collectorate sheet (CSV)
    </button>
  );
}

"use client";

import { Download } from "lucide-react";

export type CsvRow = {
  name: string;
  email: string | null;
  phone: string | null;
  eventTitle: string;
  status: string | null;
  checked_in_at: string | null;
  created_at: string | null;
};

/** Quote a cell for CSV (RFC 4180: wrap in quotes, double embedded quotes). */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(rows: CsvRow[]): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Event",
    "Status",
    "Checked in",
    "Registered",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const registered = r.created_at
      ? new Date(r.created_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })
      : "";
    const checkedIn = r.checked_in_at
      ? new Date(r.checked_in_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })
      : "";
    lines.push(
      [
        r.name ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.eventTitle ?? "",
        r.status ?? "",
        checkedIn,
        registered,
      ]
        .map((c) => csvCell(String(c)))
        .join(",")
    );
  }
  // Prepend BOM so Excel reads UTF-8 (Tamil names) correctly.
  return "﻿" + lines.join("\r\n");
}

export function ExportCsvButton({ rows }: { rows: CsvRow[] }) {
  const onExport = () => {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `varnam-vizha-registrations-${stamp}.csv`;
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
      Export CSV
    </button>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════════════════
// Bulk-import delegates for one chapter, from a .xlsx or .csv file.
//
// Adapted from components/yip/csv-import.tsx, which has been importing real
// chapter rosters for months — but with its two known weaknesses fixed:
//   • ONE parse path for both CSV and XLSX (SheetJS reads CSV from bytes
//     fine). YIP branches on extension and the two branches have drifted.
//   • Rows are submitted in chunks with real progress, so partial success is
//     genuine rather than promised by a UI sitting on an all-or-nothing insert.
// ═══════════════════════════════════════════════════════════════════════

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/yi-future/ui/dialog";
import { importDelegatesChunk } from "@/app/yi-future/actions/delegate-import";
import {
  cellInt,
  cellText,
  findColumnIndex,
  normalizePhone,
} from "@/lib/yi-future/spreadsheet";
import {
  COLUMN_ALIASES,
  IMPORT_CHUNK_SIZE,
  MAX_IMPORT_ROWS,
  TEMPLATE_COLUMNS,
  TEMPLATE_EXAMPLE,
  type ImportDelegateRow,
  type ImportedDelegate,
} from "@/lib/yi-future/delegate-import";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCEPT =
  ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

type ParsedRow = ImportDelegateRow & {
  rowNumber: number;
  errors: string[];
};

type Summary = {
  added: number;
  skipped: number;
  collegeNotMatched: string[];
  unverifiable: string[];
  errors: string[];
  created: ImportedDelegate[];
};

/** One-row .xlsx template. XLSX.writeFile handles blob + anchor internally. */
function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_COLUMNS],
    [...TEMPLATE_EXAMPLE],
  ]);
  ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Delegates");
  XLSX.writeFile(wb, "yi-future-delegate-import-template.xlsx");
}

function downloadCodes(created: ImportedDelegate[]) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Full Name", "Email", "Phone", "College", "Access Code"],
    ...created.map((c) => [c.full_name, c.email, c.phone, c.college, c.access_code]),
  ]);
  ws["!cols"] = [{ wch: 26 }, { wch: 30 }, { wch: 14 }, { wch: 32 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Access codes");
  XLSX.writeFile(
    wb,
    `yi-future-access-codes-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export function ImportDelegatesButton({
  chapterId,
  editionId,
  variant = "toolbar",
}: {
  chapterId: string;
  editionId: string;
  /** "toolbar" matches the CSV link; "empty" is the larger empty-state CTA. */
  variant?: "toolbar" | "empty";
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.filter((r) => r.errors.length > 0);

  function reset() {
    setRows([]);
    setFileName("");
    setParseError(null);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setSummary(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setSummary(null);
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        setParseError("That file has no sheets in it.");
        setRows([]);
        return;
      }

      // header:1 → literal rows, so a blank cell in row 2 cannot hide a column.
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      if (aoa.length < 2) {
        setParseError("That file has a header row but no delegates under it.");
        setRows([]);
        return;
      }

      const headers = (aoa[0] ?? []).map((h) => cellText(h));
      const col = {
        full_name: findColumnIndex(headers, COLUMN_ALIASES.full_name),
        email: findColumnIndex(headers, COLUMN_ALIASES.email),
        phone: findColumnIndex(headers, COLUMN_ALIASES.phone),
        college: findColumnIndex(headers, COLUMN_ALIASES.college),
        course: findColumnIndex(headers, COLUMN_ALIASES.course),
        year_of_study: findColumnIndex(headers, COLUMN_ALIASES.year_of_study),
        age: findColumnIndex(headers, COLUMN_ALIASES.age),
        home_state: findColumnIndex(headers, COLUMN_ALIASES.home_state),
      };

      if (col.full_name < 0) {
        setParseError(
          `Could not find a name column. Found: ${headers.filter(Boolean).join(", ") || "(nothing)"}. Download the template to see the expected headings.`
        );
        setRows([]);
        return;
      }

      const body = aoa.slice(1);
      if (body.length > MAX_IMPORT_ROWS) {
        setParseError(
          `That file has ${body.length.toLocaleString("en-IN")} rows. The limit is ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} per file — please split it.`
        );
        setRows([]);
        return;
      }

      const at = (r: unknown[], i: number) => (i < 0 ? "" : r[i]);
      const parsed: ParsedRow[] = [];

      body.forEach((raw, i) => {
        if (!Array.isArray(raw)) return;
        if (raw.every((c) => cellText(c) === "")) return; // blank row

        const errors: string[] = [];
        const full_name = cellText(at(raw, col.full_name));
        const email = cellText(at(raw, col.email)).toLowerCase();
        const phone = normalizePhone(at(raw, col.phone));
        const year = cellInt(at(raw, col.year_of_study));
        const age = cellInt(at(raw, col.age));

        if (!full_name) errors.push("Name is required");
        if (email && !EMAIL_RE.test(email)) errors.push(`"${email}" is not a valid email`);
        if (phone && phone.length !== 10) {
          errors.push(`Phone should be 10 digits (got "${phone}")`);
        }
        if (year !== undefined && (year < 1 || year > 5)) {
          errors.push("Year of study should be 1–5");
        }
        if (age !== undefined && (age < 15 || age > 30)) {
          errors.push("Age should be between 15 and 30");
        }

        parsed.push({
          rowNumber: i + 2, // +1 for the header, +1 for 1-based rows
          errors,
          full_name,
          email: email || undefined,
          phone: phone || undefined,
          college: cellText(at(raw, col.college)) || undefined,
          course: cellText(at(raw, col.course)) || undefined,
          year_of_study: year,
          age,
          home_state: cellText(at(raw, col.home_state)) || undefined,
        });
      });

      if (parsed.length === 0) {
        setParseError("No delegates found in that file.");
      }
      setRows(parsed);
    } catch {
      setParseError(
        "Could not read that file. Please make sure it is a .xlsx or .csv saved from Excel or Google Sheets."
      );
      setRows([]);
    }
  }

  async function runImport() {
    if (valid.length === 0) return;
    setImporting(true);
    setParseError(null);

    const acc: Summary = {
      added: 0,
      skipped: 0,
      collegeNotMatched: [],
      unverifiable: [],
      errors: [],
      created: [],
    };
    setProgress({ done: 0, total: valid.length });

    for (let i = 0; i < valid.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = valid.slice(i, i + IMPORT_CHUNK_SIZE).map((r) => ({
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        college: r.college,
        course: r.course,
        year_of_study: r.year_of_study,
        age: r.age,
        home_state: r.home_state,
      }));

      let res;
      try {
        res = await importDelegatesChunk({ chapterId, editionId, rows: chunk });
      } catch {
        // A thrown action (network blip, mid-deploy version skew) must never
        // end as a silent no-op — rows already imported are still reported.
        setParseError(
          `Lost connection after ${acc.added} delegate(s). Nothing was lost — re-upload the same file and already-added students will be skipped.`
        );
        break;
      }

      if (!res.ok) {
        acc.errors.push(res.error);
        break;
      }
      acc.added += res.added;
      acc.skipped += res.skipped;
      acc.errors.push(...res.errors);
      acc.created.push(...res.created);
      for (const c of res.collegeNotMatched) {
        if (!acc.collegeNotMatched.includes(c)) acc.collegeNotMatched.push(c);
      }
      for (const u of res.unverifiable) {
        if (!acc.unverifiable.includes(u)) acc.unverifiable.push(u);
      }
      setProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, valid.length), total: valid.length });
    }

    setSummary(acc);
    setImporting(false);
  }

  const triggerClass =
    variant === "empty"
      ? "px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:bg-navy/5 inline-flex items-center gap-1.5"
      : "text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5";

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<button type="button" className={triggerClass} />}>
        <span>↑</span> Import
      </DialogTrigger>

      <DialogContent className="bg-white text-navy sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-navy">Import delegates</DialogTitle>
          <DialogDescription className="text-navy/60">
            Upload a spreadsheet of students for your chapter. Anyone already
            registered is skipped, so it is safe to upload the same file twice.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-md border border-navy/15 bg-ivory px-3 py-2">
              <p className="text-xs text-navy/70">
                First time? Start from the template so the headings match.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="shrink-0 text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5"
              >
                ⬇ Template
              </button>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Your file (.xlsx or .csv)
              </span>
              <input
                type="file"
                accept={ACCEPT}
                onChange={handleFile}
                disabled={importing}
                className="block w-full text-sm text-navy file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ivory hover:file:bg-navy-dark"
              />
            </label>

            {parseError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </p>
            )}

            {rows.length > 0 && (
              <>
                <p className="text-sm text-navy">
                  <span className="font-bold text-yi-green">{valid.length} ready</span>
                  {invalid.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-bold text-red-600">
                        {invalid.length} need fixing
                      </span>
                    </>
                  )}
                  <span className="text-navy/50"> — from {fileName}</span>
                </p>

                <div className="max-h-56 overflow-auto rounded-md border border-navy/15">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-ivory text-navy/70">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Name</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Email</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Phone</th>
                        <th className="px-2 py-1.5 text-left font-semibold">College</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={
                            r.errors.length > 0
                              ? "bg-red-50 border-t border-navy/10"
                              : "border-t border-navy/10"
                          }
                        >
                          <td className="px-2 py-1.5 text-navy/40">{r.rowNumber}</td>
                          <td className="px-2 py-1.5 font-medium">{r.full_name || "—"}</td>
                          <td className="px-2 py-1.5 text-navy/70">{r.email || "—"}</td>
                          <td className="px-2 py-1.5 text-navy/70">{r.phone || "—"}</td>
                          <td className="px-2 py-1.5 text-navy/70">{r.college || "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.errors.length > 0 ? (
                              <span className="text-red-600">{r.errors.join("; ")}</span>
                            ) : (
                              <span className="text-yi-green">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invalid.length > 0 && (
                  <p className="text-xs text-navy/60">
                    Rows marked in red are not imported. Fix them in your
                    spreadsheet and upload again — the students already added
                    will be skipped.
                  </p>
                )}
              </>
            )}

            {importing && (
              <p className="text-sm font-semibold text-navy">
                Importing… {progress.done} / {progress.total}
              </p>
            )}
          </>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="rounded-md border border-yi-green/30 bg-yi-green/10 px-3 py-2.5">
              <p className="text-sm font-bold text-navy">
                Added {summary.added} delegate{summary.added === 1 ? "" : "s"}.
              </p>
              {summary.skipped > 0 && (
                <p className="text-xs text-navy/70 mt-0.5">
                  {summary.skipped} already registered — left untouched.
                </p>
              )}
            </div>

            {summary.created.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-navy/15 bg-ivory px-3 py-2">
                <p className="text-xs text-navy/70">
                  Each new student needs their access code to sign in. Emails
                  are not sent automatically.
                </p>
                <button
                  type="button"
                  onClick={() => downloadCodes(summary.created)}
                  className="shrink-0 text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5"
                >
                  ⬇ Access codes
                </button>
              </div>
            )}

            {summary.unverifiable.length > 0 && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2">
                <p className="text-xs font-semibold text-red-700">
                  {summary.unverifiable.length}{" "}
                  {summary.unverifiable.length === 1 ? "row was" : "rows were"}{" "}
                  not imported — no email and no phone number:
                </p>
                <p className="text-xs text-navy/70 mt-1">
                  {summary.unverifiable.join(", ")}
                </p>
                <p className="text-xs text-navy/50 mt-1">
                  Repeats are spotted by email or phone, so a row with neither
                  cannot be checked — uploading this file again would create
                  those students a second time. Add an email or a phone number
                  for them and upload just those rows again.
                </p>
              </div>
            )}

            {summary.collegeNotMatched.length > 0 && (
              <div className="rounded-md border border-yi-gold/40 bg-yi-gold/10 px-3 py-2">
                <p className="text-xs font-semibold text-navy">
                  These colleges are not on your chapter&apos;s list, so those
                  students were added without one:
                </p>
                <p className="text-xs text-navy/70 mt-1">
                  {summary.collegeNotMatched.join(", ")}
                </p>
                <p className="text-xs text-navy/50 mt-1">
                  Add them under Colleges, then edit the students to link them.
                </p>
              </div>
            )}

            {summary.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs font-semibold text-red-700">
                  Some rows had problems:
                </p>
                <ul className="mt-1 list-disc pl-4 text-xs text-red-700 space-y-0.5">
                  {summary.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {parseError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:bg-navy/5"
              />
            }
          >
            {summary ? "Done" : "Cancel"}
          </DialogClose>
          {!summary && (
            <button
              type="button"
              onClick={runImport}
              disabled={importing || valid.length === 0}
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50"
            >
              {importing
                ? "Importing…"
                : `Import ${valid.length || ""} delegate${valid.length === 1 ? "" : "s"}`.trim()}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

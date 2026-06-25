"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { importAllocatedRoster } from "@/app/yip/actions/participants";
import { Button } from "@/components/yip/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/yip/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Check,
  Download,
  Lock,
} from "lucide-react";

// ── National "allocated student list" column matching ──────────────
// Keys are compared lowercased + trimmed. National's headers are:
//   SRN, Name, Party, Committee, Constituency, State / UT
const COL_ALIASES = {
  srn: ["srn", "sr no", "sr. no", "sr.no", "s no", "s.no", "sno", "#", "serial", "serial no", "serial_no"],
  name: ["name", "full name", "fullname", "full_name", "student name", "student"],
  party: ["party", "party letter", "party_letter", "party (a-e)", "party(a-e)"],
  committee: ["committee", "committee number", "committee_number", "committee no", "committee_no", "committee #"],
  constituency: ["constituency", "constituency name", "constituency_name", "seat"],
  state: [
    "state / ut",
    "state/ut",
    "state ut",
    "state_ut",
    "state / u.t.",
    "state/u.t.",
    "constituency state",
    "constituency_state",
    "state",
  ],
} as const;

interface ParsedRow {
  rowNumber: number;
  name: string;
  party_letter: string;
  committee_number: number | undefined;
  constituency_name: string;
  constituency_state: string | undefined;
  errors: string[];
}

/** Download the National-format .xlsx template (one example row). */
function downloadNationalTemplate() {
  const headers = ["SRN", "Name", "Party", "Committee", "Constituency", "State / UT"];
  const sample = [1, "Aarav Vyas", "A", 1, "Varanasi", "Uttar Pradesh"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Allocated Roster");
  XLSX.writeFile(wb, "yip-allocated-roster-template.xlsx");
}

/** Lowercase+trim every key of a raw row for alias lookup. */
function lc(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) out[k.trim().toLowerCase()] = raw[k];
  return out;
}

function pick(row: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== "") return row[a];
  }
  return undefined;
}

function normalizeRow(raw: Record<string, unknown>, rowNumber: number): ParsedRow {
  const row = lc(raw);
  const errors: string[] = [];

  const nameRaw = pick(row, COL_ALIASES.name);
  const name = nameRaw !== undefined ? String(nameRaw).trim() : "";
  if (!name) errors.push("Name is required");

  const partyRaw = pick(row, COL_ALIASES.party);
  let party_letter = "";
  if (partyRaw === undefined || String(partyRaw).trim() === "") {
    errors.push("Party is required");
  } else {
    party_letter = String(partyRaw).trim().toUpperCase();
    if (!/^[A-Z]$/.test(party_letter)) {
      errors.push(`Party must be a single letter A-Z (got "${String(partyRaw).trim()}")`);
    }
  }

  const committeeRaw = pick(row, COL_ALIASES.committee);
  let committee_number: number | undefined;
  if (committeeRaw === undefined || String(committeeRaw).trim() === "") {
    errors.push("Committee is required");
  } else {
    const n = Number(String(committeeRaw).trim());
    if (!Number.isInteger(n) || n <= 0) {
      errors.push("Committee must be a positive whole number");
    } else {
      committee_number = n;
    }
  }

  const constRaw = pick(row, COL_ALIASES.constituency);
  const constituency_name = constRaw !== undefined ? String(constRaw).trim() : "";
  if (!constituency_name) errors.push("Constituency is required");

  const stateRaw = pick(row, COL_ALIASES.state);
  const constituency_state =
    stateRaw !== undefined ? String(stateRaw).trim() || undefined : undefined;

  return {
    rowNumber,
    name,
    party_letter,
    committee_number,
    constituency_name,
    constituency_state,
    errors,
  };
}

/** Minimal CSV line splitter (quote-aware). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function AllocatedRosterImport({
  eventId,
  allocationLocked,
  existingNames,
  onImported,
  label = "Upload Allocated Roster",
}: {
  eventId: string;
  allocationLocked: boolean;
  existingNames: string[];
  onImported: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [dupConfirmed, setDupConfirmed] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setParsedRows([]);
    setParseError("");
    setDupConfirmed(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function ingestRows(jsonRows: Record<string, unknown>[]) {
    // Skip fully-blank rows; +2 so the row number matches the spreadsheet
    // (row 1 = header).
    const rows: ParsedRow[] = [];
    jsonRows.forEach((raw, i) => {
      const allEmpty = Object.values(raw).every(
        (v) => v === "" || v === null || v === undefined
      );
      if (allEmpty) return;
      rows.push(normalizeRow(raw, i + 2));
    });
    if (rows.length === 0) {
      setParseError("No data rows found — the file only has a header or blank rows.");
      return;
    }
    setParsedRows(rows);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setResult(null);
    setDupConfirmed(false);
    setParsedRows([]);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const reader = new FileReader();

    if (ext === "xlsx" || ext === "xls") {
      reader.onload = (ev) => {
        try {
          const buf = ev.target?.result as ArrayBuffer;
          const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) {
            setParseError("That Excel file has no sheets.");
            return;
          }
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            wb.Sheets[sheetName],
            { defval: "" }
          );
          if (json.length === 0) {
            setParseError("The sheet is empty — add at least one student row.");
            return;
          }
          ingestRows(json);
        } catch {
          setParseError("Couldn't read that Excel file. Please check the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "csv") {
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          if (lines.length < 2) {
            setParseError("CSV needs a header row and at least one student row.");
            return;
          }
          const headers = parseCsvLine(lines[0]).map((h) => h.trim());
          const json = lines.slice(1).map((line) => {
            const cells = parseCsvLine(line);
            const obj: Record<string, unknown> = {};
            headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
            return obj;
          });
          ingestRows(json);
        } catch {
          setParseError("Couldn't read that CSV file. Please check the format.");
        }
      };
      reader.readAsText(file);
    } else {
      setParseError("Please upload a .xlsx, .xls, or .csv file.");
    }
  }

  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);
  const hasRows = parsedRows.length > 0;
  const fileRejected = invalidRows.length > 0;

  // "Vacant seat" rows = fully allocated (party + committee + constituency) but
  // no student name. National's master sheet ships with these; surfacing them
  // explicitly turns a confusing rejection into an actionable one.
  const vacantSeatRows = invalidRows.filter(
    (r) =>
      !r.name &&
      r.party_letter !== "" &&
      r.committee_number !== undefined &&
      r.constituency_name !== "" &&
      r.errors.length === 1
  );

  // Duplicate detection — names already in this event (case-insensitive).
  const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const dupNames = hasRows && !fileRejected
    ? parsedRows.filter((r) => existingSet.has(r.name.trim().toLowerCase()))
    : [];
  const needsDupConfirm = dupNames.length > 0 && !dupConfirmed;

  const canImport =
    hasRows && !fileRejected && !needsDupConfirm && !allocationLocked && !importing;

  async function handleImport() {
    if (!canImport) return;
    setImporting(true);
    const payload = parsedRows.map((r) => ({
      name: r.name,
      party_letter: r.party_letter,
      committee_number: r.committee_number as number,
      constituency_name: r.constituency_name,
      constituency_state: r.constituency_state,
    }));
    const res = await importAllocatedRoster(eventId, payload);
    if (res.success) {
      setResult(res.data);
      onImported();
    } else {
      setParseError(res.error);
    }
    setImporting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="size-4" />
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Allocated Roster</DialogTitle>
          <DialogDescription>
            Upload the National allocated student list (.xlsx / .xls / .csv).
            Columns: SRN, Name, Party (A–Z), Committee (number), Constituency,
            State / UT. Every student is added as new.
          </DialogDescription>
        </DialogHeader>

        {/* Locked */}
        {allocationLocked && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              Allocation is <span className="font-medium">locked</span> for this
              event. Unlock it on the Allocation tab before uploading a roster.
            </span>
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="size-5" />
              <span className="font-medium">
                Imported {result.imported} student
                {result.imported !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-green-700">
              Set ruling vs opposition for each party on the Allocation tab.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        )}

        {!result && !allocationLocked && (
          <>
            {/* File picker */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gray-100">
                <FileSpreadsheet className="size-5 text-gray-500" />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFile}
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF9933]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#FF9933] hover:file:bg-[#FF9933]/20"
              />
            </div>

            {/* Template */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Download className="size-4 shrink-0" />
              <span>Need the National template?</span>
              <button
                type="button"
                onClick={downloadNationalTemplate}
                className="font-medium text-[#FF9933] underline underline-offset-2 hover:text-[#E68A2E]"
              >
                Download .xlsx template
              </button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Whole-file rejection banner */}
            {fileRejected && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-medium">
                    {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} have
                    problems.
                  </span>{" "}
                  The whole file is held back — fix the rows marked in red and
                  upload again. Nothing has been imported.
                  {vacantSeatRows.length > 0 && (
                    <>
                      {" "}
                      <span className="font-medium">
                        {vacantSeatRows.length} of these are vacant seats
                      </span>{" "}
                      (a constituency is allocated but no student name is filled
                      in). Delete those rows or add the student names, then
                      re-upload.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Duplicate warning */}
            {needsDupConfirm && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-medium">
                      {dupNames.length} student
                      {dupNames.length !== 1 ? "s" : ""} in this file already exist
                      in this event
                    </span>{" "}
                    (matched by name). Importing will add them again as duplicates.
                  </span>
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#FF9933]"
                    checked={dupConfirmed}
                    onChange={(e) => setDupConfirmed(e.target.checked)}
                  />
                  Yes, add them anyway
                </label>
              </div>
            )}

            {/* Preview */}
            {hasRows && (
              <div>
                <div className="mb-2 text-sm">
                  <span className="font-medium text-green-600">
                    {parsedRows.length - invalidRows.length} ready
                  </span>
                  {invalidRows.length > 0 && (
                    <>
                      {" / "}
                      <span className="font-medium text-red-600">
                        {invalidRows.length} with problems
                      </span>
                    </>
                  )}
                </div>
                <div className="max-h-60 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Committee</TableHead>
                        <TableHead>Constituency</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row) => (
                        <TableRow
                          key={row.rowNumber}
                          className={row.errors.length > 0 ? "bg-red-50" : undefined}
                        >
                          <TableCell className="text-xs text-gray-400">
                            {row.rowNumber}
                          </TableCell>
                          <TableCell className="text-xs">{row.name || "--"}</TableCell>
                          <TableCell className="text-xs">
                            {row.party_letter || "--"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.committee_number ?? "--"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.constituency_name
                              ? row.constituency_state
                                ? `${row.constituency_name} (${row.constituency_state})`
                                : row.constituency_name
                              : "--"}
                          </TableCell>
                          <TableCell>
                            {row.errors.length > 0 ? (
                              <span className="text-xs text-red-600">
                                {row.errors.join(", ")}
                              </span>
                            ) : (
                              <Check className="size-4 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter className="mt-4">
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button
                    className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                    onClick={handleImport}
                    disabled={!canImport}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        Import {parsedRows.length} Student
                        {parsedRows.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

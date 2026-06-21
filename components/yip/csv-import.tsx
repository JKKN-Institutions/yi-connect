"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { importParticipants } from "@/app/yip/actions/participants";
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
import { Upload, FileText, Loader2, AlertCircle, Check, Download } from "lucide-react";
import { Switch } from "@/components/yip/ui/switch";

interface CsvRow {
  name: string;
  school: string;
  class: number;
  phone?: string;
  email?: string;
  // Parent / guardian mobile — the reachable contact for minors (most students
  // have no email/phone of their own). Stored as participants.parent_phone.
  parent_phone?: string;
  city?: string;
  // Roster home state. Spreadsheets that only have a `state` column get it
  // routed to constituency_state (YIP-handbook canonical meaning); a `state`
  // column is interpreted as home_state ONLY when no explicit `home_state`
  // column is present AND no allocation columns (party/constituency/committee)
  // are present. See `normalizeXlsxRow` for the full decision.
  home_state?: string;
  // NEW — allocation columns
  party_letter?: string;
  constituency_name?: string;
  constituency_number?: number;
  constituency_state?: string;
  committee_number?: number;
  committee_name?: string;
}

interface ParsedRow extends CsvRow {
  rowNumber: number;
  errors: string[];
}

// Column header aliases — case-insensitive match.
// Note: `state` is intentionally NOT in any alias list — it is handled with
// special context-aware logic in normalizeXlsxRow (and the CSV path) because
// the meaning of bare "state" depends on what other columns are present.
const COL_ALIASES: Record<
  Exclude<keyof CsvRow, "home_state" | "constituency_state"> | "home_state_explicit" | "constituency_state_explicit",
  string[]
> = {
  name: ["name", "full_name", "full name", "fullname", "student_name", "student name"],
  school: ["school", "school_name", "schoolname", "school name"],
  class: ["class", "grade", "std"],
  phone: ["phone", "mobile", "phone_number", "phone number"],
  email: ["email", "email_address", "email address", "email id", "email_id", "email-id"],
  parent_phone: [
    "parent_mobile",
    "parent mobile",
    "parent_phone",
    "parent phone",
    "parent",
    "guardian_mobile",
    "guardian mobile",
    "guardian_phone",
    "guardian phone",
  ],
  city: ["city", "town"],
  home_state_explicit: ["home_state", "home state"],
  constituency_state_explicit: ["constituency_state", "state_constituency"],
  party_letter: ["party", "party_letter", "party letter"],
  constituency_name: ["constituency", "constituency_name", "constituency name"],
  constituency_number: [
    "constituency_number",
    "constituency number",
    "constituency_no",
    "constituency no",
    "const_no",
  ],
  committee_number: ["committee", "committee_number", "committee_no", "committee number"],
  committee_name: ["committee_name"],
};

function findColIdx(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h));
}

/** Normalize a raw phone value — handles scientific notation from Excel (9.894e9) */
function normalizePhone(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const str = String(raw);
  // If it looks like scientific notation, parse as number then convert
  if (/e/i.test(str)) {
    const n = Number(str);
    if (!isNaN(n)) return Math.round(n).toString();
  }
  // Strip everything that isn't a digit
  return str.replace(/\D/g, "") || undefined;
}

/** Resolve where a bare `state` column should route, given the columns present.
 *
 * Decision rule:
 *   - If file has an explicit `home_state` (or `home state`) column → that's home_state;
 *     bare `state` (if any) → constituency_state.
 *   - Else if file has any allocation columns (party / constituency / committee)
 *     OR an explicit `constituency_state` / `state_constituency` column → bare `state` → constituency_state.
 *   - Else (legacy roster-only file) → bare `state` → home_state.
 */
function resolveStateRouting(presentKeys: string[]): "home_state" | "constituency_state" {
  const hasExplicitHomeState = COL_ALIASES.home_state_explicit.some((a) =>
    presentKeys.includes(a)
  );
  if (hasExplicitHomeState) return "constituency_state";

  const hasAllocationCols =
    COL_ALIASES.constituency_state_explicit.some((a) => presentKeys.includes(a)) ||
    COL_ALIASES.party_letter.some((a) => presentKeys.includes(a)) ||
    COL_ALIASES.constituency_name.some((a) => presentKeys.includes(a)) ||
    COL_ALIASES.committee_number.some((a) => presentKeys.includes(a));

  return hasAllocationCols ? "constituency_state" : "home_state";
}

/** Validate and map a plain JS object (from xlsx) to ParsedRow */
function normalizeXlsxRow(
  rawRow: Record<string, unknown>,
  rowNumber: number,
  bareStateRoutes: "home_state" | "constituency_state"
): ParsedRow {
  // Build a lowercase-keyed version for easy lookup
  const lc: Record<string, unknown> = {};
  for (const k of Object.keys(rawRow)) {
    lc[k.trim().toLowerCase()] = rawRow[k];
  }

  function pick(aliases: string[]): unknown {
    for (const a of aliases) {
      if (lc[a] !== undefined && lc[a] !== "") return lc[a];
    }
    return undefined;
  }

  const nameRaw = pick(COL_ALIASES.name);
  const schoolRaw = pick(COL_ALIASES.school);
  const classRaw = pick(COL_ALIASES.class);
  const phoneRaw = pick(COL_ALIASES.phone);
  const emailRaw = pick(COL_ALIASES.email);
  const parentPhoneRaw = pick(COL_ALIASES.parent_phone);
  const cityRaw = pick(COL_ALIASES.city);

  // State routing (see resolveStateRouting above)
  const homeStateExplicit = pick(COL_ALIASES.home_state_explicit);
  const constituencyStateExplicit = pick(COL_ALIASES.constituency_state_explicit);
  const bareState = lc["state"];

  let homeStateRaw: unknown = homeStateExplicit;
  let constituencyStateRaw: unknown = constituencyStateExplicit;
  if (bareState !== undefined && bareState !== "") {
    if (bareStateRoutes === "home_state" && homeStateRaw === undefined) {
      homeStateRaw = bareState;
    } else if (
      bareStateRoutes === "constituency_state" &&
      constituencyStateRaw === undefined
    ) {
      constituencyStateRaw = bareState;
    }
  }

  // Allocation columns
  const partyRaw = pick(COL_ALIASES.party_letter);
  const constituencyNameRaw = pick(COL_ALIASES.constituency_name);
  const committeeNumberRaw = pick(COL_ALIASES.committee_number);
  const committeeNameRaw = pick(COL_ALIASES.committee_name);

  const name = nameRaw !== undefined ? String(nameRaw).trim() : "";
  const school = schoolRaw !== undefined ? String(schoolRaw).trim() : "";
  const classNum = classRaw !== undefined ? Number(classRaw) : 0;
  const phone = normalizePhone(phoneRaw);
  const parent_phone = normalizePhone(parentPhoneRaw);
  const email = emailRaw !== undefined ? String(emailRaw).trim() || undefined : undefined;
  const city = cityRaw !== undefined ? String(cityRaw).trim() || undefined : undefined;
  const home_state =
    homeStateRaw !== undefined ? String(homeStateRaw).trim() || undefined : undefined;
  const constituency_state =
    constituencyStateRaw !== undefined
      ? String(constituencyStateRaw).trim() || undefined
      : undefined;

  let party_letter: string | undefined;
  if (partyRaw !== undefined && partyRaw !== "") {
    party_letter = String(partyRaw).trim().toUpperCase();
  }
  const constituency_name =
    constituencyNameRaw !== undefined
      ? String(constituencyNameRaw).trim() || undefined
      : undefined;
  const constituencyNumberRaw = pick(COL_ALIASES.constituency_number);
  let constituency_number: number | undefined;
  if (constituencyNumberRaw !== undefined && constituencyNumberRaw !== "") {
    const n = Number(constituencyNumberRaw);
    if (!isNaN(n)) constituency_number = n;
  }

  let committee_number: number | undefined;
  if (committeeNumberRaw !== undefined && committeeNumberRaw !== "") {
    const n = Number(committeeNumberRaw);
    if (!isNaN(n)) committee_number = n;
  }
  const committee_name =
    committeeNameRaw !== undefined
      ? String(committeeNameRaw).trim() || undefined
      : undefined;

  const errors: string[] = [];
  // Name-only registration: the student's name is the only required field.
  // School and contact are optional — kept only if those columns are present.
  if (!name) errors.push("Name is required");
  // Class is NOT collected in the roster (dropped). participants.class is NOT
  // NULL, so we default to 10 internally. If a stray class value is present it
  // must still be 9-12.
  if (classRaw !== undefined && classRaw !== "" && (classNum < 9 || classNum > 12))
    errors.push("Class must be 9-12");
  if (party_letter !== undefined && !/^[A-Z]$/.test(party_letter))
    errors.push(`Party must be a single letter A-Z (got "${party_letter}")`);
  if (
    committee_number !== undefined &&
    (!Number.isInteger(committee_number) || committee_number <= 0)
  )
    errors.push("Committee must be a positive integer");

  return {
    rowNumber,
    name,
    school,
    class: !classNum || isNaN(classNum) ? 10 : classNum,
    phone,
    parent_phone,
    email,
    city,
    home_state,
    constituency_state,
    party_letter,
    constituency_name,
    constituency_number,
    committee_number,
    committee_name,
    errors,
  };
}

/** Distinct, valid party letters in a parsed batch. */
function distinctPartyCount(rows: ParsedRow[]): number {
  return new Set(
    rows.filter((r) => r.errors.length === 0 && r.party_letter).map((r) => r.party_letter)
  ).size;
}

/** Default for the government/opposition bench toggle when a file is parsed:
 * ON for a classic 2-party (or single-party) roster, OFF for multi-party (>2)
 * rosters like Nashik (5 lettered parties) where there is no bench split.
 * No party columns at all → irrelevant, leave ON. */
function defaultAssignBenches(): boolean {
  // Benchless platform: Ruling/Opposition is decided on event day, not at
  // upload. Import flat by default — the organiser can flip benches later.
  return false;
}

/** Download a one-row .xlsx template */
function downloadXlsxTemplate() {
  // Pre-allocated roster template — the standardised 5 columns. (All allocation
  // columns are optional; a name-only sheet still works for chapters that
  // auto-allocate in the app instead.)
  const headers = [
    "Name",
    "Party Letter",
    "Constituency Number",
    "Constituency Name",
    "Committee Number",
  ];
  const sample = ["Arjun Kumar", "A", "101", "Bangalore South", "3"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Participants");
  XLSX.writeFile(wb, "yip-roster-template.xlsx");
}

export function CsvImport({
  eventId,
  onImported,
}: {
  eventId: string;
  onImported: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);
  const [parseError, setParseError] = useState("");
  // Government/opposition benches for lettered-party rosters. Reset to the
  // count-based default each time a new file is parsed; operator can override.
  const [assignBenches, setAssignBenches] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setParsedRows([]);
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setParseError("");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isExcel = ext === "xlsx" || ext === "xls";

    if (isExcel) {
      // ── Excel path ──────────────────────────────────────────────────────────
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            setParseError("Excel file has no sheets.");
            return;
          }
          const sheet = workbook.Sheets[firstSheetName];
          // defval: "" so blank cells come through as empty strings
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            sheet,
            { defval: "" }
          );

          if (jsonRows.length === 0) {
            setParseError("Excel sheet is empty — add at least one data row.");
            return;
          }

          // Resolve column presence ONCE, off the first row's keys
          const firstRaw = jsonRows[0];
          const keys = Object.keys(firstRaw).map((k) => k.trim().toLowerCase());
          const hasName = COL_ALIASES.name.some((a) => keys.includes(a));
          if (!hasName) {
            setParseError(
              `Excel must have a "name" column. Found: ${keys.join(", ")}`
            );
            return;
          }
          const bareStateRoutes = resolveStateRouting(keys);

          // Skip entirely-blank rows
          const rows: ParsedRow[] = [];
          for (let i = 0; i < jsonRows.length; i++) {
            const raw = jsonRows[i];
            const allEmpty = Object.values(raw).every(
              (v) => v === "" || v === null || v === undefined
            );
            if (allEmpty) continue;
            rows.push(normalizeXlsxRow(raw, i + 2, bareStateRoutes)); // +2 because row 1 = header
          }

          if (rows.length === 0) {
            setParseError("No data rows found after skipping blank rows.");
            return;
          }

          setParsedRows(rows);
          setAssignBenches(defaultAssignBenches());
        } catch {
          setParseError("Failed to parse Excel file. Please check the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // ── CSV path (unchanged) ─────────────────────────────────────────────────
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          if (lines.length < 2) {
            setParseError("CSV must have a header row and at least one data row");
            return;
          }

          // Parse header
          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

          // Map expected columns
          const nameIdx = findColIdx(headers, COL_ALIASES.name);
          const schoolIdx = findColIdx(headers, COL_ALIASES.school);
          const classIdx = findColIdx(headers, COL_ALIASES.class);
          const phoneIdx = findColIdx(headers, COL_ALIASES.phone);
          const emailIdx = findColIdx(headers, COL_ALIASES.email);
          const parentPhoneIdx = findColIdx(headers, COL_ALIASES.parent_phone);
          const cityIdx = findColIdx(headers, COL_ALIASES.city);
          const homeStateExplicitIdx = findColIdx(headers, COL_ALIASES.home_state_explicit);
          const constStateExplicitIdx = findColIdx(
            headers,
            COL_ALIASES.constituency_state_explicit
          );
          const bareStateIdx = headers.findIndex((h) => h === "state");
          const partyIdx = findColIdx(headers, COL_ALIASES.party_letter);
          const constNameIdx = findColIdx(headers, COL_ALIASES.constituency_name);
          const constNumIdx = findColIdx(headers, COL_ALIASES.constituency_number);
          const committeeNumIdx = findColIdx(headers, COL_ALIASES.committee_number);
          const committeeNameIdx = findColIdx(headers, COL_ALIASES.committee_name);

          if (nameIdx === -1) {
            setParseError('CSV must have a "name" column.');
            return;
          }

          const bareStateRoutes = resolveStateRouting(headers);

          // Parse rows
          const rows: ParsedRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const errors: string[] = [];

            const name = cols[nameIdx]?.trim() || "";
            const school = cols[schoolIdx]?.trim() || "";
            const classVal =
              classIdx >= 0 ? parseInt(cols[classIdx]?.trim() || "0") : 0;
            const emailVal = emailIdx >= 0 ? cols[emailIdx]?.trim() : undefined;
            const parentVal =
              parentPhoneIdx >= 0 ? normalizePhone(cols[parentPhoneIdx]) : undefined;

            // Name-only registration: only the name is required.
            if (!name) errors.push("Name is required");
            if (classIdx >= 0 && cols[classIdx]?.trim() && (classVal < 9 || classVal > 12))
              errors.push("Class must be 9-12");

            // State routing
            const homeStateExplicit =
              homeStateExplicitIdx >= 0 ? cols[homeStateExplicitIdx]?.trim() : undefined;
            const constStateExplicit =
              constStateExplicitIdx >= 0 ? cols[constStateExplicitIdx]?.trim() : undefined;
            const bareState =
              bareStateIdx >= 0 ? cols[bareStateIdx]?.trim() : undefined;

            let home_state: string | undefined = homeStateExplicit || undefined;
            let constituency_state: string | undefined = constStateExplicit || undefined;
            if (bareState) {
              if (bareStateRoutes === "home_state" && !home_state) home_state = bareState;
              else if (bareStateRoutes === "constituency_state" && !constituency_state)
                constituency_state = bareState;
            }

            // Allocation cols
            let party_letter: string | undefined;
            if (partyIdx >= 0) {
              const raw = cols[partyIdx]?.trim();
              if (raw) {
                party_letter = raw.toUpperCase();
                if (!/^[A-Z]$/.test(party_letter))
                  errors.push(`Party must be a single letter A-Z (got "${party_letter}")`);
              }
            }
            const constituency_name =
              constNameIdx >= 0 ? cols[constNameIdx]?.trim() || undefined : undefined;
            let constituency_number: number | undefined;
            if (constNumIdx >= 0) {
              const raw = cols[constNumIdx]?.trim();
              if (raw) {
                const n = Number(raw);
                if (!isNaN(n)) constituency_number = n;
              }
            }
            let committee_number: number | undefined;
            if (committeeNumIdx >= 0) {
              const raw = cols[committeeNumIdx]?.trim();
              if (raw) {
                const n = Number(raw);
                if (!isNaN(n)) committee_number = n;
                if (
                  committee_number !== undefined &&
                  (!Number.isInteger(committee_number) || committee_number <= 0)
                )
                  errors.push("Committee must be a positive integer");
              }
            }
            const committee_name =
              committeeNameIdx >= 0
                ? cols[committeeNameIdx]?.trim() || undefined
                : undefined;

            rows.push({
              rowNumber: i + 1,
              name,
              school,
              class: classVal && classVal >= 9 && classVal <= 12 ? classVal : 10,
              phone:
                phoneIdx >= 0
                  ? normalizePhone(cols[phoneIdx])
                  : undefined,
              parent_phone: parentVal,
              email: emailVal,
              city: cityIdx >= 0 ? cols[cityIdx]?.trim() : undefined,
              home_state,
              constituency_state,
              party_letter,
              constituency_name,
              constituency_number,
              committee_number,
              committee_name,
              errors,
            });
          }

          setParsedRows(rows);
          setAssignBenches(defaultAssignBenches());
        } catch {
          setParseError("Failed to parse CSV file. Please check the format.");
        }
      };
      reader.readAsText(file);
    }
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  async function handleImport() {
    if (validRows.length === 0) return;

    setImporting(true);
    const importData = validRows.map((r) => ({
      name: r.name,
      school: r.school,
      class: r.class,
      phone: r.phone,
      parent_phone: r.parent_phone,
      email: r.email,
      city: r.city,
      home_state: r.home_state,
      party_letter: r.party_letter,
      constituency_name: r.constituency_name,
      constituency_number: r.constituency_number,
      constituency_state: r.constituency_state,
      committee_number: r.committee_number,
      committee_name: r.committee_name,
    }));

    const res = await importParticipants(eventId, importData, { assignBenches });

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
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetState();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="size-4" />
        Import CSV / Excel
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Participants</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel (.xlsx / .xls) file with a <strong>name</strong> column — one student per row. The name is the only field collected; an access code is generated for each.
          </DialogDescription>
        </DialogHeader>

        {/* Success result */}
        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="size-5" />
              <span className="font-medium">
                Successfully imported {result.imported} student
                {result.imported !== 1 ? "s" : ""}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 text-sm text-yellow-700">
                <p className="font-medium">Some rows had issues:</p>
                <ul className="mt-1 list-disc pl-4">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => {
                setDialogOpen(false);
                resetState();
              }}
            >
              Done
            </Button>
          </div>
        )}

        {/* File picker */}
        {!result && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <FileText className="size-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileSelect}
                  className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF9933]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#FF9933] hover:file:bg-[#FF9933]/20"
                />
              </div>
            </div>

            {/* Template download */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Download className="size-4 shrink-0" />
              <span>Need a template?</span>
              <button
                type="button"
                onClick={downloadXlsxTemplate}
                className="font-medium text-[#FF9933] underline underline-offset-2 hover:text-[#E68A2E]"
              >
                Download .xlsx template
              </button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>
                    <span className="font-medium text-green-600">
                      {validRows.length} valid
                    </span>
                    {invalidRows.length > 0 && (
                      <>
                        {" / "}
                        <span className="font-medium text-red-600">
                          {invalidRows.length} invalid
                        </span>
                      </>
                    )}
                    {" rows found"}
                  </span>
                </div>

                {(() => {
                  const showAllocCols = parsedRows.some(
                    (r) =>
                      r.party_letter ||
                      r.constituency_name ||
                      r.committee_number !== undefined
                  );
                  return (
                    <div className="max-h-60 overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Name</TableHead>
                            {showAllocCols && (
                              <>
                                <TableHead>Party</TableHead>
                                <TableHead>Constituency</TableHead>
                                <TableHead>Committee</TableHead>
                              </>
                            )}
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedRows.map((row) => (
                            <TableRow
                              key={row.rowNumber}
                              className={
                                row.errors.length > 0 ? "bg-red-50" : undefined
                              }
                            >
                              <TableCell className="text-xs text-gray-400">
                                {row.rowNumber}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.name || "--"}
                              </TableCell>
                              {showAllocCols && (
                                <>
                                  <TableCell className="text-xs">
                                    {row.party_letter || "--"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {row.constituency_name
                                      ? row.constituency_state
                                        ? `${row.constituency_name} (${row.constituency_state})`
                                        : row.constituency_name
                                      : "--"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {row.committee_number !== undefined
                                      ? row.committee_number
                                      : "--"}
                                  </TableCell>
                                </>
                              )}
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
                  );
                })()}

                {/* Bench toggle — only when the roster carries lettered parties */}
                {distinctPartyCount(parsedRows) > 0 && (
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        Assign Government / Opposition benches
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {assignBenches
                          ? "First party becomes Government, the rest Opposition."
                          : `Flat house — all ${distinctPartyCount(parsedRows)} parties stay neutral (no bench). Assign benches later if needed.`}
                      </p>
                    </div>
                    <Switch
                      checked={assignBenches}
                      onCheckedChange={(v: boolean) => setAssignBenches(v)}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                    onClick={handleImport}
                    disabled={importing || validRows.length === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        Import {validRows.length} Student
                        {validRows.length !== 1 ? "s" : ""}
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

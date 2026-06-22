"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { importVolunteers } from "@/app/yip/actions/volunteers";
import { VOLUNTEER_STATIONS, type VolunteerStation } from "@/lib/yip/volunteers";
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
import { Upload, FileText, Loader2, AlertCircle, Check } from "lucide-react";

type VolunteerRow = {
  full_name: string;
  phone: string;
  email: string;
  station: VolunteerStation;
  stationRaw: string;
  shift: string;
  tshirt_size: string;
  is_yuva: boolean;
};

// Header aliases — matched case- and punctuation-insensitively (same convention
// as the participant importer, so the app's own export headers round-trip).
const COL_ALIASES = {
  name: ["name", "full_name", "full name", "fullname", "volunteer", "volunteer name"],
  phone: ["phone", "mobile", "phone_number", "phone number", "contact"],
  email: ["email", "email_address", "email address", "email id", "email_id"],
  station: ["station", "role", "desk", "duty", "assignment"],
  shift: ["shift", "slot", "timing", "time"],
  tshirt_size: ["tshirt", "t-shirt", "tshirt_size", "t-shirt size", "tshirt size", "size", "shirt"],
  is_yuva: ["yuva", "is_yuva", "is yuva", "yuva?", "yuva member"],
} as const;

// Normalize a header/value for matching: lowercase, collapse every run of
// non-alphanumerics to a single space.
function normHeader(s: string): string {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// code + label → code, for resolving the Station column.
const STATION_LOOKUP = new Map<string, VolunteerStation>();
for (const s of VOLUNTEER_STATIONS) {
  STATION_LOOKUP.set(normHeader(s.code), s.code);
  STATION_LOOKUP.set(normHeader(s.label), s.code);
}
function resolveStation(raw: string): VolunteerStation {
  if (!raw.trim()) return "floating";
  return STATION_LOOKUP.get(normHeader(raw)) ?? "floating";
}

function normalizePhone(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const str = String(raw);
  if (/e/i.test(str)) {
    const n = Number(str);
    if (!isNaN(n)) return Math.round(n).toString();
  }
  return str.replace(/\D/g, "");
}

// Blank → true (default), only an explicit negative turns it off.
function parseYuva(raw: unknown): boolean {
  const v = normHeader(String(raw ?? ""));
  if (v === "" ) return true;
  return !["no", "n", "false", "0", "non yuva", "nonyuva", "non"].includes(v);
}

function findKey(keys: string[], aliases: readonly string[]): string | null {
  const wanted = new Set(aliases.map(normHeader));
  return keys.find((k) => wanted.has(normHeader(k))) ?? null;
}

export function VolunteerCsvImport({
  eventId,
  onImported,
}: {
  eventId: string;
  onImported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<VolunteerRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setParseError("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          setParseError("File has no sheets.");
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          wb.Sheets[sheetName],
          { defval: "" }
        );
        if (json.length === 0) {
          setParseError("Sheet is empty — add at least one volunteer row.");
          return;
        }

        const keys = Object.keys(json[0]);
        const kName = findKey(keys, COL_ALIASES.name);
        if (!kName) {
          setParseError(`Need a "Name" column. Found: ${keys.join(", ") || "(none)"}`);
          return;
        }
        const kPhone = findKey(keys, COL_ALIASES.phone);
        const kEmail = findKey(keys, COL_ALIASES.email);
        const kStation = findKey(keys, COL_ALIASES.station);
        const kShift = findKey(keys, COL_ALIASES.shift);
        const kSize = findKey(keys, COL_ALIASES.tshirt_size);
        const kYuva = findKey(keys, COL_ALIASES.is_yuva);

        const parsed: VolunteerRow[] = [];
        for (const raw of json) {
          const name = String(raw[kName] ?? "").trim();
          const allEmpty = Object.values(raw).every(
            (v) => v === "" || v === null || v === undefined
          );
          if (allEmpty) continue;
          if (!name) continue; // skip nameless rows
          const stationRaw = kStation ? String(raw[kStation] ?? "").trim() : "";
          parsed.push({
            full_name: name,
            phone: kPhone ? normalizePhone(raw[kPhone]) : "",
            email: kEmail ? String(raw[kEmail] ?? "").trim() : "",
            station: resolveStation(stationRaw),
            stationRaw,
            shift: kShift ? String(raw[kShift] ?? "").trim() : "",
            tshirt_size: kSize ? String(raw[kSize] ?? "").trim() : "",
            is_yuva: kYuva ? parseYuva(raw[kYuva]) : true,
          });
        }
        if (parsed.length === 0) {
          setParseError("No named volunteer rows found.");
          return;
        }
        setRows(parsed);
      } catch (err) {
        setParseError(
          `Could not read the file: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const res = await importVolunteers(
      eventId,
      rows.map((r) => ({
        full_name: r.full_name,
        phone: r.phone || null,
        email: r.email || null,
        station: r.station,
        shift: r.shift || null,
        tshirt_size: r.tshirt_size || null,
        is_yuva: r.is_yuva,
      }))
    );
    setImporting(false);
    if (!res.success) {
      setParseError(res.error);
      return;
    }
    setResult(res.data);
    setRows([]);
    onImported?.();
  }

  const stationLabel = (code: VolunteerStation) =>
    VOLUNTEER_STATIONS.find((s) => s.code === code)?.label ?? code;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="size-4 mr-2" />
        Import roster
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import volunteer roster</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Only <strong>Name</strong> is required.
            Optional columns: Phone, Email, Station, Shift, T-Shirt Size, Yuva.
            Station names resolve to the standard stations (anything unknown
            becomes “Floating”). Importing adds to the existing list.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/20 px-4 py-3 text-sm text-[#138808] flex items-center gap-2">
            <Check className="size-4 shrink-0" />
            Imported {result.inserted} volunteer{result.inserted === 1 ? "" : "s"}.
            {result.skipped > 0 && ` Skipped ${result.skipped} row(s) with no name.`}
          </div>
        ) : (
          <>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 cursor-pointer hover:bg-gray-50">
              <FileText className="size-7 text-gray-400" />
              <span className="text-sm text-gray-600">
                Click to choose a CSV or Excel file
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {parseError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {rows.length > 0 && (
              <>
                <p className="text-sm text-gray-600">
                  {rows.length} volunteer{rows.length === 1 ? "" : "s"} ready to import:
                </p>
                <div className="rounded-lg border max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Yuva</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.full_name}</TableCell>
                          <TableCell>
                            {stationLabel(r.station)}
                            {r.stationRaw &&
                              normHeader(r.stationRaw) !== normHeader(stationLabel(r.station)) &&
                              normHeader(r.stationRaw) !== normHeader(r.station) && (
                                <span className="text-xs text-gray-400"> ← “{r.stationRaw}”</span>
                              )}
                          </TableCell>
                          <TableCell>{r.phone || "—"}</TableCell>
                          <TableCell>{r.shift || "—"}</TableCell>
                          <TableCell>{r.is_yuva ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 50 && (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      …and {rows.length - 50} more (all will be imported)
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <DialogFooter className="mt-4">
          <DialogClose render={<Button variant="outline" />}>
            {result ? "Done" : "Cancel"}
          </DialogClose>
          {!result && rows.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
            >
              {importing ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Upload className="size-4 mr-2" />
              )}
              Import {rows.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

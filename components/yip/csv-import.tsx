"use client";

import { useState, useRef } from "react";
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
import { Upload, FileText, Loader2, AlertCircle, Check } from "lucide-react";

interface CsvRow {
  name: string;
  school: string;
  class: number;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
}

interface ParsedRow extends CsvRow {
  rowNumber: number;
  errors: string[];
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
        const nameIdx = headers.findIndex((h) =>
          ["name", "full_name", "fullname", "student_name", "student name"].includes(h)
        );
        const schoolIdx = headers.findIndex((h) =>
          ["school", "school_name", "schoolname", "school name"].includes(h)
        );
        const classIdx = headers.findIndex((h) =>
          ["class", "grade", "std"].includes(h)
        );
        const phoneIdx = headers.findIndex((h) =>
          ["phone", "mobile", "phone_number", "phone number"].includes(h)
        );
        const emailIdx = headers.findIndex((h) =>
          ["email", "email_address", "email address"].includes(h)
        );
        const cityIdx = headers.findIndex((h) =>
          ["city", "town"].includes(h)
        );
        const stateIdx = headers.findIndex((h) =>
          ["state", "home_state", "home state"].includes(h)
        );

        if (nameIdx === -1) {
          setParseError(
            'CSV must have a "name" column. Expected columns: name, school, class, phone, email, city, state'
          );
          return;
        }
        if (schoolIdx === -1) {
          setParseError(
            'CSV must have a "school" column. Expected columns: name, school, class, phone, email, city, state'
          );
          return;
        }

        // Parse rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const errors: string[] = [];

          const name = cols[nameIdx]?.trim() || "";
          const school = cols[schoolIdx]?.trim() || "";
          const classVal = classIdx >= 0 ? parseInt(cols[classIdx]?.trim() || "0") : 0;

          if (!name) errors.push("Name is required");
          if (!school) errors.push("School is required");
          if (classIdx >= 0 && (classVal < 9 || classVal > 12))
            errors.push("Class must be 9-12");

          rows.push({
            rowNumber: i + 1,
            name,
            school,
            class: classVal || 10,
            phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() : undefined,
            email: emailIdx >= 0 ? cols[emailIdx]?.trim() : undefined,
            city: cityIdx >= 0 ? cols[cityIdx]?.trim() : undefined,
            state: stateIdx >= 0 ? cols[stateIdx]?.trim() : undefined,
            errors,
          });
        }

        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
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
      email: r.email,
      city: r.city,
      state: r.state,
    }));

    const res = await importParticipants(eventId, importData);

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
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Upload className="size-4" />
        Import CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Participants from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: name, school, class, phone, email,
            city, state
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
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF9933]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#FF9933] hover:file:bg-[#FF9933]/20"
                />
              </div>
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

                <div className="max-h-60 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Class</TableHead>
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
                          <TableCell className="text-xs">{row.name || "--"}</TableCell>
                          <TableCell className="text-xs">{row.school || "--"}</TableCell>
                          <TableCell className="text-xs">{row.class || "--"}</TableCell>
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

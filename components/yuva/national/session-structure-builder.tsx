"use client";

/**
 * Yi Youth Academy — session structure builder (Phase 4).
 * Ordered session rows: name, duration (minutes), learning objective,
 * description, "expects student work" toggle and a per-session document
 * upload (course material → private yuva-materials bucket under
 * program/{programId}/ via uploadSessionDocument). Add / remove / reorder
 * with a live total-hours readout; 8–10 sessions typical.
 *
 * Save replaces the program's session rows wholesale and recomputes
 * total_minutes (saveProgramSessions). Template rule: structure changes
 * affect NEW runs only — existing runs keep their snapshot.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  saveProgramSessions,
  uploadSessionDocument,
} from "@/app/youth-academy/actions/programs";

const MAX_SESSIONS = 30;
const MAX_FILE_BYTES = 6 * 1024 * 1024; // matches the server-side cap (~6 MB)

type SessionRowState = {
  key: string; // client-only identity for list rendering
  name: string;
  durationMinutes: string; // string while editing; parsed on save
  learningObjective: string;
  description: string;
  expectsSubmission: boolean;
  documentStoragePath: string | null;
  uploading: boolean;
};

export type SessionBuilderInitialSession = {
  name: string;
  duration_minutes: number;
  learning_objective: string | null;
  description: string | null;
  document_storage_path: string | null;
  expects_submission: boolean;
};

function newRow(partial?: Partial<SessionRowState>): SessionRowState {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name: "",
    durationMinutes: "60",
    learningObjective: "",
    description: "",
    expectsSubmission: false,
    documentStoragePath: null,
    uploading: false,
    ...partial,
  };
}

function formatMinutes(total: number): string {
  if (total <= 0) return "0h 0m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${minutes}m`;
}

/** Display name of an uploaded document — the path tail minus the timestamp prefix. */
function documentDisplayName(path: string): string {
  const tail = path.split("/").pop() ?? path;
  return tail.replace(/^\d+-/, "");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SessionStructureBuilder({
  programId,
  initialSessions,
}: {
  programId: string;
  initialSessions: SessionBuilderInitialSession[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<SessionRowState[]>(() =>
    initialSessions.map((s) =>
      newRow({
        name: s.name,
        durationMinutes: String(s.duration_minutes),
        learningObjective: s.learning_objective ?? "",
        description: s.description ?? "",
        expectsSubmission: s.expects_submission,
        documentStoragePath: s.document_storage_path,
      })
    )
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const totalMinutes = rows.reduce((sum, row) => {
    const parsed = parseInt(row.durationMinutes, 10);
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  }, 0);

  function patchRow(key: string, patch: Partial<SessionRowState>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    if (rows.length >= MAX_SESSIONS) {
      toast({
        description: `At most ${MAX_SESSIONS} sessions per program`,
        variant: "destructive",
      });
      return;
    }
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleFilePicked(key: string, file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast({
        description: "Document must be 6 MB or smaller",
        variant: "destructive",
      });
      return;
    }
    patchRow(key, { uploading: true });
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadSessionDocument({
        programId,
        fileName: file.name,
        contentType: file.type || "application/pdf",
        base64,
      });
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        patchRow(key, { uploading: false });
        return;
      }
      patchRow(key, {
        documentStoragePath: result.data.path,
        uploading: false,
      });
      toast({
        description:
          "Document uploaded — remember to save the session structure",
      });
    } catch {
      toast({
        description: "Could not read the selected file",
        variant: "destructive",
      });
      patchRow(key, { uploading: false });
    }
  }

  function validateRows(): boolean {
    const errors: Record<string, string> = {};
    rows.forEach((row) => {
      const duration = parseInt(row.durationMinutes, 10);
      if (!row.name.trim()) {
        errors[row.key] = "Session name is required";
      } else if (!Number.isFinite(duration) || duration < 1) {
        errors[row.key] = "Duration must be a positive number of minutes";
      } else if (duration > 600) {
        errors[row.key] = "Duration must be 600 minutes or less";
      }
    });
    setRowErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function save() {
    if (!validateRows()) {
      toast({
        description: "Fix the highlighted sessions before saving",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const result = await saveProgramSessions(
        programId,
        rows.map((row) => ({
          name: row.name.trim(),
          duration_minutes: parseInt(row.durationMinutes, 10),
          learning_objective: row.learningObjective.trim(),
          description: row.description.trim(),
          document_storage_path: row.documentStoragePath,
          expects_submission: row.expectsSubmission,
        }))
      );
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        return;
      }
      toast({
        description: `Session structure saved — ${rows.length} session${rows.length === 1 ? "" : "s"}, ${formatMinutes(result.data.totalMinutes)} total`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No sessions yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Add the ordered session structure — 8–10 sessions typical. The
            program cannot be approved with zero sessions.
          </p>
        </div>
      )}

      {rows.map((row, index) => (
        <div
          key={row.key}
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Session {index + 1}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move session ${index + 1} up`}
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move session ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove session ${index + 1}`}
                className="text-slate-400 hover:text-rose-600"
                onClick={() => removeRow(row.key)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div className="space-y-1.5">
              <Label htmlFor={`session-name-${row.key}`}>Name</Label>
              <Input
                id={`session-name-${row.key}`}
                value={row.name}
                maxLength={200}
                placeholder="e.g. Ideation & Opportunity Spotting"
                onChange={(e) => patchRow(row.key, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`session-duration-${row.key}`}>
                Duration (min)
              </Label>
              <Input
                id={`session-duration-${row.key}`}
                type="number"
                min={1}
                max={600}
                value={row.durationMinutes}
                onChange={(e) =>
                  patchRow(row.key, { durationMinutes: e.target.value })
                }
              />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={`session-objective-${row.key}`}>
              Learning objective
            </Label>
            <Input
              id={`session-objective-${row.key}`}
              value={row.learningObjective}
              maxLength={1000}
              placeholder="What participants learn in this session"
              onChange={(e) =>
                patchRow(row.key, { learningObjective: e.target.value })
              }
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={`session-description-${row.key}`}>
              Description
            </Label>
            <Textarea
              id={`session-description-${row.key}`}
              rows={2}
              value={row.description}
              maxLength={3000}
              placeholder="Optional — session flow, activities, format"
              onChange={(e) =>
                patchRow(row.key, { description: e.target.value })
              }
            />
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Per-session course-material document */}
            <div className="flex min-w-0 items-center gap-2">
              <input
                ref={(el) => {
                  fileInputs.current[row.key] = el;
                }}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFilePicked(row.key, file);
                  e.target.value = "";
                }}
              />
              {row.documentStoragePath ? (
                <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  <FileText className="size-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {documentDisplayName(row.documentStoragePath)}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove session document"
                    className="shrink-0 text-slate-400 transition-colors hover:text-rose-600"
                    onClick={() =>
                      patchRow(row.key, { documentStoragePath: null })
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={row.uploading}
                onClick={() => fileInputs.current[row.key]?.click()}
              >
                {row.uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
                {row.documentStoragePath
                  ? "Replace document"
                  : "Upload session document"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id={`session-expects-${row.key}`}
                checked={row.expectsSubmission}
                onCheckedChange={(checked) =>
                  patchRow(row.key, { expectsSubmission: checked })
                }
              />
              <Label
                htmlFor={`session-expects-${row.key}`}
                className="text-sm font-normal text-slate-600"
              >
                Expects student work
              </Label>
            </div>
          </div>

          {rowErrors[row.key] && (
            <p className="mt-3 text-sm font-medium text-rose-600">
              {rowErrors[row.key]}
            </p>
          )}
        </div>
      ))}

      {/* Footer: add + live total-hours readout + save */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="size-4" />
            Add session
          </Button>
          <p className="text-sm text-slate-500">8–10 sessions typical</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{rows.length}</span> session
            {rows.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold">
              {formatMinutes(totalMinutes)}
            </span>{" "}
            total
          </p>
          <Button type="button" onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Save session structure
          </Button>
        </div>
      </div>
    </div>
  );
}

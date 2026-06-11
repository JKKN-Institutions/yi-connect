"use client";

/**
 * Certificate signatories editor (decision 2026-06-11: "choose later in the
 * UI" — signature blocks are no longer hardcoded Chapter Chair / Institution
 * Coordinator). Up to 3 rows of label (required) + name (optional).
 *
 * Gated server-side by getYuvaAccess().canManageAcademy via
 * updateAcademySignatories — signatory NAMES are chapter knowledge, so the
 * own-chapter admin / coordinator may set them, not just national. Empty list
 * → the certificate falls back to the two generic blocks.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAcademySignatories } from "@/app/youth-academy/actions/academies";
import type { AcademySignatory } from "@/components/yuva/academies/data";

const MAX_SIGNATORIES = 3;

type Row = { label: string; name: string };

export function SignatoriesEditor({
  academyId,
  initialSignatories,
  canEdit,
}: {
  academyId: string;
  initialSignatories: AcademySignatory[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => toRows(initialSignatories));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setRows(toRows(initialSignatories));
    setEditing(true);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) =>
      prev.length >= MAX_SIGNATORIES ? prev : [...prev, { label: "", name: "" }]
    );
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave() {
    // Drop rows with a blank label client-side (server validates label too).
    const payload = rows
      .map((r) => ({ label: r.label.trim(), name: r.name.trim() || null }))
      .filter((r) => r.label.length > 0);

    setSaving(true);
    const result = await updateAcademySignatories(academyId, payload);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data.count === 0
        ? "Signatures cleared — certificates use the default blocks."
        : "Certificate signatures saved"
    );
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {initialSignatories.length > 0 ? (
          <ul className="space-y-1.5">
            {initialSignatories.map((s, i) => (
              <li key={i} className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{s.label}</span>
                {s.name ? (
                  <span className="text-slate-500"> — {s.name}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-slate-400">
            No signatures configured — certificates show the default blocks
            (Chapter Chair · Institution Coordinator).
          </p>
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEditing}
          >
            <PencilLine className="size-4" />
            {initialSignatories.length > 0
              ? "Edit signatures"
              : "Set signatures"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm italic text-slate-400">
          No signatures — the certificate will use the default blocks.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label htmlFor={`sig-label-${i}`}>Title / role</Label>
                <Input
                  id={`sig-label-${i}`}
                  value={row.label}
                  maxLength={80}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="e.g. Chapter Chair"
                />
              </div>
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label htmlFor={`sig-name-${i}`}>Name (optional)</Label>
                <Input
                  id={`sig-name-${i}`}
                  value={row.name}
                  maxLength={120}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  placeholder="e.g. R. Kumar"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                aria-label="Remove signature"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {rows.length < MAX_SIGNATORIES ? (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add signature
        </Button>
      ) : (
        <p className="text-xs text-slate-400">
          Maximum of {MAX_SIGNATORIES} signatures on a certificate.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function toRows(signatories: AcademySignatory[]): Row[] {
  return signatories.map((s) => ({ label: s.label, name: s.name ?? "" }));
}

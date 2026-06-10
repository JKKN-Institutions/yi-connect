"use client";

/**
 * Qualitative outcomes editor (spec: free-text qualitative outcomes per
 * academy, editable by chapter/national, included in the quarterly CSV).
 * Gated server-side by getYuvaAccess().canManageAcademy.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateQualitativeNotes } from "@/app/youth-academy/actions/academies";

export function QualitativeNotesEditor({
  academyId,
  initialNotes,
  canEdit,
}: {
  academyId: string;
  initialNotes: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    const result = await updateQualitativeNotes({
      academyId,
      notes: draft,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Qualitative outcomes saved");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {initialNotes ? (
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {initialNotes}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">
            No qualitative outcomes recorded yet.
          </p>
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(initialNotes ?? "");
              setEditing(true);
            }}
          >
            <PencilLine className="size-4" />
            {initialNotes ? "Edit outcomes" : "Add outcomes"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        maxLength={10_000}
        placeholder="Stories, impact highlights, partnerships, anything worth carrying into the quarterly report…"
      />
      <div className="flex gap-2">
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

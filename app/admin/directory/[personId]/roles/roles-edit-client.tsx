/**
 * Directory Admin — Roles Edit Client (Phase B, 2026-05-28)
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Star,
  StarOff,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  DirectoryPersonDetail,
  RoleAssignmentRow,
} from "../../actions/directory-reads";
import {
  addRoleAssignment,
  updateRoleAssignment,
  deactivateRoleAssignment,
} from "../../actions/directory-mutations";

const KNOWN_APPS = ["yip", "future", "yuva", "thalir", "masoom", "yi"] as const;
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

/**
 * Convert a tz-naive datetime-local value ("2026-06-20T17:30") to a UTC ISO
 * string via an explicit Date — NEVER string-concat (that drops the IST→UTC
 * offset and silently stores the wrong instant).
 */
function localToISO(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Status of a role's validity window relative to now. */
function windowStatus(
  validFrom: string | null,
  validUntil: string | null
): { kind: "open" | "scheduled" | "expired" | "active-window"; label: string } | null {
  const now = Date.now();
  if (validFrom) {
    const from = Date.parse(validFrom);
    if (!Number.isNaN(from) && now < from) {
      return { kind: "scheduled", label: `Scheduled · from ${new Date(from).toLocaleString("en-IN")}` };
    }
  }
  if (validUntil) {
    const until = Date.parse(validUntil);
    if (!Number.isNaN(until) && now > until) {
      return { kind: "expired", label: `Expired · ${new Date(until).toLocaleString("en-IN")}` };
    }
  }
  if (validFrom || validUntil) {
    return {
      kind: "active-window",
      label:
        "Window · " +
        [
          validFrom ? `from ${new Date(validFrom).toLocaleDateString("en-IN")}` : null,
          validUntil ? `until ${new Date(validUntil).toLocaleDateString("en-IN")}` : null,
        ]
          .filter(Boolean)
          .join(" "),
    };
  }
  return null;
}

type Props = {
  personId: string;
  detail: DirectoryPersonDetail;
};

export function RolesEditClient({ personId, detail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addingOpen, setAddingOpen] = useState(false);

  // Add-role draft
  const [draft, setDraft] = useState({
    app: "yip",
    role: "",
    yi_year: 2026,
    yi_chapter: "",
    title: "",
    is_primary: false,
    valid_from: "",
    valid_until: "",
  });

  function refresh() {
    router.refresh();
  }

  function submitAdd() {
    if (!draft.role.trim()) {
      toast.error("Role is required");
      return;
    }
    startTransition(async () => {
      const res = await addRoleAssignment(personId, {
        app: draft.app,
        role: draft.role,
        yi_year: draft.yi_year,
        yi_chapter: draft.yi_chapter || null,
        title: draft.title || null,
        is_primary: draft.is_primary,
        valid_from: localToISO(draft.valid_from),
        valid_until: localToISO(draft.valid_until),
      });
      if (res.success) {
        toast.success(res.message ?? "Role added");
        setAddingOpen(false);
        setDraft({
          app: "yip",
          role: "",
          yi_year: 2026,
          yi_chapter: "",
          title: "",
          is_primary: false,
          valid_from: "",
          valid_until: "",
        });
        refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/admin/directory/${personId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to person
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Edit Roles</h1>
          <p className="text-sm text-muted-foreground">
            {detail.person.full_name}
            {detail.person.email ? ` · ${detail.person.email}` : ""}
          </p>
        </div>
        <Button
          onClick={() => setAddingOpen((v) => !v)}
          disabled={pending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          {addingOpen ? "Cancel" : "Add another role"}
        </Button>
      </div>

      {/* Add new role form */}
      {addingOpen && (
        <div className="rounded-lg border bg-emerald-50/50 p-4 space-y-4">
          <h2 className="text-sm font-semibold">New role assignment</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>App</Label>
              <Select
                value={draft.app}
                onValueChange={(v) => setDraft({ ...draft, app: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_APPS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Year</Label>
              <Select
                value={String(draft.yi_year)}
                onValueChange={(v) =>
                  setDraft({ ...draft, yi_year: Number.parseInt(v, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Role *</Label>
              <Input
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                placeholder="e.g. national, rm, chapter_chair"
              />
            </div>

            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. National Chair"
              />
            </div>

            <div className="space-y-1">
              <Label>Chapter</Label>
              <Input
                value={draft.yi_chapter}
                onChange={(e) =>
                  setDraft({ ...draft, yi_chapter: e.target.value })
                }
                placeholder="e.g. Chennai"
              />
            </div>

            <div className="space-y-1">
              <Label>Valid from (optional)</Label>
              <Input
                type="datetime-local"
                value={draft.valid_from}
                onChange={(e) =>
                  setDraft({ ...draft, valid_from: e.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Role auto-activates at this time. Blank = active now.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Valid until (optional)</Label>
              <Input
                type="datetime-local"
                value={draft.valid_until}
                onChange={(e) =>
                  setDraft({ ...draft, valid_until: e.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Role auto-expires after this time. Blank = no expiry.
              </p>
            </div>

            <div className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.is_primary}
                  onChange={(e) =>
                    setDraft({ ...draft, is_primary: e.target.checked })
                  }
                />
                Mark as primary
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submitAdd}
              disabled={pending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" /> Save role
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddingOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active roles */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active roles ({detail.active_roles.length})
        </h2>
        {detail.active_roles.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
            No active roles. Add one above.
          </div>
        ) : (
          <ul className="space-y-2">
            {detail.active_roles.map((r) => (
              <RoleRow
                key={r.id}
                row={r}
                pending={pending}
                onChange={refresh}
                startTransition={startTransition}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Inactive roles */}
      {detail.inactive_roles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Inactive ({detail.inactive_roles.length})
          </h2>
          <ul className="space-y-2">
            {detail.inactive_roles.map((r) => (
              <RoleRow
                key={r.id}
                row={r}
                pending={pending}
                onChange={refresh}
                startTransition={startTransition}
                dim
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RoleRow({
  row,
  pending,
  onChange,
  startTransition,
  dim = false,
}: {
  row: RoleAssignmentRow;
  pending: boolean;
  onChange: () => void;
  startTransition: (fn: () => void) => void;
  dim?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(row.title ?? "");

  function saveTitle() {
    startTransition(async () => {
      const res = await updateRoleAssignment(row.id, {
        title: titleDraft.trim() || null,
      });
      if (res.success) {
        toast.success("Title updated");
        setEditingTitle(false);
        onChange();
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const res = row.is_active
        ? await deactivateRoleAssignment(row.id)
        : await updateRoleAssignment(row.id, { is_active: true });
      if (res.success) {
        toast.success(row.is_active ? "Role deactivated" : "Role reactivated");
        onChange();
      } else {
        toast.error(res.error);
      }
    });
  }

  function togglePrimary() {
    startTransition(async () => {
      const res = await updateRoleAssignment(row.id, {
        is_primary: !row.is_primary,
      });
      if (res.success) {
        toast.success(row.is_primary ? "Removed primary" : "Marked primary");
        onChange();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li
      className={`rounded-lg border p-4 flex flex-wrap items-start justify-between gap-4 ${
        dim ? "opacity-60 bg-muted/30" : "bg-card"
      }`}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="uppercase">
            {row.app}
          </Badge>
          <span className="font-medium">{row.role}</span>
          <span className="text-sm text-muted-foreground">· {row.yi_year}</span>
          {row.is_primary && (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              <Star className="h-3 w-3 mr-1" /> Primary
            </Badge>
          )}
          {!row.is_active && <Badge variant="secondary">Inactive</Badge>}
          {(() => {
            const w = windowStatus(row.valid_from, row.valid_until);
            if (!w) return null;
            const cls =
              w.kind === "expired"
                ? "bg-red-100 text-red-800 hover:bg-red-100"
                : w.kind === "scheduled"
                  ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-100";
            return <Badge className={cls}>{w.label}</Badge>;
          })()}
        </div>

        {row.yi_chapter && (
          <div className="text-xs text-muted-foreground">
            Chapter: {row.yi_chapter}
            {row.yi_zone ? ` · Zone: ${row.yi_zone}` : ""}
          </div>
        )}

        <div className="text-xs">
          {editingTitle ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="Title"
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                onClick={saveTitle}
                disabled={pending}
                className="h-7"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(row.title ?? "");
                }}
                disabled={pending}
                className="h-7"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {row.title ? `Title: ${row.title}` : "Add title"}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={togglePrimary}
          disabled={pending || !row.is_active}
          title={row.is_primary ? "Remove primary" : "Make primary"}
        >
          {row.is_primary ? (
            <StarOff className="h-4 w-4" />
          ) : (
            <Star className="h-4 w-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant={row.is_active ? "outline" : "default"}
          onClick={toggleActive}
          disabled={pending}
          className={
            row.is_active
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }
          title={row.is_active ? "Deactivate" : "Reactivate"}
        >
          {row.is_active ? (
            <>
              <Trash2 className="h-4 w-4 mr-1" /> Deactivate
            </>
          ) : (
            <>
              <Power className="h-4 w-4 mr-1" /> Reactivate
            </>
          )}
        </Button>
      </div>
    </li>
  );
}

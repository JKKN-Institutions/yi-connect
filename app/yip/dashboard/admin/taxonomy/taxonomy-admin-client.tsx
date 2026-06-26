"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  EyeOff,
  Loader2,
  Search,
  ShieldCheck,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";
import type { GovTaxonomyRow } from "@/lib/yip/national/taxonomy";
import type { TaxonomyInput } from "@/lib/yip/national/taxonomy-types";
import {
  createTaxonomyEntry,
  updateTaxonomyEntry,
  deleteTaxonomyEntry,
  setTaxonomyNeedsReview,
  setTaxonomyActive,
} from "@/app/yip/actions/national-taxonomy";

// ═══════════════════════════════════════════════════════════════════════
// GoI TAXONOMY editor (client).
//
// View + edit the curated ministry/scheme vocabulary. A "parent" row is a
// ministry (no scheme); a "child" row is a flagship scheme under a ministry.
// The table groups schemes under their ministry, surfaces needs_review as a
// clearable amber pill (the human-validation gate), and lets a super-admin
// create / edit / soft-delete / hard-delete entries.
//
// All mutations are the gated server actions in
// app/yip/actions/national-taxonomy.ts; this component is pure UI + optimistic
// local state. Inline flash/error banners (no toast dependency) match the
// sibling topics editor.
// ═══════════════════════════════════════════════════════════════════════

type FormState = {
  ministry: string;
  scheme: string;
  official_name: string;
  aliases: string; // one alias per line in the textarea
  category: string;
  notes: string;
  needs_review: boolean;
  sort_order: string;
};

const EMPTY: FormState = {
  ministry: "",
  scheme: "",
  official_name: "",
  aliases: "",
  category: "",
  notes: "",
  needs_review: false,
  sort_order: "",
};

function toInput(form: FormState): TaxonomyInput {
  return {
    ministry: form.ministry.trim(),
    scheme: form.scheme.trim() || null,
    official_name: form.official_name.trim() || null,
    aliases: form.aliases
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    category: form.category.trim() || null,
    notes: form.notes.trim() || null,
    needs_review: form.needs_review,
    sort_order: form.sort_order.trim() ? Number(form.sort_order) : null,
  };
}

// Group rows: ministry-parent first, then its schemes, ordered by sort_order
// then name. A scheme whose ministry has no parent row still appears under a
// synthetic ministry header so nothing is hidden.
type Group = {
  ministry: string;
  parent: GovTaxonomyRow | null;
  schemes: GovTaxonomyRow[];
};

function groupRows(rows: GovTaxonomyRow[]): Group[] {
  const byMinistry = new Map<string, Group>();
  const keyOf = (m: string) => m.trim().toLowerCase();

  for (const r of rows) {
    const k = keyOf(r.ministry);
    let g = byMinistry.get(k);
    if (!g) {
      g = { ministry: r.ministry, parent: null, schemes: [] };
      byMinistry.set(k, g);
    }
    if (r.scheme === null) {
      // Prefer the active parent if there are somehow two.
      if (!g.parent || (r.is_active && !g.parent.is_active)) g.parent = r;
    } else {
      g.schemes.push(r);
    }
  }

  const groups = [...byMinistry.values()];
  for (const g of groups) {
    g.schemes.sort(
      (a, b) =>
        (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
        (a.scheme ?? "").localeCompare(b.scheme ?? "")
    );
  }
  groups.sort((a, b) => {
    const ao = a.parent?.sort_order ?? a.schemes[0]?.sort_order ?? 9999;
    const bo = b.parent?.sort_order ?? b.schemes[0]?.sort_order ?? 9999;
    return ao - bo || a.ministry.localeCompare(b.ministry);
  });
  return groups;
}

function NeedsReviewPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      <AlertTriangle className="size-3" />
      needs review
    </span>
  );
}

export function TaxonomyAdminClient({
  initialRows,
}: {
  initialRows: GovTaxonomyRow[];
}) {
  const [rows, setRows] = useState<GovTaxonomyRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);

  const [editing, setEditing] = useState<GovTaxonomyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // id currently mid-mutation (drives the per-row spinner)
  const [busyId, setBusyId] = useState<string | null>(null);

  const reviewCount = useMemo(
    () => rows.filter((r) => r.needs_review && r.is_active).length,
    [rows]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showInactive && !r.is_active) return false;
      if (onlyReview && !r.needs_review) return false;
      if (q) {
        const hay = [
          r.ministry,
          r.scheme ?? "",
          r.official_name ?? "",
          r.notes ?? "",
          ...r.aliases,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, showInactive, onlyReview]);

  const groups = useMemo(() => groupRows(visibleRows), [visibleRows]);

  // ─── form open/close ──────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  }
  function openEdit(r: GovTaxonomyRow) {
    setForm({
      ministry: r.ministry,
      scheme: r.scheme ?? "",
      official_name: r.official_name ?? "",
      aliases: r.aliases.join("\n"),
      category: r.category ?? "",
      notes: r.notes ?? "",
      needs_review: r.needs_review,
      sort_order: r.sort_order?.toString() ?? "",
    });
    setEditing(r);
    setCreating(false);
    setError(null);
  }
  function closeForm() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  function flashOk(msg: string) {
    setFlash(msg);
    setError(null);
    setTimeout(() => setFlash(null), 3000);
  }

  // ─── upsert ───────────────────────────────────────────────────────────
  function submit() {
    if (form.ministry.trim().length < 3) {
      setError("Ministry name must be at least 3 characters.");
      return;
    }
    const payload = toInput(form);
    startTransition(async () => {
      const res = editing
        ? await updateTaxonomyEntry(editing.id, payload)
        : await createTaxonomyEntry(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows((prev) => {
        const exists = prev.some((r) => r.id === res.data.id);
        return exists
          ? prev.map((r) => (r.id === res.data.id ? res.data : r))
          : [...prev, res.data];
      });
      flashOk(editing ? "Entry updated." : "Entry added.");
      closeForm();
    });
  }

  // ─── per-row mutations ────────────────────────────────────────────────
  function toggleReview(r: GovTaxonomyRow) {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await setTaxonomyNeedsReview(r.id, !r.needs_review);
      setBusyId(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.map((x) => (x.id === r.id ? res.data : x)));
      flashOk(res.data.needs_review ? "Flagged for review." : "Marked validated.");
    });
  }

  function toggleActive(r: GovTaxonomyRow) {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await setTaxonomyActive(r.id, !r.is_active);
      setBusyId(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.map((x) => (x.id === r.id ? res.data : x)));
      flashOk(res.data.is_active ? "Entry restored." : "Entry hidden.");
    });
  }

  function hardDelete(r: GovTaxonomyRow) {
    const label = r.scheme ? `${r.scheme} (${r.ministry})` : r.ministry;
    if (
      !window.confirm(
        `Permanently delete "${label}" from the taxonomy? This cannot be undone.`
      )
    )
      return;
    setBusyId(r.id);
    startTransition(async () => {
      const res = await deleteTaxonomyEntry(r.id);
      setBusyId(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      flashOk("Entry deleted.");
    });
  }

  const formOpen = creating || editing !== null;

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/10">
            <Landmark className="size-6 text-[#FF9933]" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#1a1a3e]">
              GoI Taxonomy
            </h1>
            <p className="text-sm text-[#1a1a3e]/55">
              The Government of India ministry &amp; scheme vocabulary every
              chapter&apos;s deliberation is tagged against.
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FF9933] text-white hover:bg-[#FF9933]/90"
        >
          <Plus className="mr-1.5 size-4" />
          Add entry
        </Button>
      </div>

      {/* Review banner — the human-validation nudge */}
      {reviewCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {reviewCount} {reviewCount === 1 ? "entry needs" : "entries need"}{" "}
            human review — verify the ministry/scheme against the real GoI
            record, then clear the flag.
          </span>
          <button
            type="button"
            onClick={() => setOnlyReview((v) => !v)}
            className="ml-auto shrink-0 rounded-md border border-amber-300 px-2 py-1 text-[12px] font-medium hover:bg-amber-100"
          >
            {onlyReview ? "Show all" : "Review these"}
          </button>
        </div>
      )}

      {/* Flash / error */}
      {flash && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#138808]/20 bg-[#138808]/5 px-3 py-2 text-sm text-[#138808]">
          <Check className="size-4" />
          {flash}
        </div>
      )}
      {error && !formOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      {/* Create / edit form */}
      {formOpen && (
        <Card className="mb-5 border-[#FF9933]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editing ? "Edit entry" : "New taxonomy entry"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                  Ministry <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.ministry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ministry: e.target.value }))
                  }
                  placeholder="Ministry of Education"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                  Scheme{" "}
                  <span className="font-normal text-[#1a1a3e]/40">
                    (blank = ministry-level row)
                  </span>
                </label>
                <Input
                  value={form.scheme}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheme: e.target.value }))
                  }
                  placeholder="NEP 2020"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                  Official name
                </label>
                <Input
                  value={form.official_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, official_name: e.target.value }))
                  }
                  placeholder="National Education Policy 2020"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                    Category
                  </label>
                  <Input
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    placeholder="committee / scheme"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                    Sort order
                  </label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sort_order: e.target.value }))
                    }
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                Aliases{" "}
                <span className="font-normal text-[#1a1a3e]/40">
                  (one per line — alternate names this maps from)
                </span>
              </label>
              <Textarea
                rows={2}
                value={form.aliases}
                onChange={(e) =>
                  setForm((f) => ({ ...f, aliases: e.target.value }))
                }
                placeholder={"MoE\nDept of School Education"}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1a1a3e]/70">
                Notes
              </label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Anything a reviewer should know about this entry."
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#1a1a3e]/70">
              <input
                type="checkbox"
                checked={form.needs_review}
                onChange={(e) =>
                  setForm((f) => ({ ...f, needs_review: e.target.checked }))
                }
                className="size-4 rounded border-[#1a1a3e]/30 accent-[#FF9933]"
              />
              Flag this entry for human review
            </label>

            {error && formOpen && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={submit}
                disabled={pending}
                className="bg-[#FF9933] text-white hover:bg-[#FF9933]/90"
              >
                {pending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-4" />
                )}
                {editing ? "Save changes" : "Add entry"}
              </Button>
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={pending}
              >
                <X className="mr-1.5 size-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#1a1a3e]/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ministry, scheme, alias…"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#1a1a3e]/60">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 rounded border-[#1a1a3e]/30 accent-[#FF9933]"
          />
          Show hidden
        </label>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1a1a3e]/15 px-4 py-14 text-center">
          <Landmark className="size-7 text-[#1a1a3e]/25" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            {query || onlyReview
              ? "No entries match your filter"
              : "The taxonomy is empty"}
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-[#1a1a3e]/45">
            {query || onlyReview
              ? "Clear the search or review filter to see all entries."
              : "Run the seed migration, or add the first ministry above."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/8 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1a1a3e]/[0.02]">
                <TableHead className="w-[34%]">Ministry / Scheme</TableHead>
                <TableHead>Official name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const headerRow = g.parent;
                return (
                  <RowGroup
                    key={g.ministry.toLowerCase()}
                    group={g}
                    headerRow={headerRow}
                    busyId={busyId}
                    onEdit={openEdit}
                    onToggleReview={toggleReview}
                    onToggleActive={toggleActive}
                    onDelete={hardDelete}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-[#1a1a3e]/40">
        {visibleRows.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} entries shown · ministry-level rows
        anchor the vocabulary; schemes sit beneath their ministry.
      </p>
    </div>
  );
}

// ─── One ministry group (parent header + its scheme rows) ──────────────────

function RowActions({
  row,
  busyId,
  onEdit,
  onToggleReview,
  onToggleActive,
  onDelete,
}: {
  row: GovTaxonomyRow;
  busyId: string | null;
  onEdit: (r: GovTaxonomyRow) => void;
  onToggleReview: (r: GovTaxonomyRow) => void;
  onToggleActive: (r: GovTaxonomyRow) => void;
  onDelete: (r: GovTaxonomyRow) => void;
}) {
  const busy = busyId === row.id;
  return (
    <div className="flex items-center justify-end gap-1">
      {busy && <Loader2 className="size-4 animate-spin text-[#1a1a3e]/40" />}
      <button
        type="button"
        title={row.needs_review ? "Mark validated" : "Flag for review"}
        onClick={() => onToggleReview(row)}
        disabled={busy}
        className="rounded-md p-1.5 text-[#1a1a3e]/50 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
      >
        {row.needs_review ? (
          <ShieldCheck className="size-4" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
      </button>
      <button
        type="button"
        title="Edit"
        onClick={() => onEdit(row)}
        disabled={busy}
        className="rounded-md p-1.5 text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e] disabled:opacity-40"
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        title={row.is_active ? "Hide (soft delete)" : "Restore"}
        onClick={() => onToggleActive(row)}
        disabled={busy}
        className="rounded-md p-1.5 text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e] disabled:opacity-40"
      >
        {row.is_active ? (
          <EyeOff className="size-4" />
        ) : (
          <RotateCcw className="size-4" />
        )}
      </button>
      <button
        type="button"
        title="Delete permanently"
        onClick={() => onDelete(row)}
        disabled={busy}
        className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function StatusCell({ row }: { row: GovTaxonomyRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {!row.is_active && (
        <Badge className="border-[#1a1a3e]/15 bg-[#1a1a3e]/5 text-[10px] text-[#1a1a3e]/50">
          hidden
        </Badge>
      )}
      {row.needs_review && <NeedsReviewPill />}
      {row.is_active && !row.needs_review && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#138808]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#138808]">
          <Check className="size-3" />
          validated
        </span>
      )}
    </div>
  );
}

function RowGroup({
  group,
  headerRow,
  busyId,
  onEdit,
  onToggleReview,
  onToggleActive,
  onDelete,
}: {
  group: Group;
  headerRow: GovTaxonomyRow | null;
  busyId: string | null;
  onEdit: (r: GovTaxonomyRow) => void;
  onToggleReview: (r: GovTaxonomyRow) => void;
  onToggleActive: (r: GovTaxonomyRow) => void;
  onDelete: (r: GovTaxonomyRow) => void;
}) {
  return (
    <>
      {/* Ministry header row */}
      <TableRow className="border-b border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.015]">
        <TableCell className="py-2.5">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 shrink-0 text-[#FF9933]" />
            <span className="font-semibold text-[#1a1a3e]">
              {group.ministry}
            </span>
            {!headerRow && (
              <span
                title="No ministry-level row — only schemes exist here. Add a parent entry to anchor it."
                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
              >
                no parent row
              </span>
            )}
          </div>
          {headerRow && headerRow.aliases.length > 0 && (
            <div className="mt-0.5 pl-6 text-[11px] text-[#1a1a3e]/45">
              {headerRow.aliases.join(" · ")}
            </div>
          )}
        </TableCell>
        <TableCell className="text-[13px] text-[#1a1a3e]/60">
          {headerRow?.official_name ?? "—"}
        </TableCell>
        <TableCell>
          {headerRow ? <StatusCell row={headerRow} /> : <span className="text-[11px] text-[#1a1a3e]/35">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {headerRow ? (
            <RowActions
              row={headerRow}
              busyId={busyId}
              onEdit={onEdit}
              onToggleReview={onToggleReview}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ) : null}
        </TableCell>
      </TableRow>

      {/* Scheme child rows */}
      {group.schemes.map((s) => (
        <TableRow key={s.id} className="border-b border-[#1a1a3e]/5 last:border-0">
          <TableCell className="py-2.5">
            <div className="flex items-center gap-2 pl-6">
              <span className="text-[#1a1a3e]/30">↳</span>
              <span className="font-medium text-[#1a1a3e]/85">{s.scheme}</span>
            </div>
            {s.aliases.length > 0 && (
              <div className="mt-0.5 pl-12 text-[11px] text-[#1a1a3e]/45">
                {s.aliases.join(" · ")}
              </div>
            )}
          </TableCell>
          <TableCell className="text-[13px] text-[#1a1a3e]/60">
            {s.official_name ?? "—"}
          </TableCell>
          <TableCell>
            <StatusCell row={s} />
          </TableCell>
          <TableCell className="text-right">
            <RowActions
              row={s}
              busyId={busyId}
              onEdit={onEdit}
              onToggleReview={onToggleReview}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

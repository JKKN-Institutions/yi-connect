"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  adminCreateChecklistItem,
  adminUpdateChecklistItem,
  adminDeactivateChecklistItem,
  adminReactivateChecklistItem,
  adminReseedFromHandbook,
  type AdminChecklistItem,
} from "@/app/actions/admin-checklist";

const CATEGORY_ORDER = [
  "Pre-Session Preparation",
  "Venue & Infrastructure",
  "On-Ground Execution",
  "Logistics & Hospitality",
  "Communication & Protocol",
  "Post-Session",
];

const ACCENT: Record<string, string> = {
  "Pre-Session Preparation": "bg-amber-500",
  "Venue & Infrastructure": "bg-blue-500",
  "On-Ground Execution": "bg-[#138808]",
  "Logistics & Hospitality": "bg-violet-500",
  "Communication & Protocol": "bg-cyan-500",
  "Post-Session": "bg-rose-500",
};

type FormState = {
  category: string;
  title: string;
  description: string;
  handbook_page: string;
};

const EMPTY: FormState = {
  category: "Pre-Session Preparation",
  title: "",
  description: "",
  handbook_page: "",
};

export function ChecklistTemplateClient({
  initialItems,
}: {
  initialItems: AdminChecklistItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<AdminChecklistItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const knownCategories = Array.from(
    new Set([...CATEGORY_ORDER, ...items.map((i) => i.category)])
  );

  function openCreate(category?: string) {
    setForm({ ...EMPTY, category: category ?? "Pre-Session Preparation" });
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function openEdit(it: AdminChecklistItem) {
    setForm({
      category: it.category,
      title: it.title,
      description: it.description ?? "",
      handbook_page: it.handbook_page?.toString() ?? "",
    });
    setEditing(it);
    setCreating(false);
    setError(null);
  }

  function submit() {
    if (form.title.trim().length < 3) {
      setError("Title min 3 chars");
      return;
    }
    const payload = {
      category: form.category.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      handbook_page: form.handbook_page ? parseInt(form.handbook_page) : null,
    };
    startTransition(async () => {
      if (editing) {
        const res = await adminUpdateChecklistItem(editing.id, payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        // Update locally with the form values (action returns null data).
        setItems(
          items.map((x) =>
            x.id === editing.id
              ? {
                  ...x,
                  category: payload.category,
                  title: payload.title,
                  description: payload.description,
                  handbook_page: payload.handbook_page,
                }
              : x
          )
        );
      } else {
        const res = await adminCreateChecklistItem(payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setItems([...items, res.data]);
      }
      setCreating(false);
      setEditing(null);
      setFlash("Saved");
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function toggle(it: AdminChecklistItem) {
    startTransition(async () => {
      const res = it.is_active
        ? await adminDeactivateChecklistItem(it.id)
        : await adminReactivateChecklistItem(it.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setItems(
        items.map((x) =>
          x.id === it.id ? { ...x, is_active: !x.is_active } : x
        )
      );
    });
  }

  function reseed() {
    if (!confirm("Reseed missing canonical items from handbook? Existing items won't be touched.")) return;
    startTransition(async () => {
      const res = await adminReseedFromHandbook();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(`Reseed: +${res.data.inserted} inserted, ${res.data.skipped} already present`);
      setTimeout(() => setFlash(null), 4000);
      window.location.reload();
    });
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <ListChecks className="size-7 text-[#FF9933]" /> Checklist Template
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Handbook p.45–46 · Applied to NEW events only. Existing events keep their seeded copy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reseed} disabled={pending}>
            <RefreshCw className="size-4 mr-2" />
            Reseed
          </Button>
          <Button
            onClick={() => openCreate()}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            <Plus className="size-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && !creating && !editing && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[#1a1a3e]/70">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="size-4"
        />
        Show inactive items
      </label>

      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edit Item" : "New Item"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Category
                </label>
                <Input
                  list="cat-list"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
                <datalist id="cat-list">
                  {knownCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Handbook page
                </label>
                <Input
                  type="number"
                  value={form.handbook_page}
                  onChange={(e) =>
                    setForm({ ...form, handbook_page: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                Description / context
              </label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {knownCategories.map((cat) => {
        const catItems = items.filter(
          (i) =>
            i.category === cat && (showInactive ? true : i.is_active)
        );
        if (catItems.length === 0) return null;
        return (
          <Card key={cat} className="overflow-hidden">
            <div className={`h-1 ${ACCENT[cat] ?? "bg-gray-400"}`} />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{cat}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    {catItems.filter((i) => i.is_active).length}/{catItems.length}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openCreate(cat)}
                  >
                    <Plus className="size-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {catItems.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded hover:bg-[#1a1a3e]/[0.02] ${
                    it.is_active ? "" : "opacity-60"
                  }`}
                >
                  <span className="text-xs font-mono text-[#1a1a3e]/40 mt-0.5 shrink-0">
                    {it.sequence_order}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        it.is_active ? "text-[#1a1a3e]" : "text-[#1a1a3e]/50 line-through"
                      }`}
                    >
                      {it.title}
                    </p>
                    {it.description && (
                      <p className="text-xs text-[#1a1a3e]/60 mt-0.5">
                        {it.description}
                      </p>
                    )}
                  </div>
                  {it.handbook_page && (
                    <span className="text-[10px] text-[#1a1a3e]/40 font-mono mt-1 shrink-0">
                      p.{it.handbook_page}
                    </span>
                  )}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(it)}
                      disabled={pending}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggle(it)}
                      disabled={pending}
                      className={it.is_active ? "text-red-600" : "text-[#138808]"}
                    >
                      {it.is_active ? (
                        <Trash2 className="size-4" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

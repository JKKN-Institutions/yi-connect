"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
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
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Loader2,
  Search,
} from "lucide-react";
import { YI_ZONES, type YiZone } from "@/lib/yip/hierarchy";
import {
  adminCreateTopic,
  adminUpdateTopic,
  adminDeactivateTopic,
  adminReactivateTopic,
  type AdminTopic,
  type TopicCategory,
} from "@/app/yip/actions/admin-topics";
import { PushCentralTopicsButton } from "@/components/yip/push-central-topics-button";

type FormState = {
  category: TopicCategory;
  zone: YiZone | "";
  title: string;
  description: string;
  sub_points: string;
  handbook_page: string;
  linked_scheme: string;
};

const EMPTY: FormState = {
  category: "central",
  zone: "",
  title: "",
  description: "",
  sub_points: "",
  handbook_page: "",
  linked_scheme: "",
};

export function TopicsAdminClient({
  initialTopics,
}: {
  initialTopics: AdminTopic[];
}) {
  const [topics, setTopics] = useState(initialTopics);
  const [filter, setFilter] = useState<
    "all" | "central" | "committee" | YiZone
  >("all");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<AdminTopic | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const visible = topics.filter((t) => {
    if (!showInactive && !t.is_active) return false;
    if (filter === "central" && t.category !== "central") return false;
    if (filter === "committee" && t.category !== "committee") return false;
    if (
      filter !== "all" &&
      filter !== "central" &&
      filter !== "committee" &&
      t.zone !== filter
    )
      return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.sub_points.some((s) => s.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  }
  function openEdit(t: AdminTopic) {
    setForm({
      category: t.category,
      zone: (t.zone as YiZone) ?? "",
      title: t.title,
      description: t.description ?? "",
      sub_points: t.sub_points.join("\n"),
      handbook_page: t.handbook_page?.toString() ?? "",
      linked_scheme: t.linked_scheme ?? "",
    });
    setEditing(t);
    setCreating(false);
    setError(null);
  }
  function closeForm() {
    setEditing(null);
    setCreating(false);
  }

  function submit() {
    if (form.title.trim().length < 3) {
      setError("Title min 3 chars");
      return;
    }
    const sub_points = form.sub_points
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      category: form.category,
      zone:
        form.category === "regional"
          ? ((form.zone || null) as YiZone | null)
          : null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      sub_points,
      handbook_page: form.handbook_page
        ? parseInt(form.handbook_page)
        : null,
      linked_scheme: form.linked_scheme.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await adminUpdateTopic(editing.id, payload)
        : await adminCreateTopic(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (editing) {
        setTopics(topics.map((x) => (x.id === editing.id ? res.data : x)));
      } else {
        setTopics([res.data, ...topics]);
      }
      setFlash(editing ? "Saved" : "Created");
      closeForm();
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function toggleActive(t: AdminTopic) {
    startTransition(async () => {
      const res = t.is_active
        ? await adminDeactivateTopic(t.id)
        : await adminReactivateTopic(t.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setTopics(
        topics.map((x) =>
          x.id === t.id ? { ...x, is_active: !x.is_active } : x
        )
      );
    });
  }

  const counts = {
    total: topics.length,
    active: topics.filter((t) => t.is_active).length,
    central: topics.filter((t) => t.category === "central").length,
    committee: topics.filter((t) => t.category === "committee").length,
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <BookOpen className="size-7 text-[#FF9933]" /> Topics Library — Admin
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Handbook p.25–38 · {counts.total} total · {counts.active} active ·{" "}
            {counts.committee} committee · {counts.central} central
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PushCentralTopicsButton
            centralTopicIds={topics
              .filter((t) => t.category === "central" && t.is_active)
              .map((t) => t.id)}
            centralCount={
              topics.filter((t) => t.category === "central" && t.is_active)
                .length
            }
          />
          <Button
            onClick={openCreate}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            <Plus className="size-4 mr-2" /> New Topic
          </Button>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <FilterChip
          active={filter === "committee"}
          onClick={() => setFilter("committee")}
        >
          Committee ({counts.committee})
        </FilterChip>
        <FilterChip
          active={filter === "central"}
          onClick={() => setFilter("central")}
        >
          Central ({counts.central})
        </FilterChip>
        {YI_ZONES.map((z) => {
          const n = topics.filter((t) => t.zone === z.code).length;
          return (
            <FilterChip
              key={z.code}
              active={filter === z.code}
              onClick={() => setFilter(z.code)}
            >
              {z.label} ({n})
            </FilterChip>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-[#1a1a3e]/70">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4"
          />
          Show inactive
        </label>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
        <Input
          placeholder="Search title or sub-points…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edit Topic" : "New Topic"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as TopicCategory,
                      zone: e.target.value === "regional" ? form.zone : "",
                    })
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="committee">Committee (official 15)</option>
                  <option value="central">Central</option>
                  <option value="regional">Regional</option>
                </select>
              </div>
              {form.category === "regional" && (
                <div>
                  <label className="text-xs font-medium text-[#1a1a3e]/70">
                    Zone *
                  </label>
                  <select
                    value={form.zone}
                    onChange={(e) =>
                      setForm({ ...form, zone: e.target.value as YiZone })
                    }
                    className="w-full border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    {YI_ZONES.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                {form.category === "committee"
                  ? "Committee / Ministry name *"
                  : "Title *"}
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {form.category === "committee" && (
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Linked scheme / policy / act
                </label>
                <Input
                  value={form.linked_scheme}
                  placeholder="e.g. NEP 2020, PM eVidya"
                  onChange={(e) =>
                    setForm({ ...form, linked_scheme: e.target.value })
                  }
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                {form.category === "committee"
                  ? "Debate / bill topic"
                  : "Description"}
              </label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                Sub-points (one per line)
              </label>
              <Textarea
                value={form.sub_points}
                onChange={(e) =>
                  setForm({ ...form, sub_points: e.target.value })
                }
                rows={5}
                placeholder="One bullet per line"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm} disabled={pending}>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Sub-points</TableHead>
                <TableHead>p.</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-sm text-[#1a1a3e]/50">
                    No topics match your filters.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((t) => (
                <TableRow key={t.id} className={t.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs">
                    {t.topic_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-[#1a1a3e]">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-[#1a1a3e]/60 line-clamp-1">
                        {t.description}
                      </div>
                    )}
                    {t.linked_scheme && (
                      <div className="text-[10px] text-[#1a1a3e]/40">
                        Linked: {t.linked_scheme}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.category === "committee" ? (
                      <Badge className="bg-[#1a1a3e]/10 text-[#1a1a3e] border-[#1a1a3e]/20 text-[10px]">
                        Committee
                      </Badge>
                    ) : t.category === "central" ? (
                      <Badge className="bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20 text-[10px]">
                        Central
                      </Badge>
                    ) : (
                      <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[10px]">
                        {t.zone}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[#1a1a3e]/70">
                    {t.sub_points.length}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-[#1a1a3e]/50">
                    {t.handbook_page ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(t)}
                        disabled={pending}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleActive(t)}
                        disabled={pending}
                        className={t.is_active ? "text-red-600" : "text-[#138808]"}
                      >
                        {t.is_active ? (
                          <Trash2 className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
          : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
      }`}
    >
      {children}
    </button>
  );
}

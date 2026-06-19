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
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Send,
} from "lucide-react";
import {
  adminUpsertAgendaItem,
  adminDeleteAgendaItem,
  pushAgendaToAllChapterEvents,
  type AgendaTemplateItem,
} from "@/app/yip/actions/admin-agenda";
import { PushToSelectedEvents } from "../_components/push-to-selected-events";

type AgendaMode = "party" | "committee" | "mixed";

type FormState = {
  day: string;
  sequence_order: string;
  title: string;
  description: string;
  agenda_type: string;
  duration_minutes: string;
  mode: AgendaMode;
  is_scoreable: boolean;
  session_key: string;
};

const EMPTY: FormState = {
  day: "1",
  sequence_order: "",
  title: "",
  description: "",
  agenda_type: "",
  duration_minutes: "",
  mode: "party",
  is_scoreable: false,
  session_key: "",
};

const MODE_BADGE: Record<AgendaMode, string> = {
  party: "bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20",
  committee: "bg-[#138808]/10 text-[#138808] border-[#138808]/20",
  mixed: "bg-[#1a1a3e]/10 text-[#1a1a3e] border-[#1a1a3e]/20",
};

export function AgendaTemplateClient({
  initialItems,
}: {
  initialItems: AgendaTemplateItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<AgendaTemplateItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const day1 = items
    .filter((i) => i.day === 1)
    .sort((a, b) => a.sequence_order - b.sequence_order);
  const day2 = items
    .filter((i) => i.day === 2)
    .sort((a, b) => a.sequence_order - b.sequence_order);

  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  }
  function openEdit(item: AgendaTemplateItem) {
    setForm({
      day: item.day.toString(),
      sequence_order: item.sequence_order.toString(),
      title: item.title,
      description: item.description ?? "",
      agenda_type: item.agenda_type ?? "",
      duration_minutes: item.duration_minutes?.toString() ?? "",
      mode: item.mode,
      is_scoreable: item.is_scoreable,
      session_key: item.session_key ?? "",
    });
    setEditing(item);
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
    const payload = {
      day: parseInt(form.day),
      sequence_order: form.sequence_order
        ? parseInt(form.sequence_order)
        : null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      agenda_type: form.agenda_type.trim() || null,
      duration_minutes: form.duration_minutes
        ? parseInt(form.duration_minutes)
        : null,
      mode: form.mode,
      is_scoreable: form.is_scoreable,
      session_key: form.session_key.trim() || null,
    };
    startTransition(async () => {
      const res = await adminUpsertAgendaItem(payload, editing?.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (editing) {
        setItems(items.map((x) => (x.id === editing.id ? res.data : x)));
      } else {
        setItems([...items, res.data]);
      }
      setFlash(editing ? "Saved" : "Created");
      closeForm();
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function remove(item: AgendaTemplateItem) {
    if (
      !window.confirm(
        `Delete "${item.title}" from the central agenda template? This does not affect events that were already created.`
      )
    )
      return;
    startTransition(async () => {
      const res = await adminDeleteAgendaItem(item.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setItems(items.filter((x) => x.id !== item.id));
      setFlash("Deleted");
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function pushToAll() {
    if (
      !window.confirm(
        "Replace the agenda on all NOT-YET-STARTED chapter events with this template? Events that have already started (with scores/votes) are skipped automatically to protect their data. This cannot be undone for the events it updates. Continue?"
      )
    )
      return;
    startTransition(async () => {
      const res = await pushAgendaToAllChapterEvents();
      if (!res.success) {
        setError(res.error);
        return;
      }
      const skipNote =
        res.data.events_skipped > 0
          ? ` ${res.data.events_skipped} started event(s) skipped: ${res.data.skipped_names.join(", ")}.`
          : "";
      setFlash(
        `Pushed ${res.data.items_each} agenda items to ${res.data.events_updated} chapter events.${skipNote}`
      );
      setTimeout(() => setFlash(null), 8000);
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <CalendarRange className="size-7 text-[#FF9933]" /> Agenda Template —
            Admin
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            The central 2-day agenda every new chapter event inherits.{" "}
            {day1.length} Day-1 · {day2.length} Day-2 items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={pushToAll} disabled={pending}>
            <Send className="size-4 mr-2" /> Push agenda to all chapter events
          </Button>
          <PushToSelectedEvents
            label="Push to selected…"
            dialogTitle="Push agenda to selected events"
            dialogDescription="Replaces each chosen event's agenda with the canonical template. Draft events are overwritten; on started events, agenda items tied to live scores/votes are protected and skipped."
            action={pushAgendaToAllChapterEvents}
            formatSuccess={(d) =>
              `Pushed ${d.items_each} agenda items to ${d.events_updated} event${
                d.events_updated === 1 ? "" : "s"
              }${d.events_skipped ? ` (${d.events_skipped} skipped)` : ""}.`
            }
          />
          <Button
            onClick={openCreate}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            <Plus className="size-4 mr-2" /> New Agenda Item
          </Button>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edit Agenda Item" : "New Agenda Item"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Day *
                </label>
                <select
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="1">Day 1</option>
                  <option value="2">Day 2</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Sequence (optional)
                </label>
                <Input
                  type="number"
                  value={form.sequence_order}
                  placeholder="auto"
                  onChange={(e) =>
                    setForm({ ...form, sequence_order: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Duration (min)
                </label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Mode *
                </label>
                <select
                  value={form.mode}
                  onChange={(e) =>
                    setForm({ ...form, mode: e.target.value as AgendaMode })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="party">Party</option>
                  <option value="committee">Committee</option>
                  <option value="mixed">Mixed</option>
                </select>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Agenda type
                </label>
                <Input
                  value={form.agenda_type}
                  placeholder="e.g. inaugural, debate, break"
                  onChange={(e) =>
                    setForm({ ...form, agenda_type: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Session key
                </label>
                <Input
                  value={form.session_key}
                  placeholder="e.g. session_1 (links to scoring)"
                  onChange={(e) =>
                    setForm({ ...form, session_key: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#1a1a3e]/80">
              <input
                type="checkbox"
                checked={form.is_scoreable}
                onChange={(e) =>
                  setForm({ ...form, is_scoreable: e.target.checked })
                }
                className="size-4"
              />
              Scoreable (jury scores this session)
            </label>
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

      <DayTable
        day={1}
        items={day1}
        onEdit={openEdit}
        onDelete={remove}
        pending={pending}
      />
      <DayTable
        day={2}
        items={day2}
        onEdit={openEdit}
        onDelete={remove}
        pending={pending}
      />
    </div>
  );
}

function DayTable({
  day,
  items,
  onEdit,
  onDelete,
  pending,
}: {
  day: number;
  items: AgendaTemplateItem[];
  onEdit: (item: AgendaTemplateItem) => void;
  onDelete: (item: AgendaTemplateItem) => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-[#1a1a3e]">
          Day {day}{" "}
          <span className="text-sm font-normal text-[#1a1a3e]/50">
            ({items.length} items)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="w-20">Mins</TableHead>
              <TableHead className="w-28">Mode</TableHead>
              <TableHead className="w-24">Scoreable</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-sm text-[#1a1a3e]/50"
                >
                  No agenda items for Day {day}.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">
                  {item.sequence_order}
                </TableCell>
                <TableCell className="max-w-xl">
                  <div className="text-sm font-semibold text-[#1a1a3e]">
                    {item.title}
                  </div>
                  {item.description && (
                    <div className="text-xs text-[#1a1a3e]/60 mt-0.5">
                      {item.description}
                    </div>
                  )}
                  {item.session_key && (
                    <div className="text-[11px] text-[#1a1a3e]/45 mt-0.5 font-mono">
                      {item.session_key}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#1a1a3e]/70">
                  {item.agenda_type ?? "—"}
                </TableCell>
                <TableCell className="text-xs font-mono text-[#1a1a3e]/60">
                  {item.duration_minutes ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge className={`${MODE_BADGE[item.mode]} text-[10px]`}>
                    {item.mode}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {item.is_scoreable ? (
                    <span className="text-[#138808] font-medium">Yes</span>
                  ) : (
                    <span className="text-[#1a1a3e]/40">No</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      disabled={pending}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      disabled={pending}
                      className="text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

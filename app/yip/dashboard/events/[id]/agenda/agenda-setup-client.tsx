"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  setAgendaItemInRun,
  reorderAgenda,
  updateAgendaItem,
  addAgendaItem,
  moveAgendaItemToDay,
  deleteAgendaItem,
} from "@/app/yip/actions/agenda";
import type { Tables } from "@/types/yip/database";
import {
  CalendarClock,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  Star,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";

// scheduled_date post-dates the generated types; extend the row type locally.
type AgendaItem = Tables<{ schema: "yip" }, "agenda"> & {
  scheduled_date: string | null;
};

// Phase 0 = Pre-event (dated prep milestones), 1/2 = the two event days.
const PHASES = [
  { day: 0 as const, label: "Pre-event" },
  { day: 1 as const, label: "Day 1" },
  { day: 2 as const, label: "Day 2" },
];
function phaseLabel(day: number): string {
  return day === 0 ? "Pre-event" : `Day ${day}`;
}

// Small, safe set of types for custom items so `mode` resolves correctly on the
// server (modeForAgendaType): general→party, break/inaugural→mixed.
const ADD_TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "break", label: "Break" },
  { value: "inaugural", label: "Ceremony" },
] as const;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
/** Format an ISO date (YYYY-MM-DD) as "20 Dec 2026" without timezone drift. */
function formatDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

function prettyType(t: string | null): string {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AgendaSetupClient({
  eventId,
  items,
  canDelete,
  isLive,
}: {
  eventId: string;
  items: AgendaItem[];
  canDelete: boolean;
  isLive: boolean;
}) {
  const router = useRouter();
  const [activeDay, setActiveDay] = useState<0 | 1 | 2>(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDate, setEditDate] = useState("");

  // Delete confirm + add form
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDuration, setAddDuration] = useState("15");
  const [addType, setAddType] = useState<string>("general");
  const [addDate, setAddDate] = useState("");
  const [adding, setAdding] = useState(false);

  const isPreEvent = activeDay === 0;

  const dayItems = items
    .filter((i) => i.day === activeDay)
    .sort((a, b) => a.sequence_order - b.sequence_order);
  const runLiveCount = dayItems.filter((i) => i.status !== "skipped").length;
  const scoredCount = dayItems.filter((i) => i.is_scoreable).length;

  async function toggleRunLive(item: AgendaItem) {
    setError(null);
    setBusyId(item.id);
    const res = await setAgendaItemInRun(
      eventId,
      item.id,
      item.status === "skipped" // currently excluded → include it
    );
    setBusyId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function move(index: number, dir: "up" | "down") {
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= dayItems.length) return;
    setError(null);
    setReordering(true);
    const ids = dayItems.map((i) => i.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const res = await reorderAgenda(eventId, activeDay, ids);
    setReordering(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleMove(item: AgendaItem, targetDay: number) {
    setError(null);
    setBusyId(item.id);
    const res = await moveAgendaItemToDay(eventId, item.id, targetDay);
    setBusyId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  function startEdit(item: AgendaItem) {
    setError(null);
    setEditId(item.id);
    setEditTitle(item.title);
    setEditDuration(String(item.duration_minutes ?? ""));
    setEditDate(item.scheduled_date ?? "");
  }

  async function saveEdit(item: AgendaItem) {
    setError(null);
    setBusyId(item.id);
    const res = await updateAgendaItem(eventId, item.id, {
      title: editTitle,
      duration_minutes: editDuration === "" ? undefined : Number(editDuration),
      // Only pre-event items carry a date; leave it untouched for event days.
      scheduled_date: isPreEvent ? editDate || null : undefined,
    });
    setBusyId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setEditId(null);
    router.refresh();
  }

  async function doDelete(item: AgendaItem) {
    setError(null);
    setBusyId(item.id);
    const res = await deleteAgendaItem(eventId, item.id);
    setBusyId(null);
    if (!res.success) {
      setConfirmDeleteId(null);
      setError(res.error);
      return;
    }
    setConfirmDeleteId(null);
    router.refresh();
  }

  async function doAdd() {
    setError(null);
    setAdding(true);
    const res = await addAgendaItem(eventId, {
      day: activeDay,
      title: addTitle,
      duration_minutes: addDuration === "" ? undefined : Number(addDuration),
      agenda_type: addType,
      scheduled_date: isPreEvent ? addDate || null : undefined,
    });
    setAdding(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setShowAdd(false);
    setAddTitle("");
    setAddDuration("15");
    setAddType("general");
    setAddDate("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock className="size-5 text-[#FF9933]" />
        <h1 className="text-lg font-bold text-gray-900">Agenda setup</h1>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Plan everything in one place: <strong>Pre-event</strong> prep with dates
        (so nothing is missed before the day), then the run-of-show for{" "}
        <strong>Day 1</strong> and <strong>Day 2</strong>. Switch an item off if
        your chapter does it before the event or skips it, reorder with the
        arrows, or use <em>Move…</em> to shift an item between Pre-event and the
        event days.
      </p>

      {/* Phase tabs: Pre-event · Day 1 · Day 2 */}
      <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5">
        {PHASES.map((p) => (
          <button
            key={p.day}
            type="button"
            onClick={() => {
              setActiveDay(p.day);
              setEditId(null);
              setConfirmDeleteId(null);
              setShowAdd(false);
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeDay === p.day
                ? p.day === 0
                  ? "bg-[#FF9933] text-white"
                  : "bg-[#138808] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isPreEvent ? (
        <p className="mb-3 text-sm font-medium text-gray-700">
          {dayItems.length} pre-event item{dayItems.length !== 1 ? "s" : ""} —
          give each a date so you know what must be done, and by when.
        </p>
      ) : (
        <p className="mb-3 text-sm font-medium text-gray-700">
          {runLiveCount} of {dayItems.length} items will run live on{" "}
          {phaseLabel(activeDay)}
          {scoredCount > 0 && (
            <>
              {" · "}
              <span className="text-emerald-700">{scoredCount} scored</span>
            </>
          )}
          .
        </p>
      )}

      {isLive && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            This event is live. Use the Control panel&apos;s Skip / Jump for
            on-the-day changes — reordering here is limited while live.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {dayItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No agenda items for {phaseLabel(activeDay)} yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {dayItems.map((item, index) => {
            const excluded = item.status === "skipped";
            const isInProgress = item.status === "in_progress";
            const isCompleted = item.status === "completed";
            const lockedToggle = isInProgress || isCompleted;
            const busy = busyId === item.id;
            const editing = editId === item.id;
            const confirming = confirmDeleteId === item.id;

            return (
              <li key={item.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0 || reordering}
                      onClick={() => move(index, "up")}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === dayItems.length - 1 || reordering}
                      onClick={() => move(index, "down")}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>

                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
                    {index + 1}
                  </span>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Title"
                        />
                        {isPreEvent && (
                          <input
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            type="date"
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                            aria-label="Date"
                          />
                        )}
                        <input
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value)}
                          type="number"
                          min={0}
                          max={600}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="min"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveEdit(item)}
                          className="rounded-md bg-[#138808] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0f6e06] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <p
                          className={`truncate text-sm font-medium ${
                            excluded
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          {isPreEvent &&
                            (item.scheduled_date ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FF9933]/10 px-1.5 py-0.5 font-semibold text-[#b35e00]">
                                <CalendarDays className="size-3" />
                                {formatDate(item.scheduled_date)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-amber-700">
                                <CalendarDays className="size-3" />
                                Set a date
                              </span>
                            ))}
                          {item.is_scoreable && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                              <Star className="size-3 fill-emerald-600 text-emerald-600" />
                              Scored
                            </span>
                          )}
                          {item.agenda_type && (
                            <span>{prettyType(item.agenda_type)}</span>
                          )}
                          {!isPreEvent && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="size-3" />
                              {item.duration_minutes ?? 0} min
                            </span>
                          )}
                          {isInProgress && (
                            <span className="font-semibold text-[#138808]">
                              Live now
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-gray-400">Done</span>
                          )}
                          {excluded && !isPreEvent && (
                            <span className="text-amber-700">
                              Won&apos;t run live
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {!editing && !confirming && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {/* Move between phases */}
                      <select
                        value=""
                        disabled={busy || reordering}
                        onChange={(e) => {
                          const t = Number(e.target.value);
                          if (!Number.isNaN(t)) handleMove(item, t);
                        }}
                        title="Move to another phase"
                        aria-label={`Move "${item.title}" to another phase`}
                        className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <option value="">Move…</option>
                        {PHASES.filter((p) => p.day !== activeDay).map((p) => (
                          <option key={p.day} value={p.day}>
                            → {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => startEdit(item)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                      {/* Run-live toggle — only meaningful for the event days */}
                      {!isPreEvent &&
                        (lockedToggle ? (
                          <span className="ml-1 w-11 text-center text-[10px] font-medium uppercase text-gray-300">
                            {isInProgress ? "live" : "done"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!excluded}
                            aria-label={`Run "${item.title}" live`}
                            disabled={busy}
                            onClick={() => toggleRunLive(item)}
                            className={`relative ml-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                              !excluded ? "bg-[#138808]" : "bg-gray-300"
                            }`}
                          >
                            {busy ? (
                              <Loader2 className="absolute left-1/2 size-3.5 -translate-x-1/2 animate-spin text-white" />
                            ) : (
                              <span
                                className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
                                  !excluded ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            )}
                          </button>
                        ))}
                    </div>
                  )}

                  {confirming && (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-red-700">Delete this?</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => doDelete(item)}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Delete"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add item */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        {showAdd ? (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder={`New item title for ${phaseLabel(activeDay)}`}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              {isPreEvent ? (
                <input
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  type="date"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  aria-label="Date"
                />
              ) : (
                <>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {ADD_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={addDuration}
                    onChange={(e) => setAddDuration(e.target.value)}
                    type="number"
                    min={0}
                    max={600}
                    className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="min"
                  />
                  <span className="text-xs text-gray-500">minutes</span>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={adding || !addTitle.trim()}
                  onClick={doAdd}
                  className="inline-flex items-center gap-1 rounded-md bg-[#138808] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f6e06] disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Add to {phaseLabel(activeDay)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Added to the end of {phaseLabel(activeDay)} — use the arrows to move
              it into place, or <em>Move…</em> to shift it to another phase.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-[#138808] hover:text-[#138808]"
          >
            <Plus className="size-4" />
            Add a {isPreEvent ? "pre-event item" : "custom item"}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Tip: whether a session is <span className="font-medium">scored</span>{" "}
        (★) is managed on the{" "}
        <Link
          href={`/yip/dashboard/events/${eventId}/jury/sessions`}
          className="text-[#138808] underline"
        >
          Jury → Sessions
        </Link>{" "}
        screen.
      </p>
    </div>
  );
}

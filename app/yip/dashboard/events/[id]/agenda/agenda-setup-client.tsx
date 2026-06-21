"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  setAgendaItemInRun,
  reorderAgenda,
  updateAgendaItem,
  addAgendaItem,
  deleteAgendaItem,
  moveAgendaItemToDay,
} from "@/app/yip/actions/agenda";
import {
  savePresetFromEvent,
  applyPresetToEvent,
  deletePreset,
  type PresetSummary,
} from "@/app/yip/actions/agenda-presets";
import type { Tables } from "@/types/yip/database";
import {
  CalendarClock,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
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
  BookmarkPlus,
  FolderDown,
} from "lucide-react";

type AgendaItem = Tables<{ schema: "yip" }, "agenda">;

// Small, safe set of types for custom items so `mode` resolves correctly on the
// server (modeForAgendaType): general→party, break/inaugural→mixed.
const ADD_TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "break", label: "Break" },
  { value: "inaugural", label: "Ceremony" },
] as const;

function prettyType(t: string | null): string {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AgendaSetupClient({
  eventId,
  items,
  scoreCounts,
  presets,
  canDelete,
  isLive,
}: {
  eventId: string;
  items: AgendaItem[];
  scoreCounts: Record<string, number>;
  presets: PresetSummary[];
  // canDelete = chair / national. Doubles as the gate for saving/deleting a
  // chapter preset (both are chair-only).
  canDelete: boolean;
  isLive: boolean;
}) {
  const router = useRouter();

  // Days the event actually has (0 = prep, 1, 2). Derived from the data so
  // day-0 prep items — and any future day count — are never hidden by a
  // hardcoded tab list.
  const days = Array.from(new Set(items.map((i) => i.day))).sort(
    (a, b) => a - b
  );
  const dayChoices = days.length > 0 ? days : [1, 2];

  const [activeDay, setActiveDay] = useState<number>(() =>
    dayChoices.includes(1) ? 1 : dayChoices[0]
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");

  // Delete confirm + exclude-scored confirm + add form
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingExcludeId, setPendingExcludeId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDuration, setAddDuration] = useState("15");
  const [addType, setAddType] = useState<string>("general");
  const [adding, setAdding] = useState(false);

  // Chapter presets (Phase 3)
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetBusyId, setPresetBusyId] = useState<string | null>(null);
  const [confirmApplyId, setConfirmApplyId] = useState<string | null>(null);
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<
    string | null
  >(null);
  const [presetError, setPresetError] = useState<string | null>(null);

  const dayItems = items
    .filter((i) => i.day === activeDay)
    .sort((a, b) => a.sequence_order - b.sequence_order);
  const runLiveCount = dayItems.filter((i) => i.status !== "skipped").length;
  const scoredCount = dayItems.filter((i) => i.is_scoreable).length;

  // Day total: time the sessions that WILL run live add up to, so an organiser
  // can spot a day that overruns. Excluded sessions don't count toward it.
  const dayMinutes = dayItems
    .filter((i) => i.status !== "skipped")
    .reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0);
  const formatMins = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const dayLabel = (d: number) => (d === 0 ? "Day 0 (prep)" : `Day ${d}`);

  // Safety net (Q6): warn when the event HAS scored sessions but every one of
  // them is excluded from the live run → juries would have nothing to mark.
  // Event-wide (both days), not just the active day.
  const scoreableAll = items.filter((i) => i.is_scoreable);
  const noScoredWillRun =
    scoreableAll.length > 0 &&
    scoreableAll.every((i) => i.status === "skipped");

  // Excluding a SCORED session asks for confirmation first (Q1). Including, or
  // excluding a non-scored item, applies immediately.
  function onToggleRunLive(item: AgendaItem) {
    const turningOff = item.status !== "skipped";
    if (turningOff && item.is_scoreable) {
      setError(null);
      setConfirmDeleteId(null);
      setPendingExcludeId(item.id);
      return;
    }
    applyToggle(item);
  }

  async function applyToggle(item: AgendaItem) {
    setError(null);
    setPendingExcludeId(null);
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

  async function moveToDay(item: AgendaItem, targetDay: number) {
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

  function startEdit(item: AgendaItem) {
    setError(null);
    setEditId(item.id);
    setEditTitle(item.title);
    setEditDuration(String(item.duration_minutes ?? ""));
  }

  async function saveEdit(item: AgendaItem) {
    setError(null);
    setBusyId(item.id);
    const res = await updateAgendaItem(eventId, item.id, {
      title: editTitle,
      duration_minutes: editDuration === "" ? undefined : Number(editDuration),
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
    router.refresh();
  }

  // ── Chapter presets ──────────────────────────────────────────────
  async function doSavePreset() {
    setPresetError(null);
    setSavingPreset(true);
    const res = await savePresetFromEvent(eventId, presetName);
    setSavingPreset(false);
    if (!res.success) {
      setPresetError(res.error);
      return;
    }
    setShowSavePreset(false);
    setPresetName("");
    router.refresh();
  }

  async function doApplyPreset(presetId: string) {
    setPresetError(null);
    setPresetBusyId(presetId);
    const res = await applyPresetToEvent(eventId, presetId);
    setPresetBusyId(null);
    setConfirmApplyId(null);
    if (!res.success) {
      setPresetError(res.error);
      return;
    }
    router.refresh();
  }

  async function doDeletePreset(presetId: string) {
    setPresetError(null);
    setPresetBusyId(presetId);
    const res = await deletePreset(eventId, presetId);
    setPresetBusyId(null);
    setConfirmDeletePresetId(null);
    if (!res.success) {
      setPresetError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock className="size-5 text-[#FF9933]" />
        <h1 className="text-lg font-bold text-gray-900">Agenda setup</h1>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Choose which agenda items run live on the day, and in what order. Switch
        an item off if your chapter does it before the event (e.g. party
        formation) or skips it — it won&apos;t show on the Control panel or
        projector, and the live flow will move straight past it.
      </p>

      {/* Day tabs */}
      <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5">
        {dayChoices.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setActiveDay(d);
              setEditId(null);
              setConfirmDeleteId(null);
              setPendingExcludeId(null);
              setShowAdd(false);
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeDay === d
                ? "bg-[#138808] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm font-medium text-gray-700">
        {runLiveCount} of {dayItems.length} items will run live on{" "}
        {dayLabel(activeDay)}
        {scoredCount > 0 && (
          <>
            {" · "}
            <span className="text-emerald-700">
              {scoredCount} scored
            </span>
          </>
        )}
        {" · "}
        <span className="text-gray-500">{formatMins(dayMinutes)} total</span>.
      </p>

      {isLive && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            This event is live. Use the Control panel&apos;s Skip / Jump for
            on-the-day changes — reordering here is limited while live.
          </span>
        </div>
      )}

      {noScoredWillRun && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            No scored sessions will run live — juries won&apos;t have anything to
            mark. Switch at least one scored session back on (across either day),
            or check this is intentional.
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
          No agenda items for Day {activeDay} yet.
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
            const pendingExclude = pendingExcludeId === item.id;

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
                          {item.is_scoreable && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                              <Star className="size-3 fill-emerald-600 text-emerald-600" />
                              Scored
                            </span>
                          )}
                          {item.agenda_type && (
                            <span>{prettyType(item.agenda_type)}</span>
                          )}
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="size-3" />
                            {item.duration_minutes ?? 0} min
                          </span>
                          {isInProgress && (
                            <span className="font-semibold text-[#138808]">
                              Live now
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-gray-400">Done</span>
                          )}
                          {excluded && (
                            <span className="text-amber-700">
                              {item.skip_reason === "skipped_live"
                                ? "Skipped on the day"
                                : "Won't run live"}
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {!editing && !confirming && !pendingExclude && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => startEdit(item)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {dayChoices
                        .filter((d) => d !== item.day)
                        .map((d) => (
                          <button
                            key={d}
                            type="button"
                            aria-label={`Move to ${dayLabel(d)}`}
                            title={`Move to ${dayLabel(d)}`}
                            disabled={busy}
                            onClick={() => moveToDay(item, d)}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                          >
                            <ArrowLeftRight className="size-3.5" />D{d}
                          </button>
                        ))}
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
                      {/* Run-live toggle */}
                      {lockedToggle ? (
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
                          onClick={() => onToggleRunLive(item)}
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
                      )}
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

                  {pendingExclude && (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-amber-700">
                        {(scoreCounts[item.id] ?? 0) > 0
                          ? `Scored — ${scoreCounts[item.id]} mark${scoreCounts[item.id] === 1 ? "" : "s"} already recorded (kept). Switch off?`
                          : "Scored — juries won't mark it. Switch off?"}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => applyToggle(item)}
                        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Switch off"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingExcludeId(null)}
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
              placeholder={`New item title for Day ${activeDay}`}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
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
                  Add to Day {activeDay}
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
              Added to the end of Day {activeDay} — use the arrows to move it into
              place.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-[#138808] hover:text-[#138808]"
          >
            <Plus className="size-4" />
            Add a custom item
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

      {/* Chapter presets (Phase 3) — save this agenda for reuse on future events */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="mb-1 flex items-center gap-2">
          <FolderDown className="size-4 text-[#FF9933]" />
          <h2 className="text-sm font-bold text-gray-900">
            Chapter agenda presets
          </h2>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Save this agenda so your chapter can reuse it on future events. Saved
          presets stay as they are — later changes to the central template
          don&apos;t alter them.
        </p>

        {presetError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{presetError}</span>
          </div>
        )}

        {presets.length > 0 ? (
          <ul className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {presets.map((p) => {
              const busy = presetBusyId === p.id;
              const applying = confirmApplyId === p.id;
              const deleting = confirmDeletePresetId === p.id;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.item_count} item{p.item_count === 1 ? "" : "s"}
                    </p>
                  </div>

                  {applying ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-amber-700">
                        Replace this agenda?
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => doApplyPreset(p.id)}
                        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Replace"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmApplyId(null)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : deleting ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-red-700">Delete preset?</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => doDeletePreset(p.id)}
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
                        onClick={() => setConfirmDeletePresetId(null)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setConfirmDeletePresetId(null);
                          setConfirmApplyId(p.id);
                        }}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Apply
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete preset ${p.name}`}
                          disabled={busy}
                          onClick={() => {
                            setConfirmApplyId(null);
                            setConfirmDeletePresetId(p.id);
                          }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-gray-400">
            No saved presets yet for this chapter.
          </p>
        )}

        {canDelete &&
          (showSavePreset ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name (e.g. Full 2-day)"
                maxLength={80}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={savingPreset || !presetName.trim()}
                onClick={doSavePreset}
                className="inline-flex items-center gap-1 rounded-md bg-[#138808] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f6e06] disabled:opacity-50"
              >
                {savingPreset ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save preset
              </button>
              <button
                type="button"
                onClick={() => setShowSavePreset(false)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSavePreset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-[#138808] hover:text-[#138808]"
            >
              <BookmarkPlus className="size-4" />
              Save current agenda as a preset
            </button>
          ))}
      </div>
    </div>
  );
}

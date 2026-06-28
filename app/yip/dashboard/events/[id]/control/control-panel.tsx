"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Input } from "@/components/yip/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/yip/ui/dialog";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Check,
  Clock,
  Users,
  Star,
  UserCheck,
  Timer,
  Radio,
  AlertTriangle,
  Monitor,
  ListOrdered,
  Lock,
  Megaphone,
  Pencil,
} from "lucide-react";
import { Switch } from "@/components/yip/ui/switch";
import { Textarea } from "@/components/yip/ui/textarea";
import { MissionControl } from "./mission-control";
import { cn } from "@/lib/yip/utils";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { useRealtimeEvent } from "@/lib/yip/hooks/use-realtime-event";
import { useTimer } from "@/lib/yip/hooks/use-timer";
import { advanceAgenda, goToPreviousAgendaItem, reopenAgendaItem, reopenLastCompletedSession, resetAgenda, startAgendaItem, skipAgendaItem, updateEventStatus, updateAgendaItemDuration, updateAgendaItemSubTimers, setChapterControlFilter, type ControlAgendaFilter } from "@/app/yip/actions/agenda";
import { setJuryAllowEarlierSessions } from "@/app/yip/actions/jury";
import {
  getSubTimers,
  formatSubTimerSeconds,
  SUB_TIMER_MAX_ENTRIES,
  SUB_TIMER_LABEL_MAX,
  SUB_TIMER_MIN_SECONDS,
  SUB_TIMER_MAX_SECONDS,
  type SubTimer,
} from "@/lib/yip/sub-timers";
import { setAllocationLocked, setScoresLocked, setRegistrationsFrozen, setVoteCheckinSkipped, pushLiveBanner, clearLiveBanner } from "@/app/yip/actions/events";
import { startTimer, stopTimer, resetTimer } from "@/app/yip/actions/timer";
import { advanceSpeaker, skipSpeaker, generateSpeakerQueue, getSpeakerQueue } from "@/app/yip/actions/speakers";
import { QuestionHourPanel } from "./question-hour";
import { GovernmentFormationPanel } from "./government-formation";
import { VoteManager } from "./vote-manager";
import { BillSession } from "./bill-session";
import type { Tables } from "@/types/yip/database";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────

type Event = Tables<{ schema: "yip" }, "events">;
type AgendaItem = Tables<{ schema: "yip" }, "agenda">;

interface SpeakerWithParticipant {
  id: string;
  agenda_item_id: string;
  participant_id: string;
  speaking_order: number;
  status: string | null;
  allotted_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  actual_seconds: number | null;
  notes: string | null;
  created_at: string | null;
  participant: {
    id: string;
    full_name: string;
    parliament_role: string | null;
    party_side: string | null;
    party_number: number | null;
    constituency_name: string | null;
    constituency_state: string | null;
    school_name: string;
    ministry: string | null;
  } | null;
}

interface ControlPanelProps {
  initialEvent: Event;
  initialAgendaItems: AgendaItem[];
  initialSpeakers: SpeakerWithParticipant[];
  /**
   * Chair (chapter_admin) or national/super-admin only. Gates the strongest
   * backward controls — Reset (full rewind to the start) and Re-open a completed
   * item — which rewind everyone's live screen.
   */
  canControlAgendaBackward: boolean;
  /**
   * Any organiser (canManage). Gates the Previous button — stepping back one
   * item to undo a mis-advance is allowed for ordinary organisers now.
   */
  canManageAgenda: boolean;
  /** Per-chapter Control-panel agenda filter ("full" vs "scored_voted_only"). */
  initialControlFilter: ControlAgendaFilter;
  stats: {
    totalParticipants: number;
    checkedIn: number;
    scoresSubmitted: number;
  };
}

// ─── Status helpers ───────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  registration_open: { label: "Reg Open", className: "bg-blue-100 text-blue-700" },
  registration_closed: { label: "Reg Closed", className: "bg-yellow-100 text-yellow-700" },
  day1_live: { label: "Day 1 Live", className: "bg-green-100 text-green-800 animate-pulse" },
  day1_complete: { label: "Day 1 Done", className: "bg-emerald-100 text-emerald-700" },
  day2_live: { label: "Day 2 Live", className: "bg-green-100 text-green-800 animate-pulse" },
  completed: { label: "Completed", className: "bg-purple-100 text-purple-700" },
  results_published: { label: "Published", className: "bg-[#FF9933]/10 text-[#FF9933]" },
};

const AGENDA_STATUS_ICON: Record<string, { icon: string; className: string }> = {
  upcoming: { icon: "○", className: "text-gray-400" },
  in_progress: { icon: "●", className: "text-green-500 animate-pulse" },
  completed: { icon: "✓", className: "text-green-600" },
  skipped: { icon: "⊘", className: "text-gray-400 line-through" },
};

// ─── Component ────────────────────────────────────────────────────

export function ControlPanel({
  initialEvent,
  initialAgendaItems,
  initialSpeakers,
  canControlAgendaBackward,
  canManageAgenda,
  initialControlFilter,
  stats,
}: ControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [controlFilter, setControlFilter] =
    useState<ControlAgendaFilter>(initialControlFilter);
  const [timerDuration, setTimerDuration] = useState(90);
  const [speakers, setSpeakers] = useState<SpeakerWithParticipant[]>(initialSpeakers);
  // 0 = Pre-event (day-0 prep items), 1 = Day 1, 2 = Day 2. We never auto-open
  // Pre-event — it's an opt-in tab the moderator taps; the day always defaults
  // to the live day.
  const [activeDay, setActiveDay] = useState<0 | 1 | 2>(() => {
    if (initialEvent.status === "day2_live") return 2;
    if (initialEvent.status === "day1_complete") return 2;
    return 1;
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    /** Optional override for the confirm button label (default "Confirm"). */
    confirmLabel?: string;
    /** Render the confirm button in destructive (red) style. */
    destructive?: boolean;
  }>({ open: false, title: "", description: "", action: () => {} });
  // Inline duration editing in the agenda sidebar
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState<string>("");
  // Sub-phase timer presets (timer card) — inline editor + per-button pending.
  // The editor is keyed to the agenda item id it was opened for, so it
  // closes by itself when the current item changes (presets are per-item;
  // a stale draft must not save onto a new item).
  const [subTimerEditItemId, setSubTimerEditItemId] = useState<string | null>(
    null
  );
  const [subTimerDraft, setSubTimerDraft] = useState<
    { label: string; seconds: string }[]
  >([]);
  const [pendingSubTimerIdx, setPendingSubTimerIdx] = useState<number | null>(
    null
  );

  // Realtime subscription
  const { event, agendaItems, currentAgendaItem } = useRealtimeEvent(
    initialEvent.id,
    initialEvent,
    initialAgendaItems
  );

  // Timer
  const timer = useTimer(
    event?.live_timer_end ?? null,
    event?.live_timer_running ?? false
  );

  // When current agenda item changes, fetch speakers for it
  const fetchSpeakers = useCallback(async () => {
    if (!event?.current_agenda_item_id) {
      setSpeakers([]);
      return;
    }
    const data = await getSpeakerQueue(event.current_agenda_item_id);
    setSpeakers(data as SpeakerWithParticipant[]);
  }, [event?.current_agenda_item_id]);

  useEffect(() => {
    fetchSpeakers();
  }, [fetchSpeakers]);

  // Auto-switch day tab when event status changes
  useEffect(() => {
    if (event?.status === "day2_live") setActiveDay(2);
    if (event?.status === "day1_live") setActiveDay(1);
  }, [event?.status]);

  // Seed the timer input from the current agenda item's planned duration
  // (minutes → seconds). The organiser can still override the value before
  // starting. Re-seeds whenever the current item — or its duration — changes.
  const currentItemForSeed = currentAgendaItem;
  useEffect(() => {
    const mins = currentItemForSeed?.duration_minutes;
    if (mins && mins > 0) {
      setTimerDuration(Math.min(600, mins * 60));
    }
  }, [currentItemForSeed?.id, currentItemForSeed?.duration_minutes]);

  if (!event) return null;

  // Capture non-null event properties for use in closures (TypeScript narrowing)
  const eventId = event.id;
  const eventStatus = event.status;
  const currentItemId = event.current_agenda_item_id;

  // BUG-393 follow-up: organiser switch — let jurors score earlier sessions.
  const [juryAllowEarlier, setJuryAllowEarlier] = useState(
    Boolean(initialEvent.jury_allow_earlier_sessions)
  );
  const [juryAllowEarlierSaving, setJuryAllowEarlierSaving] = useState(false);

  async function handleToggleJuryAllowEarlier(next: boolean) {
    setJuryAllowEarlier(next); // optimistic
    setJuryAllowEarlierSaving(true);
    const res = await setJuryAllowEarlierSessions(eventId, next);
    setJuryAllowEarlierSaving(false);
    if (!res.success) {
      setJuryAllowEarlier(!next); // revert
      toast.error(res.error);
      return;
    }
    toast.success(
      next
        ? "Jurors can now score earlier sessions"
        : "Jurors locked to the current session"
    );
  }

  // Filter agenda items by active day
  // Per-chapter Control-panel filter (Maria item 4): "scored_voted_only" trims
  // the agenda list to sessions that are scored or voted, but always keeps the
  // item that is live right now visible so the moderator can see where they are.
  // Show the "Pre-event" tab only when the event actually has day-0 prep items
  // (otherwise older/other chapters would see an empty tab).
  const hasPreEventItems = agendaItems.some((i) => i.day === 0);
  const dayItems = agendaItems
    .filter((i) => i.day === activeDay)
    .filter(
      (i) =>
        controlFilter === "full" ||
        i.is_scoreable ||
        i.use_for_voting ||
        i.id === event.current_agenda_item_id
    );

  // Paused-state controls: when there is NO current agenda item (event paused
  // between sessions/days, e.g. day1_complete), surface backward controls only
  // once at least one session has actually run. The last completed item is the
  // one we re-open to resume — latest day, then latest sequence within it.
  const lastCompletedItem = [...agendaItems]
    .filter((i) => i.status === "completed")
    .sort(
      (a, b) =>
        (b.day ?? 0) - (a.day ?? 0) ||
        (b.sequence_order ?? 0) - (a.sequence_order ?? 0)
    )[0];
  const hasCompleted = lastCompletedItem != null;

  function handleSetControlFilter(mode: ControlAgendaFilter) {
    if (mode === controlFilter) return;
    const prev = controlFilter;
    setControlFilter(mode); // optimistic
    startTransition(async () => {
      const res = await setChapterControlFilter(eventId, mode);
      if (!res.success) {
        setControlFilter(prev);
        toast.error(res.error);
      }
    });
  }

  // Sub-phase presets for the current item: config.sub_timers override →
  // agenda_type defaults → [] (resolved + shape-validated in the lib helper).
  const subTimers: SubTimer[] = currentAgendaItem
    ? getSubTimers(currentAgendaItem.agenda_type, currentAgendaItem.config)
    : [];
  // Editor open only while the current item matches the one it was opened for.
  const editingSubTimers =
    currentAgendaItem != null && subTimerEditItemId === currentAgendaItem.id;

  // Current speaker info
  const currentSpeaker = speakers.find((s) => s.status === "speaking");
  const nextPendingSpeaker = speakers.find(
    (s) => s.status === "pending" || s.status === null
  );
  const completedSpeakers = speakers.filter((s) => s.status === "completed");
  const totalSpeakers = speakers.length;

  // Status transition logic
  const isLive = eventStatus === "day1_live" || eventStatus === "day2_live";

  function getNextTransition(): {
    label: string;
    status: string;
    variant: "default" | "destructive" | "outline";
  } | null {
    switch (eventStatus) {
      case "draft":
      case "registration_open":
      case "registration_closed":
        return { label: "Start Day 1", status: "day1_live", variant: "default" };
      case "day1_live":
        return { label: "End Day 1", status: "day1_complete", variant: "destructive" };
      case "day1_complete":
        return { label: "Start Day 2", status: "day2_live", variant: "default" };
      case "day2_live":
        return { label: "Complete Event", status: "completed", variant: "destructive" };
      default:
        return null;
    }
  }

  const nextTransition = getNextTransition();

  // ─── Action handlers ──────────────────────────────────────────

  function handleStatusTransition(newStatus: string, label: string) {
    setConfirmDialog({
      open: true,
      title: label,
      description: `Are you sure you want to ${label.toLowerCase()}? This action changes the event status and affects all connected clients.`,
      action: () => {
        startTransition(async () => {
          const result = await updateEventStatus(eventId, newStatus);
          if (result.success) {
            toast.success(`Event status updated: ${label}`);
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleAdvanceAgenda() {
    startTransition(async () => {
      const result = await advanceAgenda(eventId);
      if (result.success) {
        toast.success(
          result.data.nextItemId
            ? "Advanced to next agenda item"
            : "All agenda items completed for this day"
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  // Chair / national only. Reversible (it just moves the pointer back one
  // step), so it fires directly without a confirmation dialog.
  function handlePreviousAgenda() {
    startTransition(async () => {
      const result = await goToPreviousAgendaItem(eventId);
      if (result.success) {
        toast.success("Moved back to the previous agenda item");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // Chair / national only. Destructive (rewinds the WHOLE agenda for every
  // screen), so it confirms first via the shared dialog.
  function handleResetAgenda() {
    setConfirmDialog({
      open: true,
      title: "Reset the agenda?",
      description:
        "This sends the whole agenda back to the start — every screen (students, jury, projector) returns to the beginning. Votes and scores already recorded are kept; only the agenda position resets. Continue?",
      confirmLabel: "Yes, reset agenda",
      destructive: true,
      action: () => {
        startTransition(async () => {
          const result = await resetAgenda(eventId);
          if (result.success) {
            toast.success("Agenda reset to the start");
            router.refresh();
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // Paused-state "Go back": re-open the LAST finished session and make it live
  // again. Chair / national only (canControlAgendaBackward). When results are
  // already published, confirm first since re-opening may change them.
  function handleReopenLastSession() {
    const run = () =>
      startTransition(async () => {
        const result = await reopenLastCompletedSession(eventId);
        if (result.success) {
          toast.success("Re-opened the last session");
          router.refresh();
        } else {
          toast.error(result.error);
        }
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      });
    const scoresLocked = event?.scores_locked ?? false;
    if (eventStatus === "results_published" || scoresLocked) {
      setConfirmDialog({
        open: true,
        title: "Re-open the last session?",
        description:
          eventStatus === "results_published"
            ? "Results are already published - this may change them. Continue?"
            : "Scores for this event are locked. Re-opening makes the session live again but does not unlock scoring. Continue?",
        confirmLabel: "Yes, re-open",
        destructive: true,
        action: run,
      });
      return;
    }
    run();
  }

  // Paused-state Reset: full rewind to the start (reuses handleResetAgenda's
  // existing confirm). When results are already published, surface the
  // results-published warning first, then fall through to the normal reset.
  function handleResetAgendaGuarded() {
    const scoresLocked = event?.scores_locked ?? false;
    if (eventStatus === "results_published" || scoresLocked) {
      setConfirmDialog({
        open: true,
        title: "Reset the agenda?",
        description:
          eventStatus === "results_published"
            ? "Results are already published - this may change them. Continue?"
            : "Scores for this event are locked. Resetting the agenda does not unlock scoring. Continue?",
        confirmLabel: "Yes, reset agenda",
        destructive: true,
        action: () => {
          startTransition(async () => {
            const result = await resetAgenda(eventId);
            if (result.success) {
              toast.success("Agenda reset to the start");
              router.refresh();
            } else {
              toast.error(result.error);
            }
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          });
        },
      });
      return;
    }
    handleResetAgenda();
  }

  function handleJumpToItem(itemId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Jump to Item",
      description: `Jump to "${title}"? The current item will be marked as completed.`,
      action: () => {
        startTransition(async () => {
          const result = await startAgendaItem(eventId, itemId);
          if (result.success) {
            toast.success(`Now on: ${title}`);
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleSkipItem(itemId: string) {
    startTransition(async () => {
      const result = await skipAgendaItem(eventId, itemId);
      if (result.success) {
        toast.success("Item skipped");
      } else {
        toast.error(result.error);
      }
    });
  }

  // Chair / national only (BUG-409). Undo an accidental "complete": a finished
  // item goes back to upcoming so it can be run again; any scores already
  // entered are kept. Confirmed first since it changes the live agenda state.
  function handleReopenItem(itemId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Re-open this session?",
      description: `Re-open "${title}"? It returns to upcoming so you can run it again. Scores already entered for it are kept. (Blocked if scores are locked or results are published.)`,
      action: () => {
        startTransition(async () => {
          const result = await reopenAgendaItem(eventId, itemId);
          if (result.success) {
            toast.success(`Re-opened: ${title}`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleStartEditDuration(itemId: string, current: number | null) {
    setEditingDurationId(itemId);
    setDurationDraft(current != null ? String(current) : "");
  }

  function handleCancelEditDuration() {
    setEditingDurationId(null);
    setDurationDraft("");
  }

  function handleSaveDuration(itemId: string) {
    const minutes = Number(durationDraft);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
      toast.error("Duration must be between 1 and 600 minutes");
      return;
    }
    startTransition(async () => {
      const result = await updateAgendaItemDuration(itemId, minutes);
      if (result.success) {
        toast.success(`Duration set to ${Math.round(minutes)} min`);
        setEditingDurationId(null);
        setDurationDraft("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStartTimer() {
    startTransition(async () => {
      const result = await startTimer(eventId, timerDuration);
      if (result.success) {
        toast.success(`Timer started: ${timerDuration}s`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStopTimer() {
    startTransition(async () => {
      const result = await stopTimer(eventId);
      if (result.success) {
        toast.success("Timer stopped");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleResetTimer() {
    startTransition(async () => {
      const result = await resetTimer(eventId);
      if (result.success) {
        toast.success("Timer reset");
      } else {
        toast.error(result.error);
      }
    });
  }

  // ─── Sub-phase preset handlers ────────────────────────────────

  function handleFireSubTimer(index: number, preset: SubTimer) {
    if (!currentAgendaItem) return;
    const label = `${currentAgendaItem.title} — ${preset.label}`;
    setPendingSubTimerIdx(index);
    startTransition(async () => {
      const result = await startTimer(eventId, preset.seconds, label);
      if (result.success) {
        toast.success(
          `${preset.label} timer started (${formatSubTimerSeconds(preset.seconds)})`
        );
      } else {
        toast.error(result.error);
      }
      setPendingSubTimerIdx(null);
    });
  }

  function handleStartEditSubTimers() {
    if (!currentAgendaItem) return;
    setSubTimerDraft(
      subTimers.length > 0
        ? subTimers.map((t) => ({ label: t.label, seconds: String(t.seconds) }))
        : [{ label: "", seconds: "60" }]
    );
    setSubTimerEditItemId(currentAgendaItem.id);
  }

  function handleSubTimerDraftChange(
    index: number,
    field: "label" | "seconds",
    value: string
  ) {
    setSubTimerDraft((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function handleAddSubTimerRow() {
    setSubTimerDraft((prev) =>
      prev.length >= SUB_TIMER_MAX_ENTRIES
        ? prev
        : [...prev, { label: "", seconds: "60" }]
    );
  }

  function handleRemoveSubTimerRow(index: number) {
    setSubTimerDraft((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function handleSaveSubTimers() {
    if (!currentAgendaItem) return;
    const itemId = currentAgendaItem.id;
    const cleaned: SubTimer[] = [];
    for (const row of subTimerDraft) {
      const label = row.label.trim();
      const seconds = Math.round(Number(row.seconds));
      if (!label || label.length > SUB_TIMER_LABEL_MAX) {
        toast.error(`Each preset needs a label (max ${SUB_TIMER_LABEL_MAX} characters)`);
        return;
      }
      if (
        !Number.isInteger(seconds) ||
        seconds < SUB_TIMER_MIN_SECONDS ||
        seconds > SUB_TIMER_MAX_SECONDS
      ) {
        toast.error(
          `Each duration must be ${SUB_TIMER_MIN_SECONDS}–${SUB_TIMER_MAX_SECONDS} seconds`
        );
        return;
      }
      cleaned.push({ label, seconds });
    }
    if (cleaned.length < 1 || cleaned.length > SUB_TIMER_MAX_ENTRIES) {
      toast.error(`Provide between 1 and ${SUB_TIMER_MAX_ENTRIES} presets`);
      return;
    }
    startTransition(async () => {
      const result = await updateAgendaItemSubTimers(eventId, itemId, cleaned);
      if (result.success) {
        toast.success("Sub-phase presets saved");
        setSubTimerEditItemId(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleResetSubTimers() {
    if (!currentAgendaItem) return;
    const itemId = currentAgendaItem.id;
    startTransition(async () => {
      const result = await updateAgendaItemSubTimers(eventId, itemId, null);
      if (result.success) {
        toast.success("Presets reset to defaults");
        setSubTimerEditItemId(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleAdvanceSpeaker() {
    if (!currentItemId) return;
    startTransition(async () => {
      const result = await advanceSpeaker(
        currentItemId,
        eventId
      );
      if (result.success) {
        toast.success("Advanced to next speaker");
        fetchSpeakers();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSkipSpeaker(speakerId: string) {
    if (!currentItemId) return;
    startTransition(async () => {
      const result = await skipSpeaker(
        currentItemId,
        speakerId,
        eventId
      );
      if (result.success) {
        toast.success("Speaker skipped");
        fetchSpeakers();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleAllocationLock(next: boolean) {
    startTransition(async () => {
      const result = await setAllocationLocked(eventId, next);
      if (result.success) {
        toast.success(next ? "Allocation locked" : "Allocation unlocked");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleRegistrationsFrozen(next: boolean) {
    startTransition(async () => {
      const result = await setRegistrationsFrozen(eventId, next);
      if (result.success) {
        toast.success(next ? "Registrations frozen" : "Registrations open");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleScoresLock(next: boolean) {
    if (next) {
      // Locking scores stops live scoring — confirm before applying.
      setConfirmDialog({
        open: true,
        title: "Lock scores?",
        description:
          "This will stop all jury scoring submissions immediately. Connected jury devices will see the locked banner within ~1 second. You can unlock again at any time.",
        action: () => {
          startTransition(async () => {
            const result = await setScoresLocked(eventId, true);
            if (result.success) {
              toast.success("Scores locked");
            } else {
              toast.error(result.error);
            }
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          });
        },
      });
      return;
    }
    startTransition(async () => {
      const result = await setScoresLocked(eventId, false);
      if (result.success) {
        toast.success("Scores unlocked");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleSkipVoteCheckin(next: boolean) {
    startTransition(async () => {
      const result = await setVoteCheckinSkipped(eventId, next);
      if (result.success) {
        toast.success(
          next
            ? "Online voting on — students can vote without check-in"
            : "Online voting off — check-in required to vote"
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleGenerateSpeakers() {
    if (!currentItemId) return;
    startTransition(async () => {
      const result = await generateSpeakerQueue(
        eventId,
        currentItemId,
        timerDuration
      );
      if (result.success) {
        toast.success(`Generated ${result.data.count} speakers`);
        fetchSpeakers();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────

  const statusInfo = STATUS_MAP[eventStatus] ?? {
    label: eventStatus,
    className: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      {/* Top bar: Status + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={statusInfo.className}>
            <Radio className="mr-1 size-3" />
            {statusInfo.label}
          </Badge>
          {isLive && (
            <a
              href={`/yip/event/${eventId}/display`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <Monitor className="size-3.5" />
              Open Projector View
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {nextTransition && (
            <Button
              variant={nextTransition.variant}
              size="sm"
              disabled={isPending}
              onClick={() =>
                handleStatusTransition(
                  nextTransition.status,
                  nextTransition.label
                )
              }
            >
              {nextTransition.label}
            </Button>
          )}
        </div>
      </div>

      {/* Mission Control — non-blocking guided readiness board for organisers
          (additive overlay; never blocks any action). */}
      <MissionControl eventId={initialEvent.id} />

      {/* Jury catch-up switch (BUG-393) — organiser lets jurors score earlier
          sessions, not only the current + immediately-previous one. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Let jurors score earlier sessions
          </p>
          <p className="text-xs text-gray-500">
            On: jurors get a &ldquo;Score an earlier session&rdquo; option to
            catch up on sessions they missed. Off: they can only score the
            current session and the one just before it.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={juryAllowEarlier}
          aria-label="Let jurors score earlier sessions"
          disabled={juryAllowEarlierSaving}
          onClick={() => handleToggleJuryAllowEarlier(!juryAllowEarlier)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            juryAllowEarlier ? "bg-[#138808]" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
              juryAllowEarlier ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Main layout: Left panel + Right sidebar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* ─── LEFT: Main control area ───────────────────── */}
        <div className="space-y-4">
          {/* Current Agenda Item */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                Current Agenda Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentAgendaItem ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {currentAgendaItem.title}
                    </h2>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {/* Backward controls — cautious secondary actions vs the
                          primary Next. Previous = any organiser; Reset = chair /
                          national only (full rewind). */}
                      {canManageAgenda && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={handlePreviousAgenda}
                        >
                          <ChevronLeft className="size-4" />
                          Previous
                        </Button>
                      )}
                      {canControlAgendaBackward && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={handleResetAgenda}
                          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Undo2 className="size-4" />
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          handleSkipItem(currentAgendaItem.id)
                        }
                      >
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={handleAdvanceAgenda}
                      >
                        <ChevronRight className="size-4" />
                        Next
                      </Button>
                    </div>
                  </div>
                  {currentAgendaItem.duration_minutes && (
                    <p className="text-sm text-muted-foreground">
                      Planned duration: {currentAgendaItem.duration_minutes} min
                      {currentAgendaItem.agenda_type && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {currentAgendaItem.agenda_type}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : hasCompleted ? (
                <div className="space-y-3 py-4">
                  <p className="text-center text-sm text-muted-foreground">
                    The agenda is paused between sessions. Re-open the last
                    session to pick up where you left off.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {canControlAgendaBackward && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleReopenLastSession}
                      >
                        <ChevronLeft className="size-4" />
                        Re-open last session
                      </Button>
                    )}
                    {canControlAgendaBackward && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleResetAgendaGuarded}
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Undo2 className="size-4" />
                        Reset
                      </Button>
                    )}
                    <div className="flex flex-col items-center">
                      <Button variant="outline" size="sm" disabled>
                        <SkipForward className="size-4" />
                        Skip speaker
                      </Button>
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        Available during a live session.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  {isLive
                    ? "No agenda item active. Click an item in the sidebar or press Next."
                    : "Start the event to begin the agenda."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timer */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Timer display */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "font-mono text-6xl font-bold tabular-nums tracking-tight",
                      timer.isExpired
                        ? "animate-pulse text-red-600"
                        : timer.isActive
                          ? "text-green-600"
                          : "text-gray-400"
                    )}
                  >
                    {timer.display}
                  </div>
                  {timer.isExpired && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-red-600">
                      <AlertTriangle className="size-4" />
                      TIME UP
                    </div>
                  )}
                  {event.live_timer_label && (
                    <p className="text-xs text-muted-foreground">
                      {event.live_timer_label}
                    </p>
                  )}
                </div>

                {/* Timer controls */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={600}
                      value={timerDuration}
                      onChange={(e) =>
                        setTimerDuration(Number(e.target.value) || 90)
                      }
                      className="w-20 text-center"
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                  </div>
                  <div className="flex gap-1.5">
                    {!timer.isActive ? (
                      <Button
                        size="sm"
                        disabled={isPending || !isLive}
                        onClick={handleStartTimer}
                      >
                        <Play className="size-3.5" />
                        Start
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={handleStopTimer}
                      >
                        <Pause className="size-3.5" />
                        Stop
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={handleResetTimer}
                    >
                      <RotateCcw className="size-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sub-phase timer presets — one-tap short timers for the
                  current agenda item (e.g. Question 1:00 / Answer 1:30).
                  Per-item overrides live in agenda.config.sub_timers. */}
              {currentAgendaItem &&
                (subTimers.length > 0 || editingSubTimers) && (
                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Timer className="size-3.5" />
                        Sub-phase presets
                        <span className="truncate font-normal">
                          — {currentAgendaItem.title}
                        </span>
                      </p>
                      {!editingSubTimers && (
                        <button
                          type="button"
                          onClick={handleStartEditSubTimers}
                          disabled={isPending}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-gray-200 hover:text-gray-700"
                          aria-label="Edit sub-phase presets"
                          title="Edit sub-phase presets"
                        >
                          <Pencil className="size-3" />
                        </button>
                      )}
                    </div>
                    {!editingSubTimers ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {subTimers.map((preset, i) => (
                          <Button
                            key={`${preset.label}-${i}`}
                            size="sm"
                            variant="outline"
                            disabled={isPending || !isLive}
                            onClick={() => handleFireSubTimer(i, preset)}
                          >
                            <Play className="size-3" />
                            {pendingSubTimerIdx === i
                              ? "Starting…"
                              : `${preset.label} · ${formatSubTimerSeconds(preset.seconds)}`}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {subTimerDraft.map((row, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input
                              value={row.label}
                              maxLength={SUB_TIMER_LABEL_MAX}
                              placeholder="Label"
                              onChange={(e) =>
                                handleSubTimerDraftChange(i, "label", e.target.value)
                              }
                              className="h-7 flex-1 text-xs"
                              aria-label={`Preset ${i + 1} label`}
                            />
                            <Input
                              type="number"
                              min={SUB_TIMER_MIN_SECONDS}
                              max={SUB_TIMER_MAX_SECONDS}
                              value={row.seconds}
                              onChange={(e) =>
                                handleSubTimerDraftChange(i, "seconds", e.target.value)
                              }
                              className="h-7 w-20 text-center text-xs"
                              aria-label={`Preset ${i + 1} seconds`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              sec
                            </span>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={isPending || subTimerDraft.length <= 1}
                              onClick={() => handleRemoveSubTimerRow(i)}
                              aria-label={`Remove preset ${i + 1}`}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={
                              isPending ||
                              subTimerDraft.length >= SUB_TIMER_MAX_ENTRIES
                            }
                            onClick={handleAddSubTimerRow}
                          >
                            + Add
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            disabled={isPending}
                            onClick={handleSaveSubTimers}
                          >
                            <Check className="size-3" />
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={handleResetSubTimers}
                          >
                            Reset to defaults
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => setSubTimerEditItemId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Question Hour Panel (replaces speaker queue for question_hour agenda type) */}
          {currentAgendaItem?.agenda_type === "question_hour" && (
            <QuestionHourPanel eventId={eventId} />
          )}

          {/* Government Formation (Ruling vs Opposition split, day-of).
              Always available so the bench split can be corrected at any point
              in the event; auto-expands while the formation session is live. */}
          <GovernmentFormationPanel
            eventId={eventId}
            isActiveSession={
              currentAgendaItem?.agenda_type === "party_formation"
            }
          />

          {/* Bill Session (for bill_presentation agenda type) */}
          {currentAgendaItem?.agenda_type === "bill_presentation" && (
            <BillSession
              eventId={eventId}
              agendaItemId={currentAgendaItem.id}
            />
          )}

          {/* Vote Manager (for speaker_election and bill_presentation agenda types) */}
          {currentAgendaItem && (
            <VoteManager
              eventId={eventId}
              currentAgendaItem={currentAgendaItem}
              totalParticipants={stats.totalParticipants}
            />
          )}

          {/* Current Speaker */}
          {currentAgendaItem && currentAgendaItem.agenda_type !== "question_hour" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4" />
                    Speakers
                    {totalSpeakers > 0 && (
                      <span className="text-xs">
                        ({completedSpeakers.length}/{totalSpeakers})
                      </span>
                    )}
                  </CardTitle>
                  {speakers.length === 0 && isLive && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={handleGenerateSpeakers}
                    >
                      <ListOrdered className="size-3.5" />
                      Generate Queue
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {currentSpeaker ? (
                  <div className="space-y-4">
                    {/* Active speaker card */}
                    <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            {currentSpeaker.participant?.full_name ?? "Unknown"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {currentSpeaker.participant?.parliament_role && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  ROLE_COLORS[
                                    currentSpeaker.participant.parliament_role
                                  ] ?? "bg-gray-500 text-white"
                                )}
                              >
                                {ROLE_LABELS[
                                  currentSpeaker.participant.parliament_role
                                ] ?? currentSpeaker.participant.parliament_role}
                              </span>
                            )}
                            {(currentSpeaker.participant?.party_side ||
                              currentSpeaker.participant?.party_number !=
                                null) && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  currentSpeaker.participant.party_side
                                    ? PARTY_COLORS[
                                        currentSpeaker.participant
                                          .party_side as keyof typeof PARTY_COLORS
                                      ]?.badge ?? "bg-gray-500 text-white"
                                    : "bg-[#FF9933]/15 text-[#9a5212]"
                                )}
                              >
                                {currentSpeaker.participant.party_number != null
                                  ? `Party ${String.fromCharCode(
                                      64 +
                                        currentSpeaker.participant.party_number
                                    )}`
                                  : currentSpeaker.participant.party_side ===
                                      "ruling"
                                    ? "Ruling"
                                    : "Opposition"}
                                {currentSpeaker.participant.party_side && (
                                  <span className="ml-1 font-normal opacity-80">
                                    ·{" "}
                                    {currentSpeaker.participant.party_side ===
                                    "ruling"
                                      ? "Ruling"
                                      : "Opposition"}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          {currentSpeaker.participant?.constituency_name && (
                            <p className="mt-1 text-sm text-gray-600">
                              {currentSpeaker.participant.constituency_name}
                              {currentSpeaker.participant.constituency_state
                                ? `, ${currentSpeaker.participant.constituency_state}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {nextPendingSpeaker && (
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleAdvanceSpeaker}
                            >
                              <SkipForward className="size-3.5" />
                              Next Speaker
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              handleSkipSpeaker(currentSpeaker.id)
                            }
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Speaker queue list */}
                    {speakers.length > 0 && (
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {speakers.map((speaker) => (
                          <div
                            key={speaker.id}
                            className={cn(
                              "flex items-center justify-between rounded px-3 py-1.5 text-sm",
                              speaker.status === "speaking" &&
                                "bg-green-50 font-medium",
                              speaker.status === "completed" &&
                                "text-muted-foreground",
                              speaker.status === "skipped" &&
                                "text-muted-foreground line-through"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 text-center text-xs text-muted-foreground">
                                {speaker.speaking_order}
                              </span>
                              {speaker.status === "completed" && (
                                <Check className="size-3.5 text-green-600" />
                              )}
                              {speaker.status === "speaking" && (
                                <span className="size-2 animate-pulse rounded-full bg-green-500" />
                              )}
                              {(speaker.status === "pending" ||
                                speaker.status === null) && (
                                <span className="size-2 rounded-full bg-gray-300" />
                              )}
                              {speaker.status === "skipped" && (
                                <span className="size-2 rounded-full bg-gray-300" />
                              )}
                              <span>
                                {speaker.participant?.full_name ?? "Unknown"}
                              </span>
                            </div>
                            {(speaker.participant?.party_side ||
                              speaker.participant?.party_number != null) && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  speaker.participant.party_side === "ruling"
                                    ? "bg-blue-100 text-blue-700"
                                    : speaker.participant.party_side ===
                                        "opposition"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-[#FF9933]/15 text-[#9a5212]"
                                )}
                              >
                                {speaker.participant.party_number != null
                                  ? String.fromCharCode(
                                      64 + speaker.participant.party_number
                                    )
                                  : speaker.participant.party_side === "ruling"
                                    ? "R"
                                    : "O"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : speakers.length > 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-muted-foreground">
                      No speaker is currently active.
                    </p>
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={handleAdvanceSpeaker}
                    >
                      <Play className="size-3.5" />
                      Start First Speaker
                    </Button>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No speakers queued for this item.
                    {isLive && " Click 'Generate Queue' to auto-populate."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── RIGHT: Agenda sidebar ─────────────────────── */}
        <div className="space-y-4">
          {/* Day tabs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Agenda</CardTitle>
                <div className="flex gap-1">
                  {hasPreEventItems && (
                    <Button
                      variant={activeDay === 0 ? "default" : "outline"}
                      size="xs"
                      onClick={() => setActiveDay(0)}
                    >
                      Pre-event
                    </Button>
                  )}
                  <Button
                    variant={activeDay === 1 ? "default" : "outline"}
                    size="xs"
                    onClick={() => setActiveDay(1)}
                  >
                    Day 1
                  </Button>
                  <Button
                    variant={activeDay === 2 ? "default" : "outline"}
                    size="xs"
                    onClick={() => setActiveDay(2)}
                  >
                    Day 2
                  </Button>
                </div>
              </div>
              {canManageAgenda && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  <span className="text-gray-500">Show:</span>
                  <button
                    type="button"
                    onClick={() => handleSetControlFilter("full")}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium transition-colors",
                      controlFilter === "full"
                        ? "bg-[#1a1a3e] text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    Full agenda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetControlFilter("scored_voted_only")}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium transition-colors",
                      controlFilter === "scored_voted_only"
                        ? "bg-[#1a1a3e] text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    Scored / voted only
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-0.5 overflow-y-auto">
                {dayItems.map((item) => {
                  const status = item.status ?? "upcoming";
                  const statusInfo =
                    AGENDA_STATUS_ICON[status] ?? AGENDA_STATUS_ICON.upcoming;
                  const isCurrent = item.id === currentItemId;

                  const canJump =
                    isLive &&
                    !isCurrent &&
                    status !== "completed" &&
                    status !== "skipped";
                  const isEditing = editingDurationId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isCurrent
                          ? "bg-green-50 ring-1 ring-green-300"
                          : status === "completed"
                            ? "opacity-60"
                            : status === "skipped"
                              ? "opacity-40"
                              : "hover:bg-gray-50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (canJump) handleJumpToItem(item.id, item.title);
                        }}
                        disabled={!canJump}
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-2 text-left",
                          canJump ? "cursor-pointer" : "cursor-default"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 text-sm leading-none",
                            statusInfo.className
                          )}
                        >
                          {statusInfo.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-xs font-medium",
                              status === "skipped" && "line-through",
                              isCurrent && "text-green-800"
                            )}
                          >
                            {item.title}
                          </p>
                          {!isEditing && (
                            <p className="text-[10px] text-muted-foreground">
                              {item.duration_minutes
                                ? `${item.duration_minutes} min`
                                : "No duration set"}
                            </p>
                          )}
                        </div>
                      </button>
                      {/* Inline duration editor */}
                      {isEditing ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={600}
                            value={durationDraft}
                            autoFocus
                            onChange={(e) => setDurationDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveDuration(item.id);
                              if (e.key === "Escape") handleCancelEditDuration();
                            }}
                            className="h-6 w-14 px-1 text-center text-xs"
                            aria-label={`Duration in minutes for ${item.title}`}
                          />
                          <Button
                            type="button"
                            size="xs"
                            variant="default"
                            disabled={isPending}
                            onClick={() => handleSaveDuration(item.id)}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={handleCancelEditDuration}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-start gap-0.5">
                          {status === "completed" && canControlAgendaBackward && (
                            <button
                              type="button"
                              onClick={() => handleReopenItem(item.id, item.title)}
                              disabled={isPending}
                              className="mt-0.5 shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                              aria-label={`Re-open ${item.title}`}
                              title="Re-open this completed session"
                            >
                              <RotateCcw className="size-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleStartEditDuration(
                                item.id,
                                item.duration_minutes
                              )
                            }
                            disabled={isPending}
                            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-gray-200 hover:text-gray-700"
                            aria-label={`Edit duration for ${item.title}`}
                            title="Edit planned duration"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayItems.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No agenda items for{" "}
                    {activeDay === 0 ? "Pre-event" : `Day ${activeDay}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Locks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Lock className="size-3.5" />
                Locks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Allocation lock</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Disables further role &amp; party changes.
                    </p>
                  </div>
                  <Switch
                    checked={event.allocation_locked ?? false}
                    disabled={isPending}
                    onCheckedChange={handleToggleAllocationLock}
                    aria-label="Toggle allocation lock"
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Registrations frozen</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Blocks new participant registrations.
                    </p>
                  </div>
                  <Switch
                    checked={
                      ((event as unknown as { registrations_frozen?: boolean | null })
                        .registrations_frozen ?? false)
                    }
                    disabled={isPending}
                    onCheckedChange={handleToggleRegistrationsFrozen}
                    aria-label="Toggle registrations frozen"
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Scores locked</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Blocks jury submissions live.
                    </p>
                  </div>
                  <Switch
                    checked={event.scores_locked ?? false}
                    disabled={isPending}
                    onCheckedChange={handleToggleScoresLock}
                    aria-label="Toggle scores lock"
                  />
                </div>
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Online event</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Lets students vote without checking in (no physical desk
                      online). Applies to every vote, all days.
                    </p>
                  </div>
                  <Switch
                    checked={
                      (event as unknown as { skip_vote_checkin?: boolean | null })
                        .skip_vote_checkin ?? false
                    }
                    disabled={isPending}
                    onCheckedChange={handleToggleSkipVoteCheckin}
                    aria-label="Toggle online event (vote without check-in)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-3.5" />
                    Participants
                  </span>
                  <span className="font-medium">
                    {stats.totalParticipants}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <UserCheck className="size-3.5" />
                    Checked In
                  </span>
                  <span className="font-medium">{stats.checkedIn}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="size-3.5" />
                    Scores Submitted
                  </span>
                  <span className="font-medium">{stats.scoresSubmitted}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.destructive ? "destructive" : "default"}
              disabled={isPending}
              onClick={confirmDialog.action}
            >
              {isPending
                ? "Processing..."
                : confirmDialog.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === F5: Live Banner (broadcast to projector) === */}
      <LiveBannerBroadcastSection
        eventId={eventId}
        initialActive={(event.live_banner_active ?? false) === true}
        initialText={event.live_banner_text ?? null}
      />
    </div>
  );
}

// ─── F5 Live Banner Broadcast Section ──────────────────────────────
function LiveBannerBroadcastSection({
  eventId,
  initialActive,
  initialText,
}: {
  eventId: string;
  initialActive: boolean;
  initialText: string | null;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const MAX = 280;
  const trimmed = text.trim();
  const remaining = MAX - trimmed.length;
  const canPush = trimmed.length > 0 && trimmed.length <= MAX && !pending;

  function onPush() {
    if (!canPush) return;
    setError(null);
    startTransition(async () => {
      const result = await pushLiveBanner(eventId, trimmed);
      if (result.success) {
        setActive(true);
      } else {
        setError(result.error);
      }
    });
  }

  function onClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearLiveBanner(eventId);
      if (result.success) {
        setActive(false);
        setText("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="border-red-200/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="size-4" />
          Broadcast (Projector Banner)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            placeholder="Breaking news — appears on projector screen"
            className="min-h-[80px]"
            disabled={pending}
          />
          <div className="flex items-center justify-between text-xs text-[#1a1a3e]/60">
            <span>{remaining} chars remaining</span>
            {active ? (
              <span className="font-medium text-red-700 flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-red-600 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span>Not broadcasting</span>
            )}
          </div>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 text-red-700 text-xs p-2">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={onPush}
            disabled={!canPush}
            className="flex-1 gap-1.5"
          >
            <Megaphone className="size-3.5" />
            {active ? "Update banner" : "Push to projector"}
          </Button>
          <Button
            onClick={onClear}
            disabled={pending || !active}
            variant="outline"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

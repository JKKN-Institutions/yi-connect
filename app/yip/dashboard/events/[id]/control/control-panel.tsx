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
  ChevronRight,
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
} from "lucide-react";
import { Switch } from "@/components/yip/ui/switch";
import { cn } from "@/lib/yip/utils";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { useRealtimeEvent } from "@/lib/yip/hooks/use-realtime-event";
import { useTimer } from "@/lib/yip/hooks/use-timer";
import { advanceAgenda, startAgendaItem, skipAgendaItem, updateEventStatus } from "@/app/yip/actions/agenda";
import { setAllocationLocked, setScoresLocked, setRegistrationsFrozen } from "@/app/yip/actions/events";
import { startTimer, stopTimer, resetTimer } from "@/app/yip/actions/timer";
import { advanceSpeaker, skipSpeaker, generateSpeakerQueue, getSpeakerQueue } from "@/app/yip/actions/speakers";
import { QuestionHourPanel } from "./question-hour";
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
  stats,
}: ControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [timerDuration, setTimerDuration] = useState(90);
  const [speakers, setSpeakers] = useState<SpeakerWithParticipant[]>(initialSpeakers);
  const [activeDay, setActiveDay] = useState<1 | 2>(() => {
    if (initialEvent.status === "day2_live") return 2;
    if (initialEvent.status === "day1_complete") return 2;
    return 1;
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

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

  if (!event) return null;

  // Capture non-null event properties for use in closures (TypeScript narrowing)
  const eventId = event.id;
  const eventStatus = event.status;
  const currentItemId = event.current_agenda_item_id;

  // Filter agenda items by active day
  const dayItems = agendaItems.filter((i) => i.day === activeDay);

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
              href={`/event/${eventId}/display`}
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
                    <div className="flex shrink-0 gap-1.5">
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
            </CardContent>
          </Card>

          {/* Question Hour Panel (replaces speaker queue for question_hour agenda type) */}
          {currentAgendaItem?.agenda_type === "question_hour" && (
            <QuestionHourPanel eventId={eventId} />
          )}

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
                            {currentSpeaker.participant?.party_side && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  PARTY_COLORS[
                                    currentSpeaker.participant
                                      .party_side as keyof typeof PARTY_COLORS
                                  ]?.badge ?? "bg-gray-500 text-white"
                                )}
                              >
                                {currentSpeaker.participant.party_side ===
                                "ruling"
                                  ? "Ruling"
                                  : "Opposition"}
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
                            {speaker.participant?.party_side && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  speaker.participant.party_side === "ruling"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                                )}
                              >
                                {speaker.participant.party_side === "ruling"
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
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] space-y-0.5 overflow-y-auto">
                {dayItems.map((item) => {
                  const status = item.status ?? "upcoming";
                  const statusInfo =
                    AGENDA_STATUS_ICON[status] ?? AGENDA_STATUS_ICON.upcoming;
                  const isCurrent = item.id === currentItemId;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (
                          isLive &&
                          !isCurrent &&
                          status !== "completed" &&
                          status !== "skipped"
                        ) {
                          handleJumpToItem(item.id, item.title);
                        }
                      }}
                      disabled={
                        !isLive ||
                        isCurrent ||
                        status === "completed" ||
                        status === "skipped"
                      }
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        isCurrent
                          ? "bg-green-50 ring-1 ring-green-300"
                          : status === "completed"
                            ? "opacity-60"
                            : status === "skipped"
                              ? "opacity-40"
                              : "hover:bg-gray-50",
                        !isLive && "cursor-default"
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
                        {item.duration_minutes && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.duration_minutes} min
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {dayItems.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No agenda items for Day {activeDay}
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
              disabled={isPending}
              onClick={confirmDialog.action}
            >
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

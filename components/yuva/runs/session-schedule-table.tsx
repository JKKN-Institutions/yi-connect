"use client";

/**
 * Session scheduling table (Phase 7): per session set date+time, venue
 * (defaults to the academy), facilitator/mentor from the chapter's Mentor
 * YUVA Network ("To be announced" allowed), and Additional Remarks.
 *
 * Warnings are NON-BLOCKING (spec): out-of-range vs the chapter-entered run
 * dates, mentor double-booked at the same datetime, and overlapping sessions
 * at the same venue+datetime are computed client-side as badges; the server
 * re-checks on save and returns its own warnings (cross-run double-booking).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  assignSessionMentor,
  markSessionCompleted,
  scheduleSession,
} from "@/app/youth-academy/actions/runs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TBA = "__tba__"; // Select can't carry an empty value — sentinel for null

export type ScheduleSessionRow = {
  id: string;
  seq: number;
  name: string;
  duration_minutes: number;
  learning_objective: string | null;
  expects_submission: boolean;
  scheduled_at: string | null;
  venue: string | null;
  remarks: string | null;
  mentor_person_id: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

export type MentorChoice = { personId: string; name: string };

type Draft = {
  scheduledAt: string; // datetime-local input value ("" = unset)
  venue: string;
  mentorId: string; // TBA sentinel = "to be announced"
  remarks: string;
};

/** ISO timestamp → value for an <input type="datetime-local"> (local time). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WarningBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
      title={label}
    >
      <AlertTriangle className="size-3 shrink-0" />
      {label}
    </span>
  );
}

export function SessionScheduleTable({
  sessions,
  mentors,
  runStartDate,
  runEndDate,
  defaultVenue,
  readOnly = false,
}: {
  sessions: ScheduleSessionRow[];
  /** The run's chapter Mentor YUVA Network roster. */
  mentors: MentorChoice[];
  /** Chapter-entered run dates (YYYY-MM-DD) — out-of-range warning source. */
  runStartDate: string | null;
  runEndDate: string | null;
  /** Venue default — the academy (spec). */
  defaultVenue: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      sessions.map((s) => [
        s.id,
        {
          scheduledAt: isoToLocalInput(s.scheduled_at),
          venue: s.venue ?? defaultVenue,
          mentorId: s.mentor_person_id ?? TBA,
          remarks: s.remarks ?? "",
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(
    null
  );

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // Client-side, non-blocking warnings per row (server re-checks on save).
  const warningsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    const start = runStartDate ? runStartDate.slice(0, 10) : null;
    const end = runEndDate ? runEndDate.slice(0, 10) : null;

    for (const session of sessions) {
      const draft = drafts[session.id];
      if (!draft) continue;
      const rowWarnings: string[] = [];
      const at = draft.scheduledAt;

      if (at && start && end) {
        const day = at.slice(0, 10);
        if (day < start || day > end) {
          rowWarnings.push("Outside run dates");
        }
      }

      if (at) {
        for (const other of sessions) {
          if (other.id === session.id) continue;
          const otherDraft = drafts[other.id];
          if (!otherDraft?.scheduledAt || otherDraft.scheduledAt !== at) {
            continue;
          }
          if (
            draft.mentorId !== TBA &&
            otherDraft.mentorId === draft.mentorId
          ) {
            rowWarnings.push("Mentor double-booked");
          }
          const venueA = draft.venue.trim().toLowerCase();
          const venueB = otherDraft.venue.trim().toLowerCase();
          if (venueA && venueA === venueB) {
            rowWarnings.push("Venue overlap");
          }
        }
      }

      map.set(session.id, [...new Set(rowWarnings)]);
    }
    return map;
  }, [sessions, drafts, runStartDate, runEndDate]);

  async function handleSave(session: ScheduleSessionRow) {
    const draft = drafts[session.id];
    if (!draft.scheduledAt) {
      toast.error("Pick a date & time for this session first.");
      return;
    }
    setSavingId(session.id);
    try {
      const scheduleResult = await scheduleSession({
        sessionId: session.id,
        scheduledAt: new Date(draft.scheduledAt).toISOString(),
        venue: draft.venue.trim() || null,
        remarks: draft.remarks.trim() || null,
      });
      if (!scheduleResult.success) {
        toast.error(scheduleResult.error);
        return;
      }

      const newMentorId = draft.mentorId === TBA ? null : draft.mentorId;
      let mentorWarning: string | undefined;
      if (newMentorId !== session.mentor_person_id) {
        const mentorResult = await assignSessionMentor({
          sessionId: session.id,
          mentorPersonId: newMentorId,
        });
        if (!mentorResult.success) {
          toast.error(mentorResult.error);
          return;
        }
        mentorWarning = mentorResult.warning;
      }

      const warning = [scheduleResult.warning, mentorWarning]
        .filter(Boolean)
        .join(" ");
      if (warning) {
        toast(warning, { icon: "⚠️", duration: 6000 });
      } else {
        toast.success(`Session ${session.seq} saved`);
      }
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleComplete(sessionId: string) {
    setCompletingId(sessionId);
    try {
      const result = await markSessionCompleted({ sessionId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Session marked completed");
      router.refresh();
    } finally {
      setCompletingId(null);
    }
  }

  const confirmTarget = sessions.find((s) => s.id === confirmCompleteId);

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const draft = drafts[session.id];
        const rowWarnings = warningsByRow.get(session.id) ?? [];
        const editable = !readOnly && session.status === "scheduled";

        return (
          <div
            key={session.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {session.seq}
                  </span>
                  {session.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {session.duration_minutes} min
                    {session.expects_submission ? " · expects work" : ""}
                  </span>
                </p>
                {session.learning_objective && (
                  <p className="mt-1 text-xs text-slate-500">
                    {session.learning_objective}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {session.status === "completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    <CheckCircle2 className="size-3" />
                    Completed
                  </span>
                ) : session.status === "cancelled" ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                    Cancelled
                  </span>
                ) : (
                  rowWarnings.map((w) => <WarningBadge key={w} label={w} />)
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-600">
                  Date &amp; time
                </label>
                <Input
                  type="datetime-local"
                  value={draft.scheduledAt}
                  onChange={(e) =>
                    setDraft(session.id, { scheduledAt: e.target.value })
                  }
                  disabled={!editable}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-600">
                  Venue
                </label>
                <Input
                  value={draft.venue}
                  onChange={(e) =>
                    setDraft(session.id, { venue: e.target.value })
                  }
                  placeholder={defaultVenue}
                  disabled={!editable}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-600">
                  Facilitator / mentor
                </label>
                <Select
                  value={draft.mentorId}
                  onValueChange={(value) =>
                    setDraft(session.id, { mentorId: value })
                  }
                  disabled={!editable}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="To be announced" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TBA}>To be announced</SelectItem>
                    {mentors.map((m) => (
                      <SelectItem key={m.personId} value={m.personId}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-600">
                  Additional Remarks
                </label>
                <Input
                  value={draft.remarks}
                  onChange={(e) =>
                    setDraft(session.id, { remarks: e.target.value })
                  }
                  placeholder="e.g. bring laptops"
                  disabled={!editable}
                />
              </div>
            </div>

            {editable && (
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmCompleteId(session.id)}
                  disabled={
                    completingId === session.id || !session.scheduled_at
                  }
                >
                  {completingId === session.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Mark completed
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(session)}
                  disabled={savingId === session.id}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {savingId === session.id && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Save session
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <AlertDialog
        open={confirmCompleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCompleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark session as completed?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget
                ? `"${confirmTarget.name}" will be counted as a delivered session in the national metrics. Its schedule can no longer be edited afterwards.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmCompleteId;
                setConfirmCompleteId(null);
                if (id) void handleComplete(id);
              }}
            >
              Mark completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

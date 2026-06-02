"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { ScoreForm } from "@/components/yip/scoring/score-form";
import {
  getCurrentSpeaker,
  getRubricForRole,
  getScoreForParticipant,
  getSessionScoringParams,
  getScoreableParticipants,
  submitScore,
  type CurrentSpeakerInfo,
} from "@/app/yip/actions/scoring";
import {
  getSessionsForJury,
  type ScoreableSession,
} from "@/app/yip/actions/jury-sessions";
import {
  getScoringFlagsConfig,
  type FlagDeltas,
  type FlagKey,
} from "@/app/yip/actions/scoring-flags";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import {
  Loader2,
  Mic,
  Users,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useOfflineSync } from "@/lib/yip/hooks/use-offline-sync";
import { OfflineSyncBadge } from "@/components/yip/scoring/offline-sync-badge";
import type { RubricCriterionShape } from "@/lib/yip/rubric";

// ─── Types ────────────────────────────────────────────────────────

// Accepts both flat and nested criteria (handbook p.20 MP rubric nests 17
// sub-criteria under 5 parents). ScoreForm reads `sub_criteria` when present.
type Criterion = RubricCriterionShape;

interface RubricData {
  id: string;
  criteria: Criterion[];
  total_max: number;
}

interface ExistingScoreData {
  id: string;
  criteria_scores: Record<string, number>;
  total_score: number;
  comments: string | null;
  status: string | null;
}

// Special Remarks (Phase 18 / F4) — checkbox state for the active participant.
type FlagsState = Record<FlagKey, boolean>;

const EMPTY_FLAGS: FlagsState = {
  no_confidence_brought: false,
  walkout: false,
  ruckus: false,
  suspension: false,
};

const FLAG_LABELS: Record<FlagKey, string> = {
  no_confidence_brought: "No Confidence Motion Brought",
  walkout: "Walkout",
  ruckus: "Ruckus",
  suspension: "Suspension",
};

const FLAG_ORDER: FlagKey[] = [
  "no_confidence_brought",
  "walkout",
  "ruckus",
  "suspension",
];

function formatDelta(d: number): string {
  return d >= 0 ? `+${d}` : `${d}`;
}

type Participant = {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  school_name: string;
  ministry?: string | null;
  constituency_name?: string | null;
  serial_no?: number | null;
};

interface Props {
  juryAssignmentId: string;
  juryName: string;
  eventId: string;
  initialEventLocked?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

export function JuryScoringClient({
  juryAssignmentId: juryAssignmentIdProp,
  ...rest
}: Props) {
  const juryAssignmentId = juryAssignmentIdProp;
  const syncState = useOfflineSync(juryAssignmentId);

  return (
    <>
      <OfflineSyncBadge state={syncState} />
      <JuryScoringClientInner
        juryAssignmentId={juryAssignmentId}
        {...rest}
      />
    </>
  );
}

function JuryScoringClientInner({
  juryAssignmentId,
  juryName,
  eventId,
  initialEventLocked,
}: Props) {
  const supabase = createClient();

  const [currentSpeaker, setCurrentSpeaker] =
    useState<CurrentSpeakerInfo | null>(null);
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [existingScore, setExistingScore] =
    useState<ExistingScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreKey, setScoreKey] = useState(0); // Force re-render on speaker change
  const [eventLocked, setEventLocked] = useState<boolean>(
    initialEventLocked ?? false
  );

  // Per-session scoring (BUG-385): a juror scores within a session they're
  // assigned to. selectedSessionId is the agenda_item_id used for every score op.
  const [assignedSessions, setAssignedSessions] = useState<ScoreableSession[]>(
    []
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Manual participant picker state
  const [showPicker, setShowPicker] = useState(false);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [manualParticipant, setManualParticipant] =
    useState<Participant | null>(null);
  const [loadingPicker, setLoadingPicker] = useState(false);
  // Jury lookup by participant number / constituency / name (Mizoram req)
  const [pickerSearch, setPickerSearch] = useState("");

  // Special Remarks (Phase 18 / F4) — flag checkboxes + delta config
  const [flagDeltas, setFlagDeltas] = useState<FlagDeltas | null>(null);
  const [flags, setFlags] = useState<FlagsState>(EMPTY_FLAGS);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // The active participant is either the current speaker or a manually selected one
  const activeParticipant =
    manualParticipant ?? currentSpeaker?.participant ?? null;

  // Net of the currently-ticked Special Remarks deltas. Passed to ScoreForm so
  // jurors see their flags reflected in a "with remarks" projected line — the
  // deltas still apply at results time (not stored in the criteria total).
  const netFlagDelta = FLAG_ORDER.reduce(
    (sum, k) => sum + (flags[k] ? flagDeltas?.[k] ?? 0 : 0),
    0
  );

  // ─── Fetch speaker data ─────────────────────────────────────────

  const loadRubricAndScore = useCallback(
    async (participant: Participant) => {
      const role = participant.parliament_role ?? "mp";

      const [rubricResult, scoreResult, sessionParams] = await Promise.all([
        getRubricForRole(role),
        getScoreForParticipant(
          juryAssignmentId,
          participant.id,
          eventId,
          selectedSessionId
        ),
        selectedSessionId
          ? getSessionScoringParams(selectedSessionId)
          : Promise.resolve(null),
      ]);

      if (rubricResult.success) {
        const r = rubricResult.data;
        // Per-session scoring: prefer the SESSION's configured parameters; the
        // role rubric supplies the rubric_id (FK) + the fallback criteria when
        // the session has no configured parameters.
        setRubric({
          id: r.id,
          criteria: (sessionParams?.criteria ??
            r.criteria) as unknown as Criterion[],
          total_max: sessionParams?.total_max ?? r.total_max,
        });
      } else {
        setRubric(null);
      }

      if (scoreResult) {
        setExistingScore({
          id: scoreResult.id,
          criteria_scores:
            scoreResult.criteria_scores as unknown as Record<string, number>,
          total_score: scoreResult.total_score,
          comments: scoreResult.comments,
          status: scoreResult.status,
        });
      } else {
        setExistingScore(null);
      }

      setScoreKey((k) => k + 1);
    },
    [juryAssignmentId, eventId, selectedSessionId]
  );

  const loadCurrentSpeaker = useCallback(async () => {
    const result = await getCurrentSpeaker(eventId);
    if (result.success) {
      setCurrentSpeaker(result.data);
      // If no manual override, load rubric for current speaker
      if (!manualParticipant && result.data?.participant) {
        await loadRubricAndScore(result.data.participant);
      } else if (!manualParticipant && !result.data) {
        setRubric(null);
        setExistingScore(null);
      }
    }
    setLoading(false);
  }, [eventId, manualParticipant, loadRubricAndScore]);

  // Fetch + track scores_locked on the event row (realtime aware).
  const loadEventLock = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("scores_locked")
      .eq("id", eventId)
      .single();
    setEventLocked(Boolean(data?.scores_locked));
  }, [eventId, supabase]);

  // ─── Load initial data ──────────────────────────────────────────

  useEffect(() => {
    loadCurrentSpeaker();
    loadEventLock();
  }, [loadCurrentSpeaker, loadEventLock]);

  // Load this juror's assigned sessions; default the selection to the live
  // session if it's one of theirs, otherwise the first assigned session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessions = await getSessionsForJury(juryAssignmentId, eventId);
      if (cancelled) return;
      setAssignedSessions(sessions);
      setSelectedSessionId((prev) =>
        prev && sessions.some((s) => s.id === prev)
          ? prev
          : sessions[0]?.id ?? null
      );
      setSessionsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [juryAssignmentId, eventId]);

  // When the selected session changes, reload the active participant's score for
  // that session so the form reflects the right existing values.
  useEffect(() => {
    if (!activeParticipant || !selectedSessionId) return;
    void loadRubricAndScore(activeParticipant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  // Load Special-Remarks delta config once. Falls back to the migration's
  // seeded defaults if the row is missing or the call fails.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getScoringFlagsConfig();
      if (cancelled) return;
      setFlagDeltas(
        res.success
          ? res.data.deltas
          : {
              no_confidence_brought: 3,
              walkout: -5,
              ruckus: -3,
              suspension: -10,
            }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate flag checkboxes whenever the active participant changes.
  // We pull straight from the scores row via a typed cast — the columns
  // were added in migration 20260527200000 and exist in the generated
  // Database type already.
  useEffect(() => {
    if (!activeParticipant) {
      setFlags(EMPTY_FLAGS);
      return;
    }
    let cancelled = false;
    (async () => {
      const fresh = await getScoreForParticipant(
        juryAssignmentId,
        activeParticipant.id,
        eventId,
        selectedSessionId
      );
      if (cancelled) return;
      if (!fresh) {
        setFlags(EMPTY_FLAGS);
        return;
      }
      const row = fresh as unknown as {
        flag_no_confidence_brought?: boolean | null;
        flag_walkout?: boolean | null;
        flag_ruckus?: boolean | null;
        flag_suspension?: boolean | null;
      };
      setFlags({
        no_confidence_brought: Boolean(row.flag_no_confidence_brought),
        walkout: Boolean(row.flag_walkout),
        ruckus: Boolean(row.flag_ruckus),
        suspension: Boolean(row.flag_suspension),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeParticipant, juryAssignmentId, eventId, selectedSessionId]);

  // ─── Realtime: watch events table for current_agenda_item_id ────

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`yip:jury-event:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "yip",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          // Apply lock change immediately from the payload (no extra fetch).
          if (payload.new) {
            const next = (payload.new as { scores_locked?: boolean | null })
              .scores_locked;
            setEventLocked(Boolean(next));
          }
          // Speaker / agenda / timer state may have changed -- reload speaker.
          loadCurrentSpeaker();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "yip",
          table: "agenda_speakers",
        },
        (payload) => {
          // A speaker status changed -- reload if relevant
          if (
            payload.new &&
            (payload.new as Record<string, unknown>).status === "speaking"
          ) {
            loadCurrentSpeaker();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ─── Load all participants for manual picker ────────────────────

  const loadAllParticipants = async () => {
    if (allParticipants.length > 0) {
      if (showPicker) setPickerSearch(""); // clear search when closing the picker
      setShowPicker(!showPicker);
      return;
    }
    setLoadingPicker(true);
    const data = await getScoreableParticipants(eventId);
    setAllParticipants(data);
    setShowPicker(true);
    setLoadingPicker(false);
  };

  const selectManualParticipant = async (p: Participant) => {
    setManualParticipant(p);
    setShowPicker(false);
    setPickerSearch(""); // clear search after picking a participant
    setLoading(true);
    await loadRubricAndScore(p);
    setLoading(false);
  };

  const clearManualSelection = () => {
    setManualParticipant(null);
    if (currentSpeaker?.participant) {
      setLoading(true);
      loadRubricAndScore(currentSpeaker.participant).then(() =>
        setLoading(false)
      );
    } else {
      setRubric(null);
      setExistingScore(null);
      setScoreKey((k) => k + 1);
    }
  };

  // ─── Submit handler ─────────────────────────────────────────────

  const handleSubmit = async (data: {
    criteriaScores: Record<string, number>;
    totalScore: number;
    comments: string;
    status: "draft" | "submitted";
  }) => {
    if (!activeParticipant || !rubric) {
      return { success: false as const, error: "No participant or rubric loaded" };
    }

    // Block in-flight submits the moment scores get locked.
    if (eventLocked) {
      return {
        success: false as const,
        error: "Scoring has been locked by the organizer.",
      };
    }

    // Per-session: a score must belong to the session the juror is scoring.
    if (!selectedSessionId) {
      return {
        success: false as const,
        error: "Select the session you're scoring first.",
      };
    }

    const result = await submitScore({
      juryAssignmentId,
      participantId: activeParticipant.id,
      eventId,
      rubricId: rubric.id,
      agendaItemId: selectedSessionId,
      criteriaScores: data.criteriaScores,
      totalScore: data.totalScore,
      comments: data.comments,
      status: data.status,
      flags,
    });

    if (result.success) {
      // Refresh the existing score after saving
      const fresh = await getScoreForParticipant(
        juryAssignmentId,
        activeParticipant.id,
        eventId,
        selectedSessionId
      );
      if (fresh) {
        setExistingScore({
          id: fresh.id,
          criteria_scores:
            fresh.criteria_scores as unknown as Record<string, number>,
          total_score: fresh.total_score,
          comments: fresh.comments,
          status: fresh.status,
        });
      }
    }

    return result.success
      ? { success: true as const }
      : { success: false as const, error: result.error };
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Loading scoring data...</p>
      </div>
    );
  }

  // Suppress unused variable warning — juryName is passed for future use
  void juryName;

  // Formal per-session panels: a juror with no assigned sessions has nothing to
  // score. Show a clear message rather than an empty scoring form.
  if (sessionsLoaded && assignedSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="size-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <AlertTriangle className="size-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">No sessions assigned</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          You haven&apos;t been assigned to any sessions yet. Ask the organizer to
          add you to the sessions you&apos;ll be judging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {eventLocked && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Lock className="size-4 shrink-0" />
            <span className="font-semibold">Scoring locked</span>
          </div>
          <p className="text-xs text-amber-700 mt-1">
            The organizer has locked scoring. New submissions are blocked until
            it is unlocked.
          </p>
        </div>
      )}


      {/* Session selector — only the sessions this juror is assigned to.
          The selected session is the agenda_item every score is filed under. */}
      {assignedSessions.length > 0 && (
        <div className="mx-4 mt-4">
          <label
            htmlFor="session-select"
            className="block text-xs font-semibold text-gray-600 mb-1"
          >
            Scoring session
          </label>
          <select
            id="session-select"
            value={selectedSessionId ?? ""}
            onChange={(e) => setSelectedSessionId(e.target.value || null)}
            className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none"
            style={{ minHeight: "48px" }}
          >
            {assignedSessions.map((s) => (
              <option key={s.id} value={s.id}>
                Day {s.day} · {s.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current agenda context */}
      {currentSpeaker && !manualParticipant && (
        <div className="rounded-xl bg-[#FF9933]/10 border border-[#FF9933]/30 px-4 py-3 mx-4 mt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#994d00]">
            <Mic className="size-4 shrink-0" />
            <span>Now Speaking</span>
          </div>
          <p className="text-xs text-[#994d00]/80 mt-0.5 truncate">
            {currentSpeaker.agendaItemTitle}
          </p>
        </div>
      )}

      {/* Manual participant override */}
      {manualParticipant && (
        <div className="rounded-xl bg-[#1a1a3e]/5 border border-[#1a1a3e]/20 px-4 py-3 mx-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1a3e]">
              <Users className="size-4 shrink-0" />
              <span>Manual Selection</span>
            </div>
            <button
              onClick={clearManualSelection}
              className="text-xs font-semibold text-[#1a1a3e] hover:underline underline-offset-2 active:opacity-70 touch-manipulation"
              style={{ minHeight: "44px", minWidth: "80px" }}
            >
              Back to live
            </button>
          </div>
        </div>
      )}

      {/* Special Remarks (Phase 18 / F4) — visible whenever a participant
          is loaded. Deltas come from yip.scoring_flags_config and are
          applied at result-computation time, not added to the live total. */}
      {activeParticipant && rubric && (
        <div className="mx-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Special Remarks</span>
          </div>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Tick only if observed. Applied at results time.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {FLAG_ORDER.map((k) => {
              const delta = flagDeltas?.[k];
              const checked = flags[k];
              return (
                <label
                  key={k}
                  className={`flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 touch-manipulation cursor-pointer transition-colors
                    ${
                      checked
                        ? "border-amber-400 ring-1 ring-amber-300"
                        : "border-gray-200 hover:bg-gray-50"
                    }
                    ${eventLocked ? "opacity-60 cursor-not-allowed" : ""}
                  `}
                  style={{ minHeight: "48px" }}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      checked={checked}
                      disabled={eventLocked}
                      onChange={(e) =>
                        setFlags((prev) => ({
                          ...prev,
                          [k]: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {FLAG_LABELS[k]}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      delta === undefined
                        ? "text-gray-400"
                        : delta >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                    }`}
                  >
                    {delta === undefined ? "…" : formatDelta(delta)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Score form -- show when we have an active participant + rubric */}
      {activeParticipant && rubric ? (
        <ScoreForm
          key={`${activeParticipant.id}-${scoreKey}`}
          participant={activeParticipant}
          criteria={rubric.criteria}
          rubricId={rubric.id}
          eventId={eventId}
          agendaItemId={selectedSessionId}
          juryAssignmentId={juryAssignmentId}
          existingScore={existingScore}
          specialRemarksDelta={netFlagDelta}
          onSubmit={handleSubmit}
        />
      ) : (
        /* Waiting state -- no current speaker */
        <div className="flex flex-col items-center justify-center py-16 text-center px-4 landscape-compact">
          <div className="size-20 rounded-full bg-[#FF9933]/10 flex items-center justify-center mb-4 landscape-hide">
            <Mic className="size-10 text-[#FF9933]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Waiting for next speaker...
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xs landscape-hide">
            The score form will appear automatically when the moderator starts
            the next speaker.
          </p>
        </div>
      )}

      {/* Manual participant picker toggle */}
      <div className="border-t border-gray-200 pt-4 px-4 pb-4">
        <button
          type="button"
          onClick={loadAllParticipants}
          disabled={loadingPicker}
          aria-expanded={showPicker}
          aria-controls="participant-picker-list"
          className="flex w-full items-center justify-between rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
          style={{ minHeight: "52px" }}
        >
          <span className="flex items-center gap-2">
            {loadingPicker ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Users className="size-5" />
            )}
            Score a specific participant
          </span>
          {showPicker ? (
            <ChevronUp className="size-5" />
          ) : (
            <ChevronDown className="size-5" />
          )}
        </button>

        {showPicker && allParticipants.length > 0 && (() => {
          const q = pickerSearch.trim().toLowerCase();
          const list = q
            ? allParticipants.filter(
                (p) =>
                  p.full_name.toLowerCase().includes(q) ||
                  (p.serial_no != null && String(p.serial_no).includes(q)) ||
                  (p.constituency_name?.toLowerCase().includes(q) ?? false)
              )
            : allParticipants;
          return (
            <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
              <div className="border-b border-gray-100 p-2">
                <input
                  type="text"
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search by number, constituency, or name"
                  aria-label="Search participants by number, constituency, or name"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div
                id="participant-picker-list"
                className="max-h-72 overflow-y-auto divide-y divide-gray-100"
              >
                {list.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">
                    No participant matches that search.
                  </p>
                ) : (
                  list.map((p) => {
                    const roleLabel = p.parliament_role
                      ? ROLE_LABELS[p.parliament_role] ?? p.parliament_role
                      : "";
                    const roleColor = p.parliament_role
                      ? ROLE_COLORS[p.parliament_role] ?? "bg-gray-500 text-white"
                      : "bg-gray-500 text-white";
                    const partyColor = p.party_side
                      ? PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]
                      : null;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectManualParticipant(p)}
                        className={`w-full text-left px-4 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation
                          ${manualParticipant?.id === p.id ? "bg-blue-50" : ""}
                        `}
                        style={{ minHeight: "52px" }}
                      >
                        <div className="flex items-center justify-between gap-2 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {p.serial_no != null && (
                                <span className="tabular-nums text-gray-400">
                                  #{p.serial_no}
                                  {" · "}
                                </span>
                              )}
                              {p.full_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {p.constituency_name
                                ? `${p.constituency_name} · ${p.school_name}`
                                : p.school_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {partyColor && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${partyColor.badge}`}
                              >
                                {p.party_side === "ruling" ? "R" : "O"}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${roleColor}`}
                            >
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { ScoreForm } from "@/components/yip/scoring/score-form";
import {
  getCurrentSpeaker,
  getRubricForRole,
  getScoreForParticipant,
  getScoreOccurrences,
  getSessionScoringParams,
  getScoreableParticipants,
  submitScore,
  type CurrentSpeakerInfo,
} from "@/app/yip/actions/scoring";
import {
  getJuryScreenBootstrap,
  type JuryScreenBootstrap,
} from "@/app/yip/actions/jury";
import { type ScoreableSession } from "@/app/yip/actions/jury-sessions";
import {
  type FlagDeltas,
  type FlagKey,
} from "@/app/yip/actions/scoring-flags";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { juryLabel } from "@/lib/yip/pii";
import {
  Loader2,
  Mic,
  Users,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useOfflineSync } from "@/lib/yip/hooks/use-offline-sync";
import { OfflineSyncBadge } from "@/components/yip/scoring/offline-sync-badge";
import {
  readOfflineCache,
  patchOfflineCache,
} from "@/lib/yip/offline-cache";
import type { RubricCriterionShape } from "@/lib/yip/rubric";

// ─── Types ────────────────────────────────────────────────────────

// Accepts both flat and nested criteria (handbook p.20 MP rubric nests 17
// sub-criteria under 5 parents). ScoreForm reads `sub_criteria` when present.
// `kind` is set only on the per-session-params path (evaluation vs participation);
// the role-rubric fallback leaves it undefined and ScoreForm renders ungrouped.
type Criterion = RubricCriterionShape & {
  kind?: "evaluation" | "participation";
};

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
  party_number?: number | null;
  // No school_name — jurors must never receive it (school-blind scoring).
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
  // #4 within-session averaging: the turns this juror has recorded for the
  // current (participant, session), and whether the form is currently capturing
  // a NEW turn (blank form → submit creates the next occurrence).
  const [occurrences, setOccurrences] = useState<
    { id: string; occurrence: number; total_score: number; status: string | null }[]
  >([]);
  const [addingTurn, setAddingTurn] = useState(false);
  // The active session is scored ONCE per juror and locked on submit (e.g. the
  // 90-second Constituency Speech) — hide the "Score another turn" control.
  const [sessionLocksOnSubmit, setSessionLocksOnSubmit] = useState(false);
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

  // BUG-393: the live agenda item maps to a "current session"; the juror may
  // score the current session + the immediately-previous one only (catch-up).
  // The organiser drives this — jurors no longer pick the session manually.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectableSessionIds, setSelectableSessionIds] = useState<string[]>(
    []
  );
  // BUG-393 follow-up: jurors are locked to {current, immediately-previous} by
  // default. This opt-in flag reveals ALL assigned sessions so a juror can
  // score an earlier one. UI-only unlock — submitScore already permits any
  // assigned session (it only checks assignment, not the live position). The
  // ref mirrors the flag so the realtime auto-switch can read it without being
  // re-created on every toggle.
  const [showAllSessions, setShowAllSessions] = useState(false);
  const showAllSessionsRef = useRef(false);
  // Organiser-controlled (per event): when false the "score an earlier session"
  // option is hidden and jurors stay locked to the restricted set.
  const [allowEarlierSessions, setAllowEarlierSessions] = useState(false);
  // Track the live agenda item so a realtime update can detect a genuine
  // house-advance and auto-switch the juror to the new session.
  const currentAgendaItemRef = useRef<string | null>(null);

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

  // Jurors score BLIND, against the participant's number — never the name —
  // for fairness. The id is untouched so scoring, buffering and lookups still
  // key on the real participant.
  const activeParticipantRaw =
    manualParticipant ?? currentSpeaker?.participant ?? null;
  const activeParticipant = activeParticipantRaw
    ? {
        ...activeParticipantRaw,
        full_name: juryLabel(
          activeParticipantRaw.serial_no,
          activeParticipantRaw.id
        ),
      }
    : null;

  // ─── Fetch speaker data ─────────────────────────────────────────

  const loadRubricAndScore = useCallback(
    async (participant: Participant) => {
      const role = participant.parliament_role ?? "mp";

      try {
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
        setSessionLocksOnSubmit(sessionParams?.lock_on_submit === true);

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

        // #4: load this juror's turns for the participant+session. A fresh load
        // always lands on the existing turns view (never mid "add a turn").
        setAddingTurn(false);
        if (selectedSessionId) {
          try {
            setOccurrences(
              await getScoreOccurrences(
                juryAssignmentId,
                participant.id,
                eventId,
                selectedSessionId
              )
            );
          } catch {
            setOccurrences([]);
          }
        } else {
          setOccurrences([]);
        }
      } catch {
        // OFFLINE FALLBACK (2026-06-04): the server is unreachable — resolve the
        // rubric + session params from the prefetched cache so the juror can
        // keep moving between participants without internet. The existing score
        // can't be known offline; ScoreForm rehydrates this session's values
        // from the local buffer instead.
        const cache = readOfflineCache(eventId, juryAssignmentId);
        const cachedRubric = cache?.rubricsByRole?.[role];
        const cachedParams = selectedSessionId
          ? cache?.sessionParams?.[selectedSessionId]
          : null;
        if (cachedRubric) {
          setRubric({
            id: cachedRubric.id,
            criteria: (cachedParams?.criteria ??
              cachedRubric.criteria) as unknown as Criterion[],
            total_max: cachedParams?.total_max ?? cachedRubric.total_max,
          });
        } else {
          // Never prefetched on this phone — we can't render a safe scoresheet.
          setRubric(null);
        }
        setExistingScore(null);
        // Turns can't be read offline; keep the single-score flow (occurrence 1).
        setOccurrences([]);
        setAddingTurn(false);
        // Offline keeps occurrences empty, so the turns strip is hidden anyway.
        setSessionLocksOnSubmit(false);
      }

      setScoreKey((k) => k + 1);
    },
    [juryAssignmentId, eventId, selectedSessionId]
  );

  const loadCurrentSpeaker = useCallback(async () => {
    try {
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
    } catch {
      // Offline at load — no live speaker to follow; the juror scores via the
      // manual picker (served from the offline cache). Without this catch the
      // throw skips setLoading(false) and the page spins forever.
      setCurrentSpeaker(null);
    }
    setLoading(false);
  }, [eventId, manualParticipant, loadRubricAndScore]);

  // ─── Load initial data — ONE bootstrap round-trip (BUG-392) ──────
  //
  // Previously the screen fired ~7 server actions on load plus two fan-out
  // loops (getRubricForRole per distinct role ~8-10, getSessionScoringParams
  // per session ~11). Next.js serializes server actions, so that was ~25-30
  // sequential client round-trips. getJuryScreenBootstrap returns all of it in
  // ONE call (the fan-outs run in parallel on the server) and seeds the offline
  // cache that every per-participant read below falls back to.
  const applyBootstrap = useCallback(
    (b: JuryScreenBootstrap) => {
      setEventLocked(b.scoresLocked);
      setCurrentSpeaker(b.currentSpeaker);
      setFlagDeltas(b.flagDeltas);
      setAssignedSessions(b.sessions);
      setAllParticipants((prev) => (prev.length > 0 ? prev : b.roster));
      setCurrentSessionId(b.currentSessionId);
      setSelectableSessionIds(b.selectableSessionIds);
      setAllowEarlierSessions(b.allowEarlierSessions);
      currentAgendaItemRef.current = b.currentAgendaItemId;

      // Default the juror's session to the live current session (organiser-
      // driven, BUG-393). Keep an existing pick only if it's still selectable.
      setSelectedSessionId((prev) =>
        prev && b.selectableSessionIds.includes(prev)
          ? prev
          : b.currentSessionId ?? b.sessions[0]?.id ?? null
      );
      setSessionsLoaded(true);

      // Seed the offline cache so participant/session switches survive an
      // outage (replaces the old explicit prefetch loop).
      patchOfflineCache(eventId, juryAssignmentId, {
        sessions: b.sessions,
        roster: b.roster,
        rubricsByRole: b.rubricsByRole,
        sessionParams: b.sessionParams,
        flagDeltas: b.flagDeltas,
      });
    },
    [eventId, juryAssignmentId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getJuryScreenBootstrap(juryAssignmentId, eventId);
        if (cancelled) return;
        if (res.success) {
          applyBootstrap(res.data);
        } else {
          // Authorized failure (bad session) — nothing to score.
          setSessionsLoaded(true);
        }
      } catch {
        // Offline at first load — rebuild from the cache of a previous online
        // visit so the juror can still score from the buffer.
        if (cancelled) return;
        const cache = readOfflineCache(eventId, juryAssignmentId);
        const sessions =
          (cache?.sessions as ScoreableSession[] | undefined) ?? [];
        const roster = (cache?.roster as Participant[] | undefined) ?? [];
        setAssignedSessions(sessions);
        setAllParticipants((prev) => (prev.length > 0 ? prev : roster));
        setFlagDeltas(
          (cache?.flagDeltas as FlagDeltas | undefined) ?? {
            no_confidence_brought: 3,
            walkout: -5,
            ruckus: -3,
            suspension: -10,
          }
        );
        // Without a live agenda item offline, allow scoring any assigned
        // session and default to the first.
        setCurrentSessionId(sessions[0]?.id ?? null);
        setSelectableSessionIds(sessions.map((s) => s.id));
        setSelectedSessionId((prev) =>
          prev && sessions.some((s) => s.id === prev)
            ? prev
            : sessions[0]?.id ?? null
        );
        setSessionsLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // applyBootstrap is stable via useCallback over (eventId, juryAssignmentId).
  }, [juryAssignmentId, eventId, applyBootstrap]);

  // ─── Realtime auto-switch (BUG-393) ─────────────────────────────
  // When the organiser advances the house, re-derive the live state in one
  // round-trip and auto-switch the juror to the NEW current session. Any
  // in-flight score for the previous session is preserved by the ScoreForm
  // flush-on-unmount (the form remounts when scoreKey bumps), so we never
  // silently discard unsaved input. A juror who manually picked the (still-
  // selectable) previous session keeps their pick.
  const refreshLiveState = useCallback(async () => {
    let b: JuryScreenBootstrap;
    try {
      const res = await getJuryScreenBootstrap(juryAssignmentId, eventId);
      if (!res.success) return;
      b = res.data;
    } catch {
      // Offline — keep the current view; the cache still backs scoring.
      return;
    }

    const advanced = b.currentAgendaItemId !== currentAgendaItemRef.current;

    setEventLocked(b.scoresLocked);
    setCurrentSpeaker(b.currentSpeaker);
    setFlagDeltas(b.flagDeltas);
    setAssignedSessions(b.sessions);
    setAllParticipants((prev) => (prev.length > 0 ? prev : b.roster));
    setCurrentSessionId(b.currentSessionId);
    setSelectableSessionIds(b.selectableSessionIds);
    setAllowEarlierSessions(b.allowEarlierSessions);
    // Organiser disabled the unlock mid-session → snap jurors back to the
    // restricted set.
    if (!b.allowEarlierSessions && showAllSessionsRef.current) {
      showAllSessionsRef.current = false;
      setShowAllSessions(false);
    }
    currentAgendaItemRef.current = b.currentAgendaItemId;
    patchOfflineCache(eventId, juryAssignmentId, {
      sessions: b.sessions,
      roster: b.roster,
      rubricsByRole: b.rubricsByRole,
      sessionParams: b.sessionParams,
      flagDeltas: b.flagDeltas,
    });

    setSelectedSessionId((prev) => {
      // The juror explicitly unlocked all sessions to catch up on an earlier
      // one — never override their manual pick (BUG-393 follow-up).
      if (showAllSessionsRef.current) return prev;
      // House advanced → jump to the new current session (organiser-driven).
      if (advanced) return b.currentSessionId ?? prev;
      // No advance → keep the juror's pick if it's still selectable.
      return prev && b.selectableSessionIds.includes(prev)
        ? prev
        : b.currentSessionId ?? b.sessions[0]?.id ?? prev;
    });
  }, [eventId, juryAssignmentId]);

  // When the selected session changes (incl. the initial null → current-session
  // transition from the bootstrap), reload the active participant's score for
  // that session so the form reflects the right existing values + rubric.
  useEffect(() => {
    if (!activeParticipant || !selectedSessionId) return;
    void loadRubricAndScore(activeParticipant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

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
      let fresh: Awaited<ReturnType<typeof getScoreForParticipant>> = null;
      try {
        fresh = await getScoreForParticipant(
          juryAssignmentId,
          activeParticipant.id,
          eventId,
          selectedSessionId
        );
      } catch {
        // Offline — no server copy to hydrate from; start with clean flags
        // (any flags the juror sets are preserved in the local buffer).
        fresh = null;
      }
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
  // Latest-callback refs so the (stable, [eventId]-keyed) channel always
  // invokes the freshest handlers without re-subscribing on every render.
  const refreshLiveStateRef = useRef(refreshLiveState);
  refreshLiveStateRef.current = refreshLiveState;
  const loadCurrentSpeakerRef = useRef(loadCurrentSpeaker);
  loadCurrentSpeakerRef.current = loadCurrentSpeaker;

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
          // The organiser may have advanced the house — re-derive the live
          // session in one round-trip and auto-switch the juror (BUG-393).
          void refreshLiveStateRef.current();
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
            void loadCurrentSpeakerRef.current();
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
    let data: Participant[] = [];
    try {
      data = await getScoreableParticipants(eventId);
    } catch {
      // Offline — serve the prefetched roster so the picker still works.
      const cache = readOfflineCache(eventId, juryAssignmentId);
      data = (cache?.roster as Participant[] | undefined) ?? [];
    }
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
      // #4: when capturing an extra turn, the server assigns the next occurrence
      // and inserts a fresh row instead of overwriting turn 1.
      newTurn: addingTurn,
    });

    if (result.success) {
      // Refresh the existing score after saving — best-effort; if the network
      // dropped between the save and this read, the save still stands.
      try {
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
      } catch {
        // ignore — display refresh only
      }

      // #4: after saving (an edit or a new turn), refresh the turns strip and
      // leave "add a turn" mode so the form shows the latest saved score.
      setAddingTurn(false);
      if (activeParticipant && selectedSessionId) {
        try {
          setOccurrences(
            await getScoreOccurrences(
              juryAssignmentId,
              activeParticipant.id,
              eventId,
              selectedSessionId
            )
          );
        } catch {
          // ignore — strip refresh only
        }
      }
    }

    return result.success
      ? { success: true as const }
      : { success: false as const, error: result.error };
  };

  // #4: begin capturing a NEW turn for the current participant+session — blank
  // the form (remount via scoreKey) and route the next submit through newTurn.
  const startAnotherTurn = () => {
    setExistingScore(null);
    setAddingTurn(true);
    setScoreKey((k) => k + 1);
  };

  const cancelAnotherTurn = () => {
    setAddingTurn(false);
    if (activeParticipant) void loadRubricAndScore(activeParticipant);
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


      {/* Session selector — organiser-driven (BUG-393). The juror scores the
          CURRENT session by default; the only manual choice is "catch up" on
          the immediately-previous session. Older sessions are locked. When no
          live agenda position is known (offline / event not started) every
          assigned session is selectable as a fallback. */}
      {(() => {
        // Restricted set: the {current, immediately-previous} ids from the
        // bootstrap, mapped back to full session rows (ordered). Falls back to
        // all assigned sessions when the live position is unknown.
        const restricted =
          selectableSessionIds.length > 0
            ? assignedSessions.filter((s) =>
                selectableSessionIds.includes(s.id)
              )
            : assignedSessions;
        // BUG-393 follow-up: "Score an earlier session" reveals every assigned
        // session. Default stays restricted (current + catch-up only).
        const selectable = showAllSessions ? assignedSessions : restricted;
        const lockedCount = assignedSessions.length - restricted.length;
        if (selectable.length === 0) return null;
        return (
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
              {selectable.map((s) => {
                const suffix =
                  s.id === currentSessionId
                    ? " (current)"
                    : restricted.some((r) => r.id === s.id)
                      ? " (catch-up)"
                      : " (earlier)";
                return (
                  <option key={s.id} value={s.id}>
                    Day {s.day} · {s.title}
                    {suffix}
                  </option>
                );
              })}
            </select>
            {lockedCount > 0 &&
              allowEarlierSessions &&
              (showAllSessions ? (
                <button
                  type="button"
                  onClick={() => {
                    showAllSessionsRef.current = false;
                    setShowAllSessions(false);
                    // Snap back to a currently-selectable session so the picker
                    // never shows a blank value.
                    if (!restricted.some((r) => r.id === selectedSessionId)) {
                      setSelectedSessionId(
                        currentSessionId ?? restricted[0]?.id ?? null
                      );
                    }
                  }}
                  className="mt-1.5 text-xs font-medium text-gray-500 underline hover:text-gray-700"
                >
                  Back to current session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    showAllSessionsRef.current = true;
                    setShowAllSessions(true);
                  }}
                  className="mt-1.5 text-xs font-medium text-blue-600 underline hover:text-blue-700"
                >
                  Score an earlier session
                </button>
              ))}
          </div>
        );
      })()}

      {/* Session context blurb (BUG-395) — what this session is about, so the
          juror knows what they're scoring. Sourced from the agenda row. */}
      {(() => {
        const active = assignedSessions.find(
          (s) => s.id === selectedSessionId
        );
        if (!active) return null;
        return (
          <div className="mx-4 mt-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Info className="size-4 shrink-0" />
              <span>{active.title}</span>
            </div>
            {active.description ? (
              <p className="mt-1 text-xs leading-relaxed text-blue-800/80">
                {active.description}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-blue-800/60">
                Day {active.day} session — score each participant on the
                criteria below.
              </p>
            )}
          </div>
        );
      })()}

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

      {/* #4 turns strip — multiple scores for the same delegate in this session
          (e.g. they spoke more than once). Each juror's turns are averaged into
          their session mark. Hidden until a first score exists or the juror is
          mid-adding a turn; offline (occurrences empty) keeps the single-score
          flow. lock_on_submit sessions (e.g. the 90-second speech) are scored
          once, so the turns strip is hidden entirely. */}
      {activeParticipant && rubric && !eventLocked && !sessionLocksOnSubmit &&
        (occurrences.length > 0 || addingTurn) && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-900">
                  {addingTurn
                    ? "Scoring a new turn"
                    : `Turns scored: ${occurrences.length}`}
                </p>
                {occurrences.length > 0 && (
                  <p className="text-xs text-blue-700 truncate">
                    {occurrences
                      .map((o) => `T${o.occurrence}: ${o.total_score}`)
                      .join(" · ")}
                    {occurrences.length > 1 && (
                      <>
                        {" · avg "}
                        {(
                          occurrences.reduce((a, o) => a + o.total_score, 0) /
                          occurrences.length
                        ).toFixed(1)}
                      </>
                    )}
                  </p>
                )}
              </div>
              {addingTurn ? (
                <button
                  type="button"
                  onClick={cancelAnotherTurn}
                  className="shrink-0 rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startAnotherTurn}
                  className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  + Score another turn
                </button>
              )}
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
          lockAfterSubmit={sessionLocksOnSubmit}
          flags={flags}
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
                  juryLabel(p.serial_no, p.id)
                    .toLowerCase()
                    .includes(q) ||
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
                    // Benchless (party_side null) still has a party letter —
                    // show it with a neutral saffron chip, never "O"/"R".
                    const partyBadgeClass = p.party_side
                      ? PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]
                          .badge
                      : p.party_number != null
                        ? "bg-[#FF9933]/15 text-[#9a5212]"
                        : null;
                    const partyBadgeLabel = p.party_side
                      ? p.party_side === "ruling"
                        ? "R"
                        : "O"
                      : p.party_number != null
                        ? String.fromCharCode(64 + p.party_number)
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
                              {juryLabel(p.serial_no, p.id)}
                            </p>
                            {/* Constituency only — school is not shown to jurors. */}
                            {p.constituency_name && (
                              <p className="text-xs text-gray-500 truncate">
                                {p.constituency_name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {partyBadgeClass && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${partyBadgeClass}`}
                              >
                                {partyBadgeLabel}
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

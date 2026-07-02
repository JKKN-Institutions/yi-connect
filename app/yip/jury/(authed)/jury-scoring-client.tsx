"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { ScoreForm } from "@/components/yip/scoring/score-form";
import {
  getCurrentSpeaker,
  getRubricForRole,
  getScoreForParticipant,
  getScoreOccurrences,
  getScoresForJury,
  getSessionScoringParams,
  getScoreableParticipants,
  submitScore,
  type CurrentSpeakerInfo,
  type ScoreWithParticipant,
  type ScoringRubricData,
  type SessionScoringParams,
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
import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GOLD,
  SERIF,
  inkA,
} from "@/app/yip/me/credential-ui";

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
  constituency_number?: number | null;
  serial_no?: number | null;
};

interface Props {
  juryAssignmentId: string;
  juryName: string;
  eventId: string;
  initialEventLocked?: boolean;
}

// Jury lookup by participant number / constituency name (Mizoram req). Shared
// by the full picker AND the quick-jump bar (Piece 2) so both match
// identically — the quick-jump bar reuses this rather than inventing a
// second matcher.
function filterParticipantsBySearch(
  list: Participant[],
  query: string
): Participant[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (p) =>
      juryLabel(p.constituency_number, p.id).toLowerCase().includes(q) ||
      (p.constituency_number != null &&
        String(p.constituency_number).includes(q)) ||
      (p.constituency_name?.toLowerCase().includes(q) ?? false)
  );
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

  // ─── Rapid scoring (#776+): instant participant switching ────────
  // The rubric is per-ROLE and a session's scoring parameters are per-SESSION
  // — neither depends on which participant is active, so both are cached
  // after first sight instead of re-fetched on every switch. Existing scores
  // + turn occurrences both come from the `scores` table and are covered by
  // ONE bulk pull (getScoresForJury) instead of two per-switch reads.
  // FRESHNESS TRADEOFF (accepted): the bulk map refreshes on mount, on
  // session change, after every submit, and when the tab regains focus —
  // never per-switch in the background (a juror scores from one device; the
  // existing offline mode already accepts the same staleness). Refs (not
  // state) because mutating them must never itself trigger a form remount —
  // only scoreKey does that, exactly as before.
  const rubricByRoleRef = useRef<Map<string, ScoringRubricData>>(new Map());
  const sessionParamsCacheRef = useRef<
    Map<string, SessionScoringParams | null>
  >(new Map());
  const scoresByKeyRef = useRef<Map<string, ScoreWithParticipant[]>>(
    new Map()
  );
  const scoresMapLoadedRef = useRef(false);
  // Sequence guard (adversarial review fix): loadScoresMap is fired
  // concurrently from mount/session-change/submit/visibilitychange, so
  // whichever call RESOLVES last would otherwise win even if it started
  // first. Also bumped by patchScoreIntoMap so an in-flight pull that
  // started BEFORE a submit can never land afterwards and clobber the
  // submit's synchronous patch with pre-submit data.
  const loadSeqRef = useRef(0);
  // Bumped whenever scoresByKeyRef is rebuilt — mutating a ref doesn't
  // re-render; this forces one so the quick-jump status dots and the
  // Unfinished strip (which read the ref directly) reflect the refresh.
  const [scoresMapVersion, setScoresMapVersion] = useState(0);

  // Quick-jump bar (Piece 2) + Unfinished strip (Piece 3) state.
  const [quickJump, setQuickJump] = useState("");
  const [showAllUnfinished, setShowAllUnfinished] = useState(false);

  // Special Remarks (Phase 18 / F4) — flag checkboxes + delta config
  const [flagDeltas, setFlagDeltas] = useState<FlagDeltas | null>(null);
  const [flags, setFlags] = useState<FlagsState>(EMPTY_FLAGS);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Jurors score BLIND, against the participant's number — never the name —
  // for fairness. The id is untouched so scoring, buffering and lookups still
  // key on the real participant.
  const activeParticipantRaw =
    manualParticipant ?? currentSpeaker?.participant ?? null;
  // Memoized (adversarial review fix): manualParticipant/currentSpeaker are
  // state, so activeParticipantRaw is reference-stable across renders that
  // don't change them. Without this useMemo, activeParticipant was rebuilt as
  // a FRESH object literal on every unrelated render (e.g. typing in the
  // quick-jump input), and since it sits in the flags effect's dependency
  // array, that churned the effect (and its setFlags call) on every keystroke.
  const activeParticipant = useMemo(
    () =>
      activeParticipantRaw
        ? {
            ...activeParticipantRaw,
            full_name: juryLabel(
              activeParticipantRaw.constituency_number,
              activeParticipantRaw.id
            ),
          }
        : null,
    [activeParticipantRaw]
  );

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

  // Bulk-refresh THIS juror's own scores (rows include participant_id +
  // agenda_item_id + occurrence + criteria_scores + total_score + comments +
  // status + the flag_* columns — everything the per-switch reads below
  // need). Grouped by `${participantId}|${agendaItemId}`; each bucket keeps
  // the server's own updated_at-desc order, so bucket[0] is always the same
  // row getScoreForParticipant(..., agendaItemId) would resolve to (it runs
  // the identical `.order("updated_at", {ascending:false}).limit(1)`).
  const loadScoresMap = useCallback(async () => {
    // Sequence guard: claim this call's slot BEFORE the await. If anything
    // bumps loadSeqRef.current while this fetch is in flight (a newer
    // loadScoresMap call, OR a submit's synchronous patchScoreIntoMap), this
    // result is stale and must not overwrite what's already there.
    const seq = ++loadSeqRef.current;
    try {
      const rows = await getScoresForJury(juryAssignmentId, eventId);
      if (seq !== loadSeqRef.current) return;
      const map = new Map<string, ScoreWithParticipant[]>();
      for (const row of rows) {
        const key = `${row.participant_id}|${row.agenda_item_id ?? "null"}`;
        const bucket = map.get(key);
        if (bucket) bucket.push(row);
        else map.set(key, [row]);
      }
      scoresByKeyRef.current = map;
      scoresMapLoadedRef.current = true;
      setScoresMapVersion((v) => v + 1);
    } catch {
      // Offline/error — leave whatever we had. Every per-switch read below
      // falls back to the untouched server path whenever the map isn't
      // loaded or a key is missing, so this failure is silent by design.
    }
  }, [juryAssignmentId, eventId]);

  // Fix (adversarial review): synchronously patch the bulk map with the
  // juror's own just-written score — called from handleSubmit on BOTH the
  // success path AND a network failure (submitScore throws when offline).
  // Without this, a switch-away-then-back before the next loadScoresMap pull
  // lands would serve the PRE-submit bucket: merely stale online, but a real
  // regression offline — a stale NON-NULL existingScore SUPPRESSES
  // ScoreForm's localStorage-buffer fallback (getInitialScores prefers
  // existingScore.criteria_scores over the buffer), so the display would
  // silently revert to the pre-edit score even though the buffer (and the
  // eventual background sync) hold the juror's real edit.
  const patchScoreIntoMap = useCallback(
    (input: {
      participant: Participant;
      agendaItemId: string;
      criteriaScores: Record<string, number>;
      totalScore: number;
      comments: string;
      status: "draft" | "submitted";
      flags: FlagsState;
      isNewTurn: boolean;
      // The server-assigned id when known (the success path always has one).
      // Omitted on the offline/catch path — falls back to the row being
      // edited's existing id, or a synthetic key-only id for a brand-new row
      // (replaced by the next real loadScoresMap pull).
      savedId?: string;
    }) => {
      if (!rubric) return; // handleSubmit already guards this; defensive only.
      const key = `${input.participant.id}|${input.agendaItemId}`;
      const existingRows = scoresByKeyRef.current.get(key) ?? [];

      // Mirrors submitScore's own occurrence rule exactly: a new turn gets
      // max(existing)+1 (server-assigned); the normal edit path always
      // targets occurrence 1 — handleSubmit never passes `occurrence`, so
      // submitScore defaults `input.occurrence ?? 1`.
      const occurrence = input.isNewTurn
        ? existingRows.reduce((m, r) => Math.max(m, r.occurrence), 0) + 1
        : 1;
      const editingRow = input.isNewTurn
        ? undefined
        : existingRows.find((r) => r.occurrence === 1);
      const rowId = input.savedId ?? editingRow?.id ?? `local-${Date.now()}`;

      const patchedRow: ScoreWithParticipant = {
        id: rowId,
        jury_assignment_id: juryAssignmentId,
        participant_id: input.participant.id,
        event_id: eventId,
        rubric_id: rubric.id,
        agenda_item_id: input.agendaItemId,
        occurrence,
        criteria_scores: input.criteriaScores,
        total_score: input.totalScore,
        comments: input.comments || null,
        status: input.status,
        is_mock: false,
        position_bonus: 0,
        submitted_at:
          input.status === "submitted" ? new Date().toISOString() : null,
        created_at: editingRow?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        flag_no_confidence_brought: input.flags.no_confidence_brought,
        flag_walkout: input.flags.walkout,
        flag_ruckus: input.flags.ruckus,
        flag_suspension: input.flags.suspension,
        participant: {
          id: input.participant.id,
          full_name: input.participant.full_name,
          parliament_role: input.participant.parliament_role,
          party_side: input.participant.party_side,
          party_number: input.participant.party_number ?? null,
          constituency_name: input.participant.constituency_name ?? null,
          constituency_number: input.participant.constituency_number ?? null,
          serial_no: input.participant.serial_no ?? null,
        },
        rubric: null,
      };

      // bucket[0] must stay the most-recently-updated row — the invariant
      // every reader (existingScore, flags, status dots, Unfinished) relies
      // on. The row we just wrote/attempted IS that row (newest updated_at).
      scoresByKeyRef.current.set(key, [
        patchedRow,
        ...existingRows.filter((r) => r.occurrence !== occurrence),
      ]);
      // Invalidate any in-flight loadScoresMap pull that started BEFORE this
      // submit — it would otherwise resolve afterwards and overwrite this
      // patch with pre-submit data (the fetch-vs-local-patch race).
      loadSeqRef.current++;
      setScoresMapVersion((v) => v + 1);
    },
    [rubric, juryAssignmentId, eventId]
  );

  // Cache-only path: returns true (and has already updated every piece of
  // state loadRubricAndScore would) when the role rubric, this session's
  // params, AND the bulk score map are all warm. Returns false the moment ANY
  // of the three is cold so the caller falls back to the untouched,
  // battle-tested loadRubricAndScore server path — this must never regress a
  // live event.
  const loadParticipantScoreFast = useCallback(
    (participant: Participant): boolean => {
      if (!selectedSessionId) return false;
      const role = participant.parliament_role ?? "mp";
      const cachedRubric = rubricByRoleRef.current.get(role);
      if (!cachedRubric) return false;
      if (!sessionParamsCacheRef.current.has(selectedSessionId)) return false;
      if (!scoresMapLoadedRef.current) return false;

      const sessionParams =
        sessionParamsCacheRef.current.get(selectedSessionId) ?? null;
      // Mirrors loadRubricAndScore's success branch exactly (same precedence:
      // session params override the role-rubric fallback).
      setRubric({
        id: cachedRubric.id,
        criteria: (sessionParams?.criteria ??
          cachedRubric.criteria) as unknown as Criterion[],
        total_max: sessionParams?.total_max ?? cachedRubric.total_max,
      });
      setSessionLocksOnSubmit(sessionParams?.lock_on_submit === true);

      const rows =
        scoresByKeyRef.current.get(
          `${participant.id}|${selectedSessionId}`
        ) ?? [];
      const latest = rows[0] ?? null;
      setExistingScore(
        latest
          ? {
              id: latest.id,
              criteria_scores:
                latest.criteria_scores as unknown as Record<string, number>,
              total_score: latest.total_score,
              comments: latest.comments,
              status: latest.status,
            }
          : null
      );
      setAddingTurn(false);
      setOccurrences(
        [...rows]
          .sort((a, b) => a.occurrence - b.occurrence)
          .map((r) => ({
            id: r.id,
            occurrence: r.occurrence,
            total_score: r.total_score,
            status: r.status,
          }))
      );
      setScoreKey((k) => k + 1);
      return true;
    },
    [selectedSessionId]
  );

  // Every call site below switches through THIS wrapper. It tries the
  // instant cache-only path first; on a cold cache it degrades to the exact
  // original server round-trips, unchanged.
  const loadParticipantScore = useCallback(
    async (participant: Participant) => {
      if (loadParticipantScoreFast(participant)) return;
      await loadRubricAndScore(participant);
    },
    [loadParticipantScoreFast, loadRubricAndScore]
  );

  const loadCurrentSpeaker = useCallback(async () => {
    try {
      const result = await getCurrentSpeaker(eventId);
      if (result.success) {
        setCurrentSpeaker(result.data);
        // If no manual override, load rubric for current speaker
        if (!manualParticipant && result.data?.participant) {
          await loadParticipantScore(result.data.participant);
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
  }, [eventId, manualParticipant, loadParticipantScore]);

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

      // Rapid scoring: the bootstrap already fetches every role rubric +
      // every assigned session's parameters in one round-trip — seed the
      // in-memory caches from it for free (zero extra network cost) so
      // future participant switches skip getRubricForRole /
      // getSessionScoringParams entirely.
      for (const [role, r] of Object.entries(b.rubricsByRole)) {
        rubricByRoleRef.current.set(role, r);
      }
      for (const [sid, p] of Object.entries(b.sessionParams)) {
        sessionParamsCacheRef.current.set(sid, p);
      }

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
    // Rapid scoring: pull this juror's own scores once, in parallel — never
    // gates the loading spinner. Cold on the very first render (before this
    // resolves), every per-switch read above degrades to the original server
    // path until it lands.
    void loadScoresMap();
    return () => {
      cancelled = true;
    };
    // applyBootstrap/loadScoresMap are stable via useCallback over (eventId, juryAssignmentId).
  }, [juryAssignmentId, eventId, applyBootstrap, loadScoresMap]);

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
    // Rapid scoring: this call already re-fetches rubricsByRole/sessionParams
    // live — keep the caches in lockstep (e.g. an organiser toggling
    // lock_on_submit mid-event) at zero extra network cost.
    for (const [role, r] of Object.entries(b.rubricsByRole)) {
      rubricByRoleRef.current.set(role, r);
    }
    for (const [sid, p] of Object.entries(b.sessionParams)) {
      sessionParamsCacheRef.current.set(sid, p);
    }
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
    // Rapid scoring freshness trigger: re-pull this juror's own scores
    // whenever the session they're scoring changes (background — never
    // blocks the UI, and runs even with no active participant yet).
    void loadScoresMap();
    if (!activeParticipant || !selectedSessionId) return;
    void loadParticipantScore(activeParticipant);
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
    // Rapid scoring fast path: once the bulk score map is loaded, derive
    // flags synchronously from it instead of re-fetching — this is the SAME
    // row getScoreForParticipant(juryAssignmentId, participantId, eventId,
    // selectedSessionId) resolves to (see loadScoresMap's grouping above), so
    // this never changes what the juror sees, only how fast it appears.
    if (selectedSessionId && scoresMapLoadedRef.current) {
      const rows =
        scoresByKeyRef.current.get(
          `${activeParticipant.id}|${selectedSessionId}`
        ) ?? [];
      const latest = rows[0] ?? null;
      const next: FlagsState = latest
        ? {
            no_confidence_brought: Boolean(latest.flag_no_confidence_brought),
            walkout: Boolean(latest.flag_walkout),
            ruckus: Boolean(latest.flag_ruckus),
            suspension: Boolean(latest.flag_suspension),
          }
        : EMPTY_FLAGS;
      // Bail-out functional update (adversarial review fix): activeParticipant
      // is now memoized, but this effect still re-runs on every
      // scoresMapVersion bump — return the SAME `prev` reference when nothing
      // actually changed so React can skip the re-render entirely instead of
      // committing an identical-content-but-new-object state update.
      setFlags((prev) =>
        prev.no_confidence_brought === next.no_confidence_brought &&
        prev.walkout === next.walkout &&
        prev.ruckus === next.ruckus &&
        prev.suspension === next.suspension
          ? prev
          : next
      );
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
    // scoresMapVersion: re-run once the bulk map lands so a switch that fired
    // during the still-cold window above converges onto the cache-derived
    // value (identical data — this only affects which branch computed it).
  }, [
    activeParticipant,
    juryAssignmentId,
    eventId,
    selectedSessionId,
    scoresMapVersion,
  ]);

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

  // Rapid scoring freshness trigger: refresh this juror's own scores when the
  // tab/app regains focus (e.g. a phone screen waking back up).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadScoresMap();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadScoresMap]);

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
    // Rapid scoring: loadParticipantScore resolves synchronously (no spinner
    // flash) whenever the caches are warm — setLoading(true) below is a no-op
    // in that common case since setLoading(false) follows on the same tick.
    setLoading(true);
    await loadParticipantScore(p);
    setLoading(false);
  };

  const clearManualSelection = () => {
    setManualParticipant(null);
    if (currentSpeaker?.participant) {
      setLoading(true);
      loadParticipantScore(currentSpeaker.participant).then(() =>
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

    let result: Awaited<ReturnType<typeof submitScore>>;
    try {
      result = await submitScore({
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
    } catch (err) {
      // Network failure (offline) — submitScore never reached the server.
      // Patch the bulk map with the juror's INTENDED write (the same values
      // ScoreForm's own catch below buffers to localStorage) so a switch-
      // away-then-back before connectivity returns shows this edit, not a
      // stale pre-submit score (see patchScoreIntoMap's comment above).
      patchScoreIntoMap({
        participant: activeParticipant,
        agendaItemId: selectedSessionId,
        criteriaScores: data.criteriaScores,
        totalScore: data.totalScore,
        comments: data.comments,
        status: data.status,
        flags,
        isNewTurn: addingTurn,
      });
      // Rethrow — ScoreForm's own catch (buffer write + "no internet"
      // message) must run exactly as before; this handler never swallows it.
      throw err;
    }

    if (result.success) {
      // Patch the bulk map synchronously with what we just wrote — closes the
      // window where a switch-away-then-back before loadScoresMap's
      // background pull (below) lands would still serve the pre-submit row.
      patchScoreIntoMap({
        participant: activeParticipant,
        agendaItemId: selectedSessionId,
        criteriaScores: data.criteriaScores,
        totalScore: data.totalScore,
        comments: data.comments,
        status: data.status,
        flags,
        isNewTurn: addingTurn,
        savedId: result.data.id,
      });

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

      // Rapid scoring freshness trigger: re-pull the bulk scores map in the
      // background so the quick-jump status dots + Unfinished strip reflect
      // this submit immediately, and future participant switches see it too.
      void loadScoresMap();
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
    if (activeParticipant) void loadParticipantScore(activeParticipant);
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
        <h2 className="text-lg font-bold" style={{ ...SERIF, color: INK }}>
          No sessions assigned
        </h2>
        <p className="text-sm mt-2 max-w-xs" style={{ color: inkA(0.55) }}>
          You haven&apos;t been assigned to any sessions yet. Ask the organizer to
          add you to the sessions you&apos;ll be judging.
        </p>
      </div>
    );
  }

  // ─── Quick-jump bar (Piece 2) + Unfinished strip (Piece 3) ───────
  // Both are derived straight from the Piece 1 caches on every render; a
  // re-render is forced whenever scoresMapVersion (state) bumps, since
  // mutating scoresByKeyRef alone would not otherwise trigger one.
  const getStatusDot = (
    participantId: string
  ): "unscored" | "draft" | "submitted" => {
    if (!selectedSessionId) return "unscored";
    const rows = scoresByKeyRef.current.get(
      `${participantId}|${selectedSessionId}`
    );
    const latest = rows?.[0];
    if (!latest) return "unscored";
    return latest.status === "draft" ? "draft" : "submitted";
  };

  const quickJumpMatches = quickJump.trim()
    ? filterParticipantsBySearch(allParticipants, quickJump)
    : [];

  // Unfinished (Piece 3): this juror's DRAFT rows for the selected session,
  // read straight off the bulk map (each bucket's [0] is the latest row).
  const unfinishedRows: ScoreWithParticipant[] = [];
  if (selectedSessionId) {
    for (const rows of scoresByKeyRef.current.values()) {
      const latest = rows[0];
      if (
        latest &&
        latest.status === "draft" &&
        latest.agenda_item_id === selectedSessionId
      ) {
        unfinishedRows.push(latest);
      }
    }
  }
  const UNFINISHED_VISIBLE_CAP = 8;
  const unfinishedVisible = showAllUnfinished
    ? unfinishedRows
    : unfinishedRows.slice(0, UNFINISHED_VISIBLE_CAP);
  const unfinishedHiddenCount = unfinishedRows.length - unfinishedVisible.length;

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

      {/* Quick-jump bar (Piece 2) — replaces the open-search-close picker
          loop for rapid-fire moments (a 15-second intervention shouldn't cost
          3-4 server round trips + a picker open/close cycle). Sticky so it
          stays reachable while the rubric form scrolls under it; only shown
          once a session is selected (matching + status dots need one). */}
      {selectedSessionId && (
        <div
          className="sticky top-0 z-20 mx-4 mt-4 rounded-xl border-2 border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <label
            htmlFor="quick-jump-input"
            className="block text-[11px] font-bold uppercase tracking-wide"
            style={{ color: inkA(0.5) }}
          >
            Jump to participant #
          </label>
          <input
            id="quick-jump-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={quickJump}
            onChange={(e) => setQuickJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickJumpMatches.length === 1) {
                void selectManualParticipant(quickJumpMatches[0]);
                setQuickJump("");
              }
            }}
            placeholder="e.g. 42"
            aria-label="Jump to participant by number"
            className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-base font-semibold text-gray-900 focus:border-blue-400 focus:outline-none"
            style={{ minHeight: "44px" }}
          />

          {/* On-screen digit pad — avoids summoning the OS keyboard for
              rapid-fire numeric jumps during live debate (#780). Appends
              straight into the SAME quickJump state; no focus() calls. */}
          <div
            className="mt-2 flex gap-1"
            role="group"
            aria-label="Digit pad for participant number"
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setQuickJump((q) => q + d)}
                className="flex-1 rounded-md border-2 text-sm font-bold active:scale-95"
                style={{
                  minHeight: "40px",
                  borderColor: `${GOLD}66`,
                  color: INK,
                  background: `${GOLD}14`,
                }}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuickJump((q) => q.slice(0, -1))}
              aria-label="Backspace"
              className="flex-1 rounded-md border-2 border-gray-200 text-sm font-bold text-gray-700 active:scale-95"
              style={{ minHeight: "40px" }}
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => setQuickJump("")}
              aria-label="Clear"
              className="flex-1 rounded-md border-2 border-gray-200 text-sm font-bold text-gray-700 active:scale-95"
              style={{ minHeight: "40px" }}
            >
              ×
            </button>
          </div>

          {quickJump.trim() && (
            <div
              className="mt-2 flex gap-2 overflow-x-auto pb-1"
              role="list"
              aria-label="Matching participants"
            >
              {quickJumpMatches.length === 0 ? (
                <p className="py-2 text-xs" style={{ color: inkA(0.45) }}>
                  No participant matches &ldquo;{quickJump}&rdquo;.
                </p>
              ) : (
                quickJumpMatches.map((p) => {
                  const dot = getStatusDot(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="listitem"
                      onClick={() => {
                        void selectManualParticipant(p);
                        setQuickJump("");
                      }}
                      className="flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border-2 border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                      style={{ minHeight: "40px" }}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        aria-hidden="true"
                        style={{
                          background:
                            dot === "submitted"
                              ? "#138808"
                              : dot === "draft"
                                ? GOLD
                                : "#d1d5db",
                        }}
                      />
                      {juryLabel(p.constituency_number, p.id)}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Unfinished strip (Piece 3) — a lull-time worklist so 15-second
              partial scores get finished. Draft rows for THIS session only. */}
          {unfinishedRows.length > 0 && (
            <div className="mt-2.5 border-t border-gray-100 pt-2">
              <p
                className="text-[11px] font-bold"
                style={{ color: inkA(0.5) }}
              >
                Unfinished ({unfinishedRows.length}):
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {unfinishedVisible.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => void selectManualParticipant(row.participant)}
                    className="flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-semibold hover:bg-amber-100 active:bg-amber-200"
                    style={{
                      minHeight: "40px",
                      borderColor: `${GOLD}66`,
                      background: `${GOLD}14`,
                      color: "#7a5c1e",
                    }}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      aria-hidden="true"
                      style={{ background: GOLD }}
                    />
                    {juryLabel(
                      row.participant.constituency_number,
                      row.participant.id
                    )}
                  </button>
                ))}
                {unfinishedHiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllUnfinished(true)}
                    className="shrink-0 touch-manipulation rounded-full border-2 border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    style={{ minHeight: "40px" }}
                  >
                    +{unfinishedHiddenCount} more
                  </button>
                )}
              </div>
            </div>
          )}
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
          <div className="mx-4 mt-3">
            <SectionShell accent={SAFFRON}>
              <div className="px-4 py-3">
                <SectionHeading
                  eyebrow="This session"
                  title={active.title}
                  icon={Info}
                  accent={SAFFRON}
                />
                {active.description ? (
                  <p
                    className="mt-2 text-xs leading-relaxed"
                    style={{ color: inkA(0.6) }}
                  >
                    {active.description}
                  </p>
                ) : (
                  <p
                    className="mt-2 text-xs italic"
                    style={{ color: inkA(0.45) }}
                  >
                    Day {active.day} session — score each participant on the
                    criteria below.
                  </p>
                )}
              </div>
            </SectionShell>
          </div>
        );
      })()}

      {/* Current agenda context */}
      {currentSpeaker && !manualParticipant && (
        <div className="mx-4 mt-4">
          <SectionShell accent={SAFFRON}>
            <div className="px-4 py-3">
              <SectionHeading
                eyebrow="Live"
                title="Now Speaking"
                icon={Mic}
                accent={SAFFRON}
              />
              <p
                className="text-xs mt-1.5 truncate"
                style={{ color: inkA(0.6) }}
              >
                {currentSpeaker.agendaItemTitle}
              </p>
            </div>
          </SectionShell>
        </div>
      )}

      {/* Manual participant override */}
      {manualParticipant && (
        <div className="mx-4 mt-4">
          <SectionShell accent={INK}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ ...SERIF, color: INK }}
                >
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
          </SectionShell>
        </div>
      )}

      {/* Special Remarks (Phase 18 / F4) — visible whenever a participant
          is loaded. Deltas come from yip.scoring_flags_config and are
          applied at result-computation time, not added to the live total. */}
      {activeParticipant && rubric && (
        <div className="mx-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 px-4 py-3">
          <div
            className="flex items-center gap-2 text-sm font-semibold text-amber-900"
            style={{ ...SERIF }}
          >
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
          <SectionShell accent={GOLD}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-xs font-semibold"
                    style={{ ...SERIF, color: INK }}
                  >
                    {addingTurn
                      ? "Scoring a new turn"
                      : `Turns scored: ${occurrences.length}`}
                  </p>
                  {occurrences.length > 0 && (
                    <p
                      className="text-xs truncate"
                      style={{ color: inkA(0.6) }}
                    >
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
          </SectionShell>
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
          <h2
            className="text-xl font-bold"
            style={{ ...SERIF, color: INK }}
          >
            Waiting for next speaker...
          </h2>
          <p
            className="text-sm mt-2 max-w-xs landscape-hide"
            style={{ color: inkA(0.55) }}
          >
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
          // Shared with the quick-jump bar's live filter (Piece 2) —
          // filterParticipantsBySearch, defined at module scope above.
          const list = filterParticipantsBySearch(allParticipants, pickerSearch);
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
                              {juryLabel(p.constituency_number, p.id)}
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

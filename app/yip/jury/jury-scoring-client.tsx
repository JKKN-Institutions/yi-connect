"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { ScoreForm } from "@/components/yip/scoring/score-form";
import {
  getCurrentSpeaker,
  getRubricForRole,
  getScoreForParticipant,
  getScoreableParticipants,
  submitScore,
  type CurrentSpeakerInfo,
} from "@/app/actions/scoring";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { Loader2, Mic, Users, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { useOfflineSync } from "@/hooks/yip/use-offline-sync";
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

type Participant = {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  school_name: string;
  ministry?: string | null;
  constituency_name?: string | null;
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

  // Manual participant picker state
  const [showPicker, setShowPicker] = useState(false);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [manualParticipant, setManualParticipant] =
    useState<Participant | null>(null);
  const [loadingPicker, setLoadingPicker] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // The active participant is either the current speaker or a manually selected one
  const activeParticipant =
    manualParticipant ?? currentSpeaker?.participant ?? null;

  // ─── Fetch speaker data ─────────────────────────────────────────

  const loadRubricAndScore = useCallback(
    async (participant: Participant) => {
      const role = participant.parliament_role ?? "mp";

      const [rubricResult, scoreResult] = await Promise.all([
        getRubricForRole(role),
        getScoreForParticipant(juryAssignmentId, participant.id, eventId),
      ]);

      if (rubricResult.success) {
        const r = rubricResult.data;
        setRubric({
          id: r.id,
          criteria: r.criteria as unknown as Criterion[],
          total_max: r.total_max,
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
    [juryAssignmentId, eventId]
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

  // ─── Realtime: watch events table for current_agenda_item_id ────

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`jury-event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
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
          schema: "public",
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

    const result = await submitScore({
      juryAssignmentId,
      participantId: activeParticipant.id,
      eventId,
      rubricId: rubric.id,
      agendaItemId: currentSpeaker?.agendaItemId ?? null,
      criteriaScores: data.criteriaScores,
      totalScore: data.totalScore,
      comments: data.comments,
      status: data.status,
    });

    if (result.success) {
      // Refresh the existing score after saving
      const fresh = await getScoreForParticipant(
        juryAssignmentId,
        activeParticipant.id,
        eventId
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

      {/* Score form -- show when we have an active participant + rubric */}
      {activeParticipant && rubric ? (
        <ScoreForm
          key={`${activeParticipant.id}-${scoreKey}`}
          participant={activeParticipant}
          criteria={rubric.criteria}
          rubricId={rubric.id}
          eventId={eventId}
          agendaItemId={currentSpeaker?.agendaItemId ?? null}
          juryAssignmentId={juryAssignmentId}
          existingScore={existingScore}
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

        {showPicker && allParticipants.length > 0 && (
          <div
            id="participant-picker-list"
            className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-md"
          >
            {allParticipants.map((p) => {
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
                        {p.full_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {p.school_name}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}

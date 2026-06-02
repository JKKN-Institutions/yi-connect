"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScoreCard } from "@/components/yip/scoring/score-card";
import { ScoreForm } from "@/components/yip/scoring/score-form";
import {
  getRubricForRole,
  getScoreForParticipant,
  getSessionScoringParams,
  submitScore,
  type ScoreWithParticipant,
} from "@/app/yip/actions/scoring";
import { Loader2, ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/yip/ui/button";

interface Criterion {
  key: string;
  label: string;
  max_score: number;
  description?: string | null;
  // Per-session params carry a kind so the edit view groups participation
  // parameters the same way live scoring does. Undefined on the role-rubric
  // fallback path (renders ungrouped) — mirrors ScoreForm's Criterion.
  kind?: "evaluation" | "participation";
}

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

interface Props {
  scores: ScoreWithParticipant[];
  juryAssignmentId: string;
  eventId: string;
  // Per-session denominators resolved SERVER-SIDE (page.tsx) so each card shows
  // the correct /N (15/20/10) on first paint — no client fallback flash.
  sessionMaxById: Record<string, number>;
}

export function HistoryClient({
  scores,
  juryAssignmentId,
  eventId,
  sessionMaxById,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // participant id
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [existingScore, setExistingScore] =
    useState<ExistingScoreData | null>(null);
  const [editParticipant, setEditParticipant] =
    useState<ScoreWithParticipant["participant"] | null>(null);
  // Per-session (BUG-385): the session this history row belongs to, so editing
  // updates that session's score rather than overwriting a different one.
  const [editAgendaItemId, setEditAgendaItemId] = useState<string | null>(null);

  // Per-session denominators come from the server (sessionMaxById prop) so each
  // card shows the correct /N (15/20/10) on first paint. Rows whose session has
  // no configured params fall back to the role-rubric total_max at render time.

  const handleEditClick = useCallback(
    async (score: ScoreWithParticipant) => {
      // If score is locked, don't allow edit
      if (score.status === "locked") return;

      setLoadingEdit(true);
      setEditing(score.participant_id);
      setEditAgendaItemId(score.agenda_item_id);

      const role = score.participant.parliament_role ?? "mp";

      const [rubricResult, freshScore, sessionParams] = await Promise.all([
        getRubricForRole(role),
        getScoreForParticipant(
          juryAssignmentId,
          score.participant_id,
          eventId,
          score.agenda_item_id
        ),
        // Per-session scoring: the criteria shown for editing come from THIS
        // score's session (its agenda_item_id) when it has configured params.
        // Legacy scores with no agenda_item_id keep the role-rubric behavior.
        score.agenda_item_id
          ? getSessionScoringParams(score.agenda_item_id)
          : Promise.resolve(null),
      ]);

      if (rubricResult.success) {
        // Prefer the SESSION's configured parameters; the role rubric supplies
        // the rubric_id (FK) + the fallback criteria when the session has no
        // configured parameters. Mirrors jury-scoring-client.tsx.
        setRubric({
          id: rubricResult.data.id,
          criteria: (sessionParams?.criteria ??
            rubricResult.data.criteria) as unknown as Criterion[],
          total_max: sessionParams?.total_max ?? rubricResult.data.total_max,
        });
      }

      if (freshScore) {
        setExistingScore({
          id: freshScore.id,
          criteria_scores:
            freshScore.criteria_scores as unknown as Record<string, number>,
          total_score: freshScore.total_score,
          comments: freshScore.comments,
          status: freshScore.status,
        });
      }

      setEditParticipant(score.participant);
      setLoadingEdit(false);
    },
    [juryAssignmentId, eventId]
  );

  const handleSubmit = async (data: {
    criteriaScores: Record<string, number>;
    totalScore: number;
    comments: string;
    status: "draft" | "submitted";
  }) => {
    if (!editParticipant || !rubric) {
      return { success: false as const, error: "Missing data" };
    }

    const result = await submitScore({
      juryAssignmentId,
      participantId: editParticipant.id,
      eventId,
      rubricId: rubric.id,
      agendaItemId: editAgendaItemId,
      criteriaScores: data.criteriaScores,
      totalScore: data.totalScore,
      comments: data.comments,
      status: data.status,
    });

    if (result.success) {
      // Refresh the score
      const fresh = await getScoreForParticipant(
        juryAssignmentId,
        editParticipant.id,
        eventId,
        editAgendaItemId
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
      // Refresh the page data
      router.refresh();
    }

    return result.success
      ? { success: true as const }
      : { success: false as const, error: result.error };
  };

  const handleBack = () => {
    setEditing(null);
    setRubric(null);
    setExistingScore(null);
    setEditParticipant(null);
    setEditAgendaItemId(null);
    router.refresh();
  };

  // ─── Edit Mode ──────────────────────────────────────────────────

  if (editing && editParticipant && rubric) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to History
        </Button>

        <ScoreForm
          key={editParticipant.id}
          participant={{
            ...editParticipant,
            ministry: null,
            constituency_name: null,
          }}
          criteria={rubric.criteria}
          rubricId={rubric.id}
          eventId={eventId}
          agendaItemId={editAgendaItemId}
          juryAssignmentId={juryAssignmentId}
          existingScore={existingScore}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  if (loadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Loading score...</p>
      </div>
    );
  }

  // ─── Score List ─────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Scoring History</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {scores.length} {scores.length === 1 ? "score" : "scores"} recorded
        </p>
      </div>

      {scores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="size-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No scores yet</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xs">
            Your scores will appear here as you evaluate participants.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scores.map((score) => (
            <ScoreCard
              key={score.id}
              participantName={score.participant.full_name}
              parliamentRole={score.participant.parliament_role}
              partySide={score.participant.party_side}
              totalScore={score.total_score}
              maxScore={
                (score.agenda_item_id &&
                  sessionMaxById[score.agenda_item_id]) ||
                score.rubric?.total_max ||
                100
              }
              status={score.status}
              updatedAt={score.updated_at}
              onClick={
                score.status !== "locked"
                  ? () => handleEditClick(score)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

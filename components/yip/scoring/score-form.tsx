"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { saveToBuffer, getFromBuffer, removeFromBuffer } from "@/lib/yip/score-buffer";
import { Save, Send, Loader2, CheckCircle2, MessageSquare } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface Criterion {
  key: string;
  label: string;
  max_score: number;
  description?: string | null;
  // Per-session params carry a kind so the juror sees participation parameters
  // in a visually distinct group. Undefined on the role-rubric fallback path,
  // which renders as a single ungrouped list (unchanged behaviour).
  kind?: "evaluation" | "participation";
}

interface ParticipantInfo {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  school_name: string;
  ministry?: string | null;
  constituency_name?: string | null;
  // Shown next to the name as the unique participant number.
  serial_no?: number | null;
}

interface ExistingScore {
  id: string;
  criteria_scores: Record<string, number>;
  total_score: number;
  comments: string | null;
  status: string | null;
}

interface ScoreFormProps {
  participant: ParticipantInfo;
  criteria: Criterion[];
  rubricId: string;
  eventId: string;
  agendaItemId: string | null;
  juryAssignmentId: string;
  existingScore: ExistingScore | null;
  // Special-Remarks flags from the parent panel — included in every buffer
  // write so flags ticked during an outage survive to the sync.
  flags?: {
    no_confidence_brought: boolean;
    walkout: boolean;
    ruckus: boolean;
    suspension: boolean;
  };
  onSubmit: (data: {
    criteriaScores: Record<string, number>;
    totalScore: number;
    comments: string;
    status: "draft" | "submitted";
  }) => Promise<{ success: boolean; error?: string }>;
}

// ─── Component ────────────────────────────────────────────────────

export function ScoreForm({
  participant,
  criteria,
  rubricId,
  eventId,
  agendaItemId,
  juryAssignmentId,
  existingScore,
  flags,
  onSubmit,
}: ScoreFormProps) {
  // Why: form state must be EXACTLY the current rubric's parent keys. Stale localStorage
  // or older DB rows can carry legacy dotted sub-keys (e.g. "delivery.fluency") alongside
  // their flat parents — sanitize here so totals/payloads can't be double-counted.
  const sanitizeScores = useCallback(
    (raw: Record<string, unknown> | null | undefined): Record<string, number> | null => {
      if (!raw) return null;
      const out: Record<string, number> = {};
      for (const c of criteria) {
        const v = raw[c.key];
        if (typeof v !== "number" || Number.isNaN(v)) return null;
        out[c.key] = Math.max(0, Math.min(v, c.max_score));
      }
      return out;
    },
    [criteria]
  );

  const getInitialScores = useCallback((): Record<string, number> => {
    const fromExisting = sanitizeScores(
      existingScore?.criteria_scores as Record<string, unknown> | undefined
    );
    if (fromExisting) return fromExisting;

    // Session-aware + rubric-validated: only rehydrate a buffer entry written
    // for THIS session, and only when its keys match the active rubric.
    const buffered = getFromBuffer(
      juryAssignmentId,
      participant.id,
      agendaItemId,
      criteria.map((c) => c.key)
    );
    const fromBuffer = sanitizeScores(
      buffered?.criteriaScores as Record<string, unknown> | undefined
    );
    if (fromBuffer) return fromBuffer;

    return Object.fromEntries(criteria.map((c) => [c.key, 0]));
  }, [criteria, existingScore, juryAssignmentId, participant.id, agendaItemId, sanitizeScores]);

  const [scores, setScores] = useState<Record<string, number>>(getInitialScores);
  const [comments, setComments] = useState(
    existingScore?.comments ??
      getFromBuffer(juryAssignmentId, participant.id, agendaItemId)?.comments ??
      ""
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once the juror has touched the form (score/comment edit). Gates the
  // autosave buffer so merely VIEWING a participant never creates an entry.
  const dirtyRef = useRef(false);

  // Why: only sum keys that belong to the active rubric — defends totals from any leaked
  // foreign keys (legacy dotted sub-criteria) that might have slipped past sanitization.
  const cleanScores = Object.fromEntries(
    criteria.map((c) => [c.key, scores[c.key] ?? 0])
  );
  const totalScore = criteria.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.max_score, 0);
  const isLocked = existingScore?.status === "locked";
  const isSubmitted = existingScore?.status === "submitted";

  // Auto-save to localStorage buffer on score changes — but ONLY once the juror
  // has actually edited something. Without the dirty guard this effect fires on
  // mount (and on async flag hydration) and buffers an untouched all-zero form,
  // which the offline flush then syncs as a phantom 0-point draft row.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      // STICKY SUBMIT INTENT: once the juror has offline-SUBMITTED this sheet,
      // later edits keep the submitted intent — the refined values sync as
      // submitted. Without this, "submit offline, then fix one number" silently
      // demoted the score to a draft that never counts in results.
      const prev = getFromBuffer(juryAssignmentId, participant.id, agendaItemId);
      saveToBuffer(juryAssignmentId, {
        participantId: participant.id,
        rubricId,
        eventId,
        agendaItemId,
        criteriaScores: cleanScores,
        totalScore,
        comments,
        savedAt: new Date().toISOString(),
        status: prev?.status === "submitted" ? "submitted" : "draft",
        ...(flags ? { flags } : {}),
      });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [scores, comments, juryAssignmentId, participant.id, rubricId, eventId, agendaItemId, totalScore, flags]);

  const handleScoreChange = (key: string, value: number) => {
    if (isLocked) return;
    const criterion = criteria.find((c) => c.key === key);
    if (!criterion) return;
    const clamped = Math.max(0, Math.min(value, criterion.max_score));
    dirtyRef.current = true;
    setScores((prev) => ({ ...prev, [key]: clamped }));
    setError(null);
  };

  const handleAction = async (status: "draft" | "submitted") => {
    if (isLocked) return;

    const setLoadingFn = status === "draft" ? setSaving : setSubmitting;
    setLoadingFn(true);
    setError(null);

    try {
      const result = await onSubmit({
        criteriaScores: cleanScores,
        totalScore,
        comments,
        status,
      });

      if (result.success) {
        removeFromBuffer(juryAssignmentId, participant.id, agendaItemId);
        dirtyRef.current = false;
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        // The server RESPONDED with a rejection (lock, validation, auth) —
        // a retry won't change it, so show the error without buffering intent.
        setError(result.error ?? "Failed to save");
      }
    } catch {
      // Network failure — the server never saw this. Preserve the juror's
      // INTENT in the buffer: an offline Submit syncs as SUBMITTED when
      // connectivity returns (drafts are excluded from results, so silently
      // downgrading a Submit made the score never count). A Save stays draft.
      saveToBuffer(juryAssignmentId, {
        participantId: participant.id,
        rubricId,
        eventId,
        agendaItemId,
        criteriaScores: cleanScores,
        totalScore,
        comments,
        savedAt: new Date().toISOString(),
        status,
        ...(flags ? { flags } : {}),
      });
      setError(
        status === "submitted"
          ? "No internet — your SUBMIT is saved on this phone and will send automatically when connection returns. Keep this tab open."
          : "No internet — your draft is saved on this phone and will sync automatically. Keep this tab open."
      );
    } finally {
      setLoadingFn(false);
    }
  };

  // Renders one criterion card (slider + quick-tap buttons). Shared by the
  // evaluation and participation groups so both use the identical 0…max control.
  const renderCriterion = (criterion: Criterion) => {
    const value = scores[criterion.key] ?? 0;
    const pct = criterion.max_score > 0 ? (value / criterion.max_score) * 100 : 0;

    return (
      <div key={criterion.key} className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-semibold text-gray-900">
              {criterion.label}
            </label>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {criterion.description}
            </p>
          </div>
          <span className="shrink-0 text-lg font-bold text-gray-900 tabular-nums">
            {value}
            <span className="text-xs font-normal text-gray-400">
              /{criterion.max_score}
            </span>
          </span>
        </div>

        {/* Custom range input with large touch target */}
        <div className="mt-3 relative">
          {/* Background track */}
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Native range input overlay — large touch area */}
          <input
            type="range"
            min={0}
            max={criterion.max_score}
            step={1}
            value={value}
            disabled={isLocked}
            onChange={(e) =>
              handleScoreChange(criterion.key, parseInt(e.target.value, 10))
            }
            className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            style={{ height: "48px", marginTop: "-18px" }}
            aria-label={`Score for ${criterion.label}`}
          />
        </div>

        {/* Quick-tap score buttons */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {Array.from(
            { length: Math.min(criterion.max_score + 1, 11) },
            (_, i) => {
              // Show evenly distributed buttons if max > 10
              if (criterion.max_score > 10) {
                const step = criterion.max_score / 10;
                const val = Math.round(i * step);
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleScoreChange(criterion.key, val)}
                    className={`min-w-[36px] h-9 rounded-md text-xs font-medium transition-all
                      ${
                        value === val
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {val}
                  </button>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleScoreChange(criterion.key, i)}
                  className={`min-w-[36px] h-9 rounded-md text-xs font-medium transition-all
                    ${
                      value === i
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {i}
                </button>
              );
            }
          )}
        </div>
      </div>
    );
  };

  const roleLabel = participant.parliament_role
    ? ROLE_LABELS[participant.parliament_role] ?? participant.parliament_role
    : "Participant";
  const roleColor = participant.parliament_role
    ? ROLE_COLORS[participant.parliament_role] ?? "bg-gray-500 text-white"
    : "bg-gray-500 text-white";
  const partyColor = participant.party_side
    ? PARTY_COLORS[participant.party_side as keyof typeof PARTY_COLORS]
    : null;

  return (
    <div className="space-y-5 landscape-gap-2">
      {/* Participant Header */}
      <div
        className={`rounded-xl border-2 p-4 landscape-compact ${partyColor ? `${partyColor.bg} ${partyColor.border}` : "bg-gray-50 border-gray-200"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Juror sees name + unique serial # + constituency. School is
                intentionally not shown to jurors. */}
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {participant.serial_no != null && (
                <span className="tabular-nums text-gray-400">
                  #{participant.serial_no}
                  {" · "}
                </span>
              )}
              {participant.full_name}
            </h2>
            {participant.constituency_name && (
              <p className="text-sm text-gray-600 mt-0.5">
                Constituency: {participant.constituency_name}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${roleColor}`}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Score Total Banner — sticky in landscape */}
      <div className="flex items-center justify-between rounded-lg bg-gray-900 px-5 py-3.5 landscape-sticky-top landscape-small-py">
        <span className="text-sm font-medium text-gray-300">Total Score</span>
        <span className="text-2xl font-bold text-white tabular-nums landscape-text-sm">
          {totalScore}
          <span className="text-sm font-normal text-gray-400">/{maxTotal}</span>
        </span>
      </div>

      {/* Criteria Sliders — grouped: evaluation params first, then (only when
          present) a clearly labeled Participation subsection. The total/maxTotal
          math above sums ALL criteria regardless of group, so the running total
          and submit payload are unchanged. When no criterion carries a `kind`
          (role-rubric fallback), everything is treated as evaluation and renders
          as a single ungrouped list exactly as before. */}
      {(() => {
        const participationCriteria = criteria.filter(
          (c) => c.kind === "participation"
        );
        const evaluationCriteria = criteria.filter(
          (c) => c.kind !== "participation"
        );

        return (
          <>
            <div className="space-y-5 landscape-2col">
              {evaluationCriteria.map((criterion) =>
                renderCriterion(criterion)
              )}
            </div>

            {participationCriteria.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Participation
                  </span>
                  <span className="h-px flex-1 bg-indigo-200" />
                </div>
                <div className="space-y-5 landscape-2col">
                  {participationCriteria.map((criterion) =>
                    renderCriterion(criterion)
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Comments */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
          <MessageSquare className="size-4" />
          Comments (optional)
        </label>
        <Textarea
          value={comments}
          onChange={(e) => {
            dirtyRef.current = true;
            setComments(e.target.value);
            setError(null);
          }}
          disabled={isLocked}
          placeholder="Notes about this participant's performance..."
          className="min-h-[80px] text-base"
          rows={3}
        />
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lastSaved && !error && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="size-4" />
          Saved at {lastSaved}
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This score is locked and cannot be edited.
        </div>
      )}

      {isSubmitted && !isLocked && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Score already submitted. You can update it until scoring is locked.
        </div>
      )}

      {/* Action Buttons — always visible in landscape via sticky bottom */}
      {!isLocked && (
        <div className="flex gap-3 pb-4 landscape-compact">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-14 text-base"
            disabled={saving || submitting}
            onClick={() => handleAction("draft")}
          >
            {saving ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <Save className="size-5 mr-2" />
            )}
            Save Draft
          </Button>
          <Button
            type="button"
            className="flex-1 h-14 text-base bg-blue-600 hover:bg-blue-700"
            disabled={saving || submitting}
            onClick={() => handleAction("submitted")}
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <Send className="size-5 mr-2" />
            )}
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

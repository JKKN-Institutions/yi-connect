"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { saveToBuffer, getFromBuffer, removeFromBuffer } from "@/lib/yip/score-buffer";
import { Save, Send, Loader2, CheckCircle2, MessageSquare } from "lucide-react";

// Compact/Detailed view preference — a pure render-layer toggle (no scoring
// semantics involved). Persisted per-device so a juror's choice sticks across
// participants within an event.
const COMPACT_STORAGE_KEY = "yip-scoreform-compact";

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
  // Benchless allocation leaves party_side null but assigns a party number
  // (A–G) — used for a neutral header tint so party identity stays visible.
  party_number?: number | null;
  // No school_name — jurors must never receive it (school-blind scoring).
  ministry?: string | null;
  constituency_name?: string | null;
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
  // When true, this session is scored ONCE and frozen on submit (e.g. the
  // 90-second Constituency Speech): a submitted score becomes read-only, reusing
  // the existing isLocked machinery. Drafts stay editable.
  lockAfterSubmit?: boolean;
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
  lockAfterSubmit,
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
  // Which criteria the juror has deliberately set this session. A criterion
  // counts as "scored" once they interact with it (tapping 0 counts), OR it
  // loaded with a real (>0) value from a saved score/draft. Submit stays blocked
  // until EVERY criterion is scored: a fresh sheet starts all-zero and untouched,
  // so an accidental early Submit can no longer record the un-scored criteria as
  // 0 (which silently counted against the participant in results).
  const [touched, setTouched] = useState<Set<string>>(() => {
    const init = getInitialScores();
    return new Set(
      criteria.filter((c) => (init[c.key] ?? 0) > 0).map((c) => c.key)
    );
  });
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

  // Compact/Detailed view — pure UI state, no bearing on scores/buffer/submit.
  // Starts `true` (compact) so server + first client render always match (no
  // window/localStorage access here — that would cause a hydration mismatch).
  // A post-mount effect below refines this from the juror's saved preference,
  // falling back to "compact on small screens" when nothing is saved yet.
  const [compactMode, setCompactMode] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COMPACT_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setCompactMode(stored === "true");
        return;
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) — keep the default.
    }
    setCompactMode(window.innerWidth < 640);
  }, []);

  const updateCompactMode = useCallback((next: boolean) => {
    setCompactMode(next);
    try {
      window.localStorage.setItem(COMPACT_STORAGE_KEY, String(next));
    } catch {
      // Storage write failed — the toggle still works for this session.
    }
  }, []);

  // Why: only sum keys that belong to the active rubric — defends totals from any leaked
  // foreign keys (legacy dotted sub-criteria) that might have slipped past sanitization.
  const cleanScores = Object.fromEntries(
    criteria.map((c) => [c.key, scores[c.key] ?? 0])
  );
  const totalScore = criteria.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.max_score, 0);
  // Submit is blocked until every criterion has been deliberately scored (tapping
  // 0 counts). Prevents the accidental early-Submit that recorded unscored
  // criteria as 0. Save Draft is unaffected — drafts may be partial.
  const scoredCount = criteria.filter((c) => touched.has(c.key)).length;
  const allScored = scoredCount === criteria.length;
  const unscoredCount = criteria.length - scoredCount;
  const isSubmitted = existingScore?.status === "submitted";
  // lock_on_submit sessions freeze on submit: a submitted score is read-only,
  // reusing every isLocked code path below (disabled inputs, hidden submit
  // button, "locked" notice). The score keeps status='submitted' server-side.
  const isLocked =
    existingScore?.status === "locked" || (lockAfterSubmit === true && isSubmitted);

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

  // FLUSH-ON-UNMOUNT (BUG-393): when the organiser advances the house, the
  // jury screen auto-switches the session and remounts this form (the `key`
  // changes). A pending 500 ms autosave debounce would otherwise be cancelled
  // by the effect above WITHOUT firing, silently dropping unsaved edits for the
  // previous session. Snapshot the latest dirty payload in a ref and write it
  // synchronously on teardown so in-flight input is always preserved.
  const flushSnapshotRef = useRef<(() => void) | null>(null);
  flushSnapshotRef.current = () => {
    if (!dirtyRef.current) return;
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
  };
  useEffect(() => {
    return () => {
      flushSnapshotRef.current?.();
    };
  }, []);

  const handleScoreChange = (key: string, value: number) => {
    if (isLocked) return;
    const criterion = criteria.find((c) => c.key === key);
    if (!criterion) return;
    const clamped = Math.max(0, Math.min(value, criterion.max_score));
    dirtyRef.current = true;
    setTouched((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
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

  // Compact skin for the SAME criterion: one dense row (label + value badge +
  // the identical quick-tap buttons), no description, no slider. Calls the
  // exact same handleScoreChange(criterion.key, ...) as renderCriterion above
  // — same state, same keys, just a denser layout. Whatever shape the caller
  // handed this component (session-parameter leaf criteria, or role-rubric
  // parents that carry an ignored `sub_criteria` field — see renderCriterion,
  // which never reads it either) renders one row per array element here too,
  // so compact mode never invents new sub-criteria handling.
  const renderCriterionCompact = (criterion: Criterion) => {
    const value = scores[criterion.key] ?? 0;

    return (
      <div
        key={criterion.key}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900"
            title={criterion.label}
          >
            {criterion.label}
          </span>
          <span className="shrink-0 text-sm font-bold text-gray-900 tabular-nums">
            {value}
            <span className="text-xs font-normal text-gray-400">
              /{criterion.max_score}
            </span>
          </span>
        </div>

        {/* Quick-tap score buttons — identical control to renderCriterion,
            just slightly narrower; height stays a full 36px touch target. */}
        <div className="flex gap-1 mt-1.5 flex-wrap">
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
                    aria-label={`Score ${val} for ${criterion.label}`}
                    className={`min-w-[32px] h-9 rounded-md text-xs font-medium transition-all
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
                  aria-label={`Score ${i} for ${criterion.label}`}
                  className={`min-w-[32px] h-9 rounded-md text-xs font-medium transition-all
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
  // Header tint: Ruling/Opposition keep their colour; a benchless party (side
  // null but a party number) gets a neutral saffron tint; no party = gray.
  const partyTint = participant.party_side
    ? `${PARTY_COLORS[participant.party_side as keyof typeof PARTY_COLORS].bg} ${PARTY_COLORS[participant.party_side as keyof typeof PARTY_COLORS].border}`
    : participant.party_number != null
      ? "bg-[#FF9933]/5 border-[#FF9933]/30"
      : null;

  return (
    <div className="space-y-5 landscape-gap-2">
      {/* Participant Header */}
      <div
        className={`rounded-xl border-2 p-4 landscape-compact ${partyTint ?? "bg-gray-50 border-gray-200"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Juror sees only the blind participant label (constituency
                number, via juryLabel) + constituency. Real name, school, and
                the roster serial number are intentionally never shown. */}
            <h2 className="text-lg font-bold text-gray-900 truncate">
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

      {/* Compact/Detailed toggle — render-layer only; same scores, same keys,
          same buffer/autosave underneath either mode. */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs font-medium text-gray-500">View</span>
        <div
          role="group"
          aria-label="Scoring view mode"
          className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        >
          <button
            type="button"
            aria-pressed={compactMode}
            onClick={() => updateCompactMode(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              compactMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            aria-pressed={!compactMode}
            onClick={() => updateCompactMode(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              !compactMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {/* Criteria Sliders — grouped: evaluation params first, then (only when
          present) a clearly labeled Participation subsection. The total/maxTotal
          math above sums ALL criteria regardless of group, so the running total
          and submit payload are unchanged. When no criterion carries a `kind`
          (role-rubric fallback), everything is treated as evaluation and renders
          as a single ungrouped list exactly as before. Compact mode reuses the
          identical grouping/filtering — only the per-row renderer changes. */}
      {(() => {
        const participationCriteria = criteria.filter(
          (c) => c.kind === "participation"
        );
        const evaluationCriteria = criteria.filter(
          (c) => c.kind !== "participation"
        );
        const renderRow = compactMode ? renderCriterionCompact : renderCriterion;
        const groupClass = compactMode ? "space-y-2" : "space-y-5 landscape-2col";

        return (
          <>
            <div className={groupClass}>
              {evaluationCriteria.map((criterion) => renderRow(criterion))}
            </div>

            {participationCriteria.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Participation
                  </span>
                  <span className="h-px flex-1 bg-indigo-200" />
                </div>
                <div className={groupClass}>
                  {participationCriteria.map((criterion) => renderRow(criterion))}
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
        <div className="space-y-2 pb-4 landscape-compact">
          {/* Blocked-submit notice: every criterion must be scored before Submit
              (tapping 0 counts). Save Draft stays available for partial sheets. */}
          {!allScored && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Score all {criteria.length} criteria to submit — {unscoredCount}{" "}
              still {unscoredCount === 1 ? "needs" : "need"} a score. Tap{" "}
              <span className="font-semibold">0</span> if a criterion earns
              nothing.
            </div>
          )}
          <div className="flex gap-3">
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
              disabled={saving || submitting || !allScored}
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
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * AI MOMENTS — director control for AI-curated big-screen scenes.
 *
 * Flow per moment: [Generate] enqueues an ai_drafts request AND pings the
 * out-of-band routine awake (~1–2 min to generate; falls back to the every-3h
 * schedule when the live trigger env is unset) → the finished draft appears
 * here as "Ready to review" → the director reads it (and may edit the text) →
 * [Project on screen] copies it into yip.projector_moments, which the venue
 * kiosk polls. NOTHING reaches the projector without that tap.
 *
 * The five scenes:
 *   • Voices of the House — verbatim quotes from members' own questions
 *     (AI only SELECTS; the server copies the exact words from the DB).
 *   • Bill on screen — a chosen bill distilled to 3 bullets.
 *   • What this House cared about — the 3 recurring concerns (closing scene).
 *   • Session intro — a 2-line framing for a chosen agenda item.
 *   • The House is asking — Question-Hour themes so far.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Textarea } from "@/components/yip/ui/textarea";
import { Sparkles, MonitorPlay, Loader2, X } from "lucide-react";
import {
  clearProjectedMoment,
  discardProjectorDraft,
  getProjectorAiState,
  getProjectorTargets,
  projectMomentToScreen,
  requestProjectorMoment,
} from "@/app/yip/actions/projector-moments";
import type { AiDraftRow, ProjectorMomentRow } from "@/lib/yip/ai/types";

const SCENES: { kind: string; label: string; hint: string }[] = [
  {
    kind: "projector_quotes",
    label: "Voices of the House",
    hint: "Members' own questions, verbatim, 20 feet tall",
  },
  {
    kind: "projector_bill_summary",
    label: "Bill on screen",
    hint: "One bill distilled to 3 bullets",
  },
  {
    kind: "projector_house_mind",
    label: "What this House cared about",
    hint: "The 3 recurring concerns — closing scene",
  },
  {
    kind: "projector_framing",
    label: "Session intro",
    hint: "A 2-line framing for an agenda item",
  },
  {
    kind: "projector_qh_themes",
    label: "The House is asking",
    hint: "Question-Hour themes so far",
  },
];

/** The two kinds that need a picked target (everything else is event-level). */
const TARGET_KINDS: Record<string, "bill" | "agenda"> = {
  projector_bill_summary: "bill",
  projector_framing: "agenda",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Generating…",
  generating: "Generating…",
  pending_review: "Ready to review",
  approved: "Projected earlier",
  rejected: "Discarded",
  ready: "Ready to review",
};

export function AiMomentsCard({ eventId }: { eventId: string }) {
  const [drafts, setDrafts] = useState<AiDraftRow[]>([]);
  const [projected, setProjected] = useState<ProjectorMomentRow | null>(null);
  const [liveConfigured, setLiveConfigured] = useState(false);
  const [bills, setBills] = useState<{ id: string; title: string }[]>([]);
  const [agendaItems, setAgendaItems] = useState<
    { id: string; title: string; day: number | null }[]
  >([]);
  const [target, setTarget] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<AiDraftRow | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await getProjectorAiState(eventId);
    if (res.success) {
      setDrafts(res.drafts);
      setProjected(res.projected);
      setLiveConfigured(res.liveTriggerConfigured);
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
    getProjectorTargets(eventId).then((res) => {
      if (res.success) {
        setBills(res.bills);
        setAgendaItems(res.agendaItems);
      }
    });
  }, [eventId, refresh]);

  // While anything is generating, poll for the finished draft.
  const hasInFlight = drafts.some(
    (d) => d.status === "requested" || d.status === "generating"
  );
  useEffect(() => {
    if (!hasInFlight) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [hasInFlight, refresh]);

  function generate(kind: string) {
    setError(null);
    setNotice(null);
    const subjectId = TARGET_KINDS[kind] ? (target[kind] ?? "") : null;
    if (TARGET_KINDS[kind] && !subjectId) {
      setError("Pick a target first.");
      return;
    }
    startTransition(async () => {
      const res = await requestProjectorMoment(eventId, kind, subjectId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setNotice(
        res.pinged
          ? "Generating now — ready to review in about a minute or two."
          : "Queued. It will generate on the routine's next scheduled run (or press Run now on the routine)."
      );
      refresh();
    });
  }

  function openReview(draft: AiDraftRow) {
    setReviewing(draft);
    setReviewText(draft.draft_text ?? "");
    setError(null);
  }

  function project() {
    if (!reviewing) return;
    setError(null);
    startTransition(async () => {
      const res = await projectMomentToScreen(
        eventId,
        reviewing.id,
        reviewText
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setReviewing(null);
      setNotice("On screen now.");
      refresh();
    });
  }

  function discard(draftId: string) {
    startTransition(async () => {
      const res = await discardProjectorDraft(eventId, draftId);
      if (!res.success) setError(res.error);
      setReviewing(null);
      refresh();
    });
  }

  function clearScreen() {
    startTransition(async () => {
      const res = await clearProjectedMoment(eventId);
      if (!res.success) setError(res.error);
      setNotice("Screen cleared — back to the normal display.");
      refresh();
    });
  }

  const sceneLabel = (kind: string) =>
    SCENES.find((s) => s.kind === kind)?.label ?? kind;

  const reviewIsQuotes = reviewing?.kind === "projector_quotes";
  const quoteRefs =
    reviewing?.source_refs?.filter((r) => r.type === "question") ?? [];

  return (
    <Card className="border-violet-200/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4" />
          AI Moments (Projector)
          {!liveConfigured && (
            <Badge variant="outline" className="text-[10px] font-normal">
              live trigger not configured — generates on the 3-hour schedule
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Currently on screen */}
        {projected && (
          <div className="flex items-center justify-between rounded border border-violet-200 bg-violet-50 p-2 text-xs">
            <span className="flex items-center gap-2 text-violet-800">
              <span className="inline-block size-2 rounded-full bg-violet-600 animate-pulse" />
              On screen: <strong>{sceneLabel(projected.kind)}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={clearScreen}
              disabled={pending}
            >
              Clear screen
            </Button>
          </div>
        )}

        {/* Generate buttons */}
        <div className="grid gap-2 sm:grid-cols-2">
          {SCENES.map((scene) => {
            const picker = TARGET_KINDS[scene.kind];
            const draft = drafts.find((d) => d.kind === scene.kind);
            const inFlight =
              draft &&
              (draft.status === "requested" || draft.status === "generating");
            return (
              <div
                key={scene.kind}
                className="rounded border border-[#1a1a3e]/10 p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{scene.label}</p>
                    <p className="text-[11px] text-[#1a1a3e]/60">
                      {scene.hint}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    disabled={pending || !!inFlight}
                    onClick={() => generate(scene.kind)}
                  >
                    {inFlight ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                    {inFlight ? "Generating" : "Generate"}
                  </Button>
                </div>
                {picker && (
                  <select
                    className="w-full rounded border border-[#1a1a3e]/15 bg-white px-2 py-1 text-xs"
                    value={target[scene.kind] ?? ""}
                    onChange={(e) =>
                      setTarget((t) => ({ ...t, [scene.kind]: e.target.value }))
                    }
                  >
                    <option value="">
                      {picker === "bill" ? "Choose a bill…" : "Choose a session…"}
                    </option>
                    {(picker === "bill" ? bills : agendaItems).map((o) => (
                      <option key={o.id} value={o.id}>
                        {"day" in o && o.day ? `Day ${o.day} — ` : ""}
                        {o.title}
                      </option>
                    ))}
                  </select>
                )}
                {draft && !inFlight && draft.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => openReview(draft)}
                    className="w-full rounded bg-violet-50 border border-violet-200 px-2 py-1 text-left text-[11px] text-violet-800 hover:bg-violet-100"
                  >
                    {STATUS_LABEL[draft.status] ?? draft.status} — tap to review
                    &amp; project
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Review + project */}
        {reviewing && (
          <div className="rounded border border-violet-300 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Review: {sceneLabel(reviewing.kind)}
              </p>
              <button
                type="button"
                onClick={() => setReviewing(null)}
                className="text-[#1a1a3e]/50 hover:text-[#1a1a3e]"
              >
                <X className="size-4" />
              </button>
            </div>
            {reviewIsQuotes ? (
              <div className="space-y-1 text-xs">
                <p className="text-[#1a1a3e]/70">
                  The AI picked {quoteRefs.length} member questions. Their
                  VERBATIM text (copied straight from the database, never
                  reworded) will rotate on screen:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {quoteRefs.map((r) => (
                    <li key={r.id}>{r.label}</li>
                  ))}
                </ul>
                {reviewing.draft_text && (
                  <p className="italic text-[#1a1a3e]/60">
                    {reviewing.draft_text}
                  </p>
                )}
              </div>
            ) : (
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="min-h-[110px] text-sm"
                disabled={pending}
              />
            )}
            <div className="flex gap-2">
              <Button
                onClick={project}
                disabled={pending}
                className="flex-1 gap-1.5"
              >
                <MonitorPlay className="size-3.5" />
                Project on screen
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => discard(reviewing.id)}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 text-red-700 text-xs p-2">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="rounded border border-violet-200 bg-violet-50 text-violet-800 text-xs p-2">
            {notice}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

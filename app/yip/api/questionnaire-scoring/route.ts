/**
 * Bearer-protected endpoint for the OUT-OF-BAND questionnaire scorer.
 *
 * The prod app NEVER calls an LLM — docs/yip-ai-routine.md states that as a YIP
 * rule, because these surfaces involve minors and the decisions must be
 * dispute-proof. So a submitted questionnaire is queued, and the same external
 * routine that services yip.ai_drafts scores it off-platform:
 *
 *   GET  → claims submitted-but-unscored attempts and returns each one's
 *          questions and answers, plus the rubric to score them against.
 *   POST → writes back per-answer marks, or records a failure.
 *
 * Auth: the shared secret in `X-Cron-Secret`, compared to
 * process.env.YIP_AI_ROUTINE_SECRET, exactly as app/yip/api/ai-drafts/route.ts.
 * Fails closed when the secret is unset. The caller is trusted ONLY for the
 * secret — every score it sends back is clamped to the rubric's own ranges
 * server-side before it is written.
 *
 * THE SCORE ONLY ADVISES. Nothing here promotes a candidate, assigns a role or
 * drops anybody; a human confirms the shortlist (Director, 2026-08-15).
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  applyAttemptScores,
  claimScoringWork,
  markAttemptScoringFailed,
  type ScoredAnswerInput,
} from "@/lib/yip/questionnaire-scoring";
import {
  MAX_PER_ANSWER,
  RED_FLAGS,
  RUBRIC_SYSTEM_INSTRUCTIONS,
  questionnairePostLabel,
} from "@/lib/yip/questionnaire";

// Live DB reads and writes — never cache.
export const dynamic = "force-dynamic";
// A drain builds and writes marks for up to 25 attempts; give it real headroom.
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.YIP_AI_ROUTINE_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 25;

  try {
    const work = await claimScoringWork(limit);
    return NextResponse.json({
      rubric: RUBRIC_SYSTEM_INSTRUCTIONS,
      redFlags: RED_FLAGS,
      maxPerAnswer: MAX_PER_ANSWER,
      count: work.length,
      work: work.map((w) => ({
        attemptId: w.attemptId,
        post: questionnairePostLabel(w.post),
        answers: w.answers,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "drain failed" },
      { status: 500 }
    );
  }
}

type PostBody = {
  attemptId?: unknown;
  error?: unknown;
  answers?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  if (!attemptId) {
    return NextResponse.json({ error: "attemptId required" }, { status: 400 });
  }

  // The routine reporting its own failure. Recorded rather than retried, so the
  // answers survive and an organiser can re-queue the one attempt.
  if (typeof body.error === "string" && body.error.trim() !== "") {
    await markAttemptScoringFailed(attemptId, body.error);
    return NextResponse.json({ ok: true, recorded: "failed" });
  }

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "answers required" }, { status: 400 });
  }

  const answers: ScoredAnswerInput[] = [];
  for (const raw of body.answers) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const position = Number(a.position);
    if (!Number.isFinite(position)) continue;
    answers.push({
      position,
      grounding: Number(a.grounding),
      depth: Number(a.depth),
      voice: Number(a.voice),
      redFlagPenalty: Number(a.redFlagPenalty ?? a.red_flag_penalty ?? 0),
      flags: Array.isArray(a.flags)
        ? a.flags.filter((f): f is string => typeof f === "string")
        : [],
    });
  }

  if (answers.length === 0) {
    return NextResponse.json({ error: "no scorable answers" }, { status: 400 });
  }

  const res = await applyAttemptScores(attemptId, answers);
  if (!res.ok) {
    await markAttemptScoringFailed(attemptId, res.error);
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    attemptId,
    total: res.total,
    max: res.max,
    pct: res.pct,
  });
}

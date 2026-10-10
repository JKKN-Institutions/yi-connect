/**
 * Take Pride AI drain endpoint, for the OUT-OF-BAND claude.ai routine.
 *
 * The production app NEVER calls an LLM and holds no AI key. Delegates queue
 * jobs (tp_ai_jobs); the routine:
 *   GET  -> claims up to 20 pending jobs (pending -> generating) and receives
 *           each with the grounding it needs, and nothing more.
 *   POST -> { job_id, output } stores a checked, clamped result (-> ready),
 *           or { job_id, error } marks the job failed.
 *
 * Auth: header X-Cron-Secret must equal process.env.YIP_AI_ROUTINE_SECRET
 * (timing-safe). FAIL CLOSED: an unset secret denies every call.
 * Routine instructions: docs/take-pride-ai-routine.md.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildGrounding } from "@/lib/take-pride/ai/grounding";
import {
  claimJobs,
  completeJob,
  failJob,
  getJobForRoutine,
  pinAllowed,
  queueNightlyRadar,
  resetStaleJobs,
} from "@/lib/take-pride/ai/queue";
import { isUuid, validateOutput } from "@/lib/take-pride/ai/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.YIP_AI_ROUTINE_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const given = request.headers.get("x-cron-secret");
  if (!given) return false;
  // Compare fixed-length digests so neither length nor content leaks by timing.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return unauthorized();

  // Housekeeping first; neither may block the drain.
  let reset = 0;
  let nightly = 0;
  try {
    reset = await resetStaleJobs();
  } catch {}
  try {
    nightly = await queueNightlyRadar();
  } catch {}

  const claimed = await claimJobs();
  const jobs: { job_id: string; kind: string; grounding: Record<string, unknown> }[] = [];
  for (const job of claimed) {
    try {
      const built = await buildGrounding(job);
      if (!built) {
        await failJob(job.id, "Delegate not found");
        continue;
      }
      if (!(await pinAllowed(job.id, built.allowed))) {
        // Without pinned ids every id would be dropped on POST, so do not hand it out.
        await failJob(job.id, "Could not pin grounding ids");
        continue;
      }
      jobs.push({ job_id: job.id, kind: job.kind, grounding: built.grounding });
    } catch {
      await failJob(job.id, "Grounding could not be built");
    }
  }

  return NextResponse.json(
    { count: jobs.length, jobs, reset_stale: reset, queued_nightly_radar: nightly },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { job_id?: unknown; output?: unknown; error?: unknown };
  if (!isUuid(b.job_id)) return NextResponse.json({ error: "job_id must be a job id" }, { status: 400 });

  const job = await getJobForRoutine(b.job_id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "generating") {
    return NextResponse.json({ error: `Job is ${job.status}, not claimed. GET again for fresh work.` }, { status: 409 });
  }

  if (b.output === undefined) {
    const reason = typeof b.error === "string" && b.error.trim() ? b.error.trim() : "Routine gave up";
    const ok = await failJob(job.id, `Routine: ${reason}`);
    return ok
      ? NextResponse.json({ ok: true, status: "failed" })
      : NextResponse.json({ error: "Job changed while saving" }, { status: 409 });
  }

  const v = validateOutput(job.kind, b.output, job.allowed);
  if (!v.ok) {
    await failJob(job.id, v.error);
    return NextResponse.json({ error: v.error, status: "failed" }, { status: 422 });
  }
  const saved = await completeJob(job.id, v.output);
  if (!saved) return NextResponse.json({ error: "Job changed while saving" }, { status: 409 });
  return NextResponse.json({ ok: true, status: "ready", dropped: v.dropped });
}

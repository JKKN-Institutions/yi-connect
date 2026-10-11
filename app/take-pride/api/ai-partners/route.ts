/**
 * Take Pride partner-side AI drain endpoint, for the OUT-OF-BAND claude.ai
 * routine (meeting briefs and lead follow-ups for Catalyst Partners, sales
 * chasers for organisers).
 *
 * The production app NEVER calls an LLM and holds no AI key. Jobs wait in
 * tp_partner_ai_jobs; the routine:
 *   GET  -> claims up to 20 pending jobs (pending -> generating) and receives
 *           each with the grounding it needs, and nothing more.
 *   POST -> { job_id, output } stores a checked, clamped result (-> ready),
 *           or { job_id, error } marks the job failed.
 *
 * Auth: header X-Cron-Secret must equal process.env.YIP_AI_ROUTINE_SECRET
 * (timing-safe). FAIL CLOSED: an unset secret denies every call.
 * Routine instructions: docs/take-pride-ai-routine.md, "Partner, card and
 * coach jobs".
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildPartnerJobGrounding } from "@/lib/take-pride/ai-partners/load";
import {
  claimPartnerJobs,
  completePartnerJob,
  failPartnerJob,
  getPartnerJobForRoutine,
  pinPartnerAllowed,
  resetStalePartnerJobs,
} from "@/lib/take-pride/ai-partners/queue";
import { validatePartnerOutput } from "@/lib/take-pride/ai-partners/schemas";
import { isUuid } from "@/lib/take-pride/ai/schemas";

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

  let reset = 0;
  try {
    reset = await resetStalePartnerJobs();
  } catch {}

  const claimed = await claimPartnerJobs();
  const jobs: { job_id: string; kind: string; grounding: Record<string, unknown> }[] = [];
  for (const job of claimed) {
    try {
      const r = await buildPartnerJobGrounding(job);
      if (!r.ok) {
        await failPartnerJob(job.id, r.reason);
        continue;
      }
      if (!(await pinPartnerAllowed(job.id, r.built.allowed))) {
        // Without the pinned person the POST could not be checked, so do not hand it out.
        await failPartnerJob(job.id, "Could not pin grounding ids");
        continue;
      }
      jobs.push({ job_id: job.id, kind: job.kind, grounding: r.built.grounding });
    } catch {
      await failPartnerJob(job.id, "Grounding could not be built");
    }
  }

  return NextResponse.json({ count: jobs.length, jobs, reset_stale: reset }, { headers: { "Cache-Control": "no-store" } });
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

  const job = await getPartnerJobForRoutine(b.job_id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "generating") {
    return NextResponse.json({ error: `Job is ${job.status}, not claimed. GET again for fresh work.` }, { status: 409 });
  }

  if (b.output === undefined) {
    const reason = typeof b.error === "string" && b.error.trim() ? b.error.trim() : "Routine gave up";
    const ok = await failPartnerJob(job.id, `Routine: ${reason}`);
    return ok
      ? NextResponse.json({ ok: true, status: "failed" })
      : NextResponse.json({ error: "Job changed while saving" }, { status: 409 });
  }

  const v = validatePartnerOutput(job.kind, b.output, job.allowed);
  if (!v.ok) {
    await failPartnerJob(job.id, v.error);
    return NextResponse.json({ error: v.error, status: "failed" }, { status: 422 });
  }
  const saved = await completePartnerJob(job.id, v.output);
  if (!saved) return NextResponse.json({ error: "Job changed while saving" }, { status: 409 });
  return NextResponse.json({ ok: true, status: "ready", dropped: v.dropped });
}

/**
 * GET /yiq/api/cron/drain-emails
 *
 * Sweeps yiq.email_queue and sends the access-code emails. Ports the house
 * drain pattern (app/youth-academy/api/cron/drain-emails/route.ts, itself a
 * clone of the yi-future donor) into yiq, with the yip hardening: the queue
 * row carries NO access code, so every email is RE-RENDERED from the live
 * yiq.students rows at send time through lib/yiq/email/templates.ts.
 *
 * Auth: `X-Cron-Secret: <CRON_SECRET>` (manual curl) OR
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron itself sends).
 * FAILS CLOSED: an unset CRON_SECRET rejects every request.
 *
 * CLAIM BEFORE SEND: a row is flipped pending -> sending guarded by
 * `.eq("status","pending")` BEFORE Resend is called, and only a row whose
 * update actually returned is handed out. Two overlapping runs therefore
 * cannot send the same email twice. A run that dies mid-flight leaves rows
 * stuck in 'sending'; the next run reclaims anything claimed more than
 * STUCK_MINUTES ago.
 *
 * ── OPERATOR NOTE: "the codes never arrived" ──────────────────────────────
 * Resend on this account has had NO VERIFIED SENDING DOMAIN, and the local
 * key is test-mode. That is an env/domain matter, not a queue bug. Tell the
 * two cases apart by querying yiq.email_queue directly:
 *
 *   status='failed' with last_error like 'Resend 4xx%' / 'domain is not
 *     verified' / 'RESEND_API_KEY not set'
 *       -> the queue worked. Delivery is blocked upstream: verify the
 *          sending domain in Resend and set FROM_EMAIL to an address on it.
 *   status='pending' with attempts = 0 and rows piling up
 *       -> the drain is not running. Check the cron entry in vercel.json and
 *          that CRON_SECRET is set in the Vercel project.
 *   NO ROWS AT ALL for that team
 *       -> nothing was ever enqueued. The registration action did not call
 *          enqueueTeamCodeEmails, or it returned ok:false (it logs a reason).
 *
 * Returns JSON: { drained, sent, failed, retrying, reclaimed }
 */

import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import {
  loadTeamEmailContext,
  type YiqTeamEmailContext,
} from "@/lib/yiq/email/queue";
import {
  isValidYiqEmail,
  renderStudentCodeEmail,
  renderTeacherCodesEmail,
  type YiqRenderedEmail,
} from "@/lib/yiq/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Terminal-failure threshold — after 5 attempts a row is marked 'failed'. */
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
/** Bounded parallelism: enough to clear a batch, gentle on the provider. */
const CONCURRENCY = 4;
/** A row claimed longer ago than this belonged to a run that died. */
const STUCK_MINUTES = 10;

type QueueRow = {
  id: string;
  kind: string;
  recipient: string;
  team_id: string | null;
  student_id: string | null;
  attempts: number;
};

type PgErrLite = { message: string } | null;

/**
 * Narrow structural accessor for yiq.email_queue — the table is not in
 * types/yiq/database.ts (never regenerated for this migration). Same shape as
 * the votesTable / formationEmailsTable pattern used elsewhere in this repo:
 * one untyped surface, kept file-local, with every other read fully typed.
 */
type QueueTable = {
  select: (cols: string) => QueueTable;
  update: (row: Record<string, unknown>) => QueueTable;
  eq: (col: string, val: unknown) => QueueTable;
  lt: (col: string, val: unknown) => QueueTable;
  in: (col: string, vals: unknown[]) => QueueTable;
  order: (col: string, opts?: { ascending?: boolean }) => QueueTable;
  limit: (n: number) => QueueTable;
  then: Promise<{ data: unknown; error: PgErrLite }>["then"];
};
function queueTable(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): QueueTable {
  return (svc as unknown as { from: (t: string) => QueueTable }).from(
    "email_queue"
  );
}

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ tag: "yiq_email_drain", ...fields }));
}

/**
 * Rebuild the message from LIVE rows. Returns null when the row can no longer
 * produce an email (team deleted, student removed, address unusable) — the
 * caller marks those terminally failed rather than retrying forever.
 */
function renderFromContext(
  row: QueueRow,
  ctx: YiqTeamEmailContext
): { email: YiqRenderedEmail; to: string } | null {
  if (row.kind === "student_code") {
    const student = ctx.students.find((s) => s.id === row.student_id);
    if (!student) return null;
    // Prefer the student's CURRENT address — it may have been corrected since
    // enqueue — and fall back to what was recorded at enqueue time.
    const to = isValidYiqEmail(student.email)
      ? student.email!.trim()
      : row.recipient;
    if (!isValidYiqEmail(to)) return null;
    return {
      to,
      email: renderStudentCodeEmail({
        studentName: student.fullName,
        accessCode: student.accessCode,
        classLevel: student.classLevel,
        teamName: ctx.team.name,
        teamCode: ctx.team.teamCode,
        schoolName: ctx.school.name,
        chapterName: ctx.chapter.name,
        category: ctx.team.category,
        roundOpensAt: ctx.chapter.roundOpensAt,
      }),
    };
  }

  // team_codes_teacher
  const to = isValidYiqEmail(ctx.school.contactEmail)
    ? ctx.school.contactEmail.trim()
    : row.recipient;
  if (!isValidYiqEmail(to)) return null;
  return {
    to,
    email: renderTeacherCodesEmail({
      teacherName: ctx.school.contactPerson,
      teamName: ctx.team.name,
      teamCode: ctx.team.teamCode,
      schoolName: ctx.school.name,
      chapterName: ctx.chapter.name,
      category: ctx.team.category,
      roundOpensAt: ctx.chapter.roundOpensAt,
      members: ctx.students.map((s) => ({
        fullName: s.fullName,
        classLevel: s.classLevel,
        email: s.email,
        accessCode: s.accessCode,
      })),
    }),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth. Fail closed when CRON_SECRET is unset. ──────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  const authorized =
    !!cronSecret &&
    (incomingSecret === cronSecret || bearer === `Bearer ${cronSecret}`);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const startedAt = Date.now();

  // ── 0. Reclaim rows a dead run left claimed ──────────────────────────────
  const stuckCutoff = new Date(
    Date.now() - STUCK_MINUTES * 60 * 1000
  ).toISOString();
  let reclaimed = 0;
  {
    const { data, error } = (await queueTable(svc)
      .update({ status: "pending", claimed_at: null })
      .eq("status", "sending")
      .lt("claimed_at", stuckCutoff)
      .select("id")) as unknown as {
      data: { id: string }[] | null;
      error: PgErrLite;
    };
    if (error) log({ step: "reclaim", error: error.message });
    else reclaimed = (data ?? []).length;
  }

  // ── 1. Fetch a bounded batch, oldest first ───────────────────────────────
  const { data: rawRows, error: fetchError } = (await queueTable(svc)
    .select("id, kind, recipient, team_id, student_id, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)) as unknown as {
    data: QueueRow[] | null;
    error: PgErrLite;
  };

  if (fetchError) {
    log({ step: "fetch", error: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const candidates = rawRows ?? [];
  let sent = 0;
  let failed = 0; // reached MAX_ATTEMPTS -> terminal
  let retrying = 0; // failed this run, back to 'pending' for the next sweep
  let claimedCount = 0;

  // Many rows share a team — load each team's context once per run. The
  // PROMISE is cached, not the value, so two parallel workers that miss
  // together still issue only one set of reads.
  const contextCache = new Map<string, Promise<YiqTeamEmailContext | null>>();
  function contextFor(teamId: string): Promise<YiqTeamEmailContext | null> {
    let pending = contextCache.get(teamId);
    if (!pending) {
      pending = loadTeamEmailContext(svc, teamId);
      contextCache.set(teamId, pending);
    }
    return pending;
  }

  // `attempts` is bumped at CLAIM time, not here — see processOne. That is
  // what stops a row which crashes the drain mid-flight from being reclaimed
  // and retried forever without ever reaching MAX_ATTEMPTS.
  const settle = async (
    row: QueueRow,
    outcome: { ok: boolean; error?: string; terminal?: boolean }
  ) => {
    const attempts = row.attempts + 1;
    if (outcome.ok) {
      await queueTable(svc)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      sent++;
      return;
    }
    const terminal = outcome.terminal === true || attempts >= MAX_ATTEMPTS;
    await queueTable(svc)
      .update({
        // Below the cap the row goes back to 'pending' so the next run
        // retries it. Above it, or on an unrenderable row, it is terminal.
        status: terminal ? "failed" : "pending",
        claimed_at: null,
        last_error: outcome.error ?? "unknown send failure",
      })
      .eq("id", row.id);
    if (terminal) failed++;
    else retrying++;
    log({
      step: "row_failed",
      id: row.id,
      kind: row.kind,
      attempt: attempts,
      max: MAX_ATTEMPTS,
      terminal,
      error: outcome.error,
    });
  };

  const processOne = async (row: QueueRow) => {
    // ── CLAIM. Guarded by status='pending' so an overlapping run that
    //    already took this row loses the race and we skip it entirely.
    //    `attempts` is bumped HERE so that even a row which kills the drain
    //    before it can be settled still burns an attempt and eventually goes
    //    terminal, instead of being reclaimed and retried forever.
    const { data: claimed, error: claimError } = (await queueTable(svc)
      .update({
        status: "sending",
        claimed_at: new Date().toISOString(),
        attempts: row.attempts + 1,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")) as unknown as {
      data: { id: string }[] | null;
      error: PgErrLite;
    };
    if (claimError) {
      log({ step: "claim", id: row.id, error: claimError.message });
      return;
    }
    if (!claimed || claimed.length === 0) return; // another run has it
    claimedCount++;

    if (!row.team_id) {
      await settle(row, { ok: false, error: "Queue row has no team", terminal: true });
      return;
    }
    const ctx = await contextFor(row.team_id);
    if (!ctx) {
      await settle(row, {
        ok: false,
        error: "Team no longer exists",
        terminal: true,
      });
      return;
    }

    const rendered = renderFromContext(row, ctx);
    if (!rendered) {
      await settle(row, {
        ok: false,
        error:
          row.kind === "student_code"
            ? "Student removed, or no usable email address"
            : "No usable teacher email address",
        terminal: true,
      });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      // Recorded distinctly and never as success — donor semantics. Stays
      // retryable so a key added later drains the backlog.
      await settle(row, { ok: false, error: "RESEND_API_KEY not set" });
      return;
    }

    const result = await sendEmail({
      to: rendered.to,
      subject: rendered.email.subject,
      html: rendered.email.html,
      text: rendered.email.text,
    });

    await settle(
      row,
      result.success
        ? { ok: true }
        : { ok: false, error: result.error ?? "unknown send failure" }
    );
  };

  // ── 2. Bounded parallelism: CONCURRENCY workers over one shared cursor ───
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, candidates.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= candidates.length) return;
        try {
          await processOne(candidates[index]);
        } catch (e) {
          // One poisoned row must never kill the whole sweep.
          log({
            step: "row_threw",
            id: candidates[index]?.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  );
  await Promise.all(workers);

  const summary = {
    drained: claimedCount,
    sent,
    failed,
    retrying,
    reclaimed,
  };
  log({
    step: "done",
    ...summary,
    candidates: candidates.length,
    ms: Date.now() - startedAt,
  });

  return NextResponse.json(summary);
}

"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — cohort message thread actions (Phase 12).
//
// One thread per run (yuva.threads, UNIQUE run_id). Membership gate is
// computed ONCE per call in resolveThreadCaller():
//   - student  : getStudentSession() cookie + LIVE enrollment lookup in the
//                thread's run (dropped students lose access on the next
//                request — never trusted from the cookie)
//   - mentor   : assigned to ≥1 session of the run (run_sessions.
//                mentor_person_id = funnel person)
//   - manager  : getYuvaAccess().canManageRun — sender_kind 'chapter' when
//                chapter-scoped to the run's chapter, 'national' when
//                isNational and not chapter-scoped, 'institution' when a
//                bound coordinator
//
// Donor pattern: app/yi-future/actions/messages.ts (gate → service-client
// write → revalidatePath). Chat messages are intentionally NOT audit-logged
// (logYuvaAudit is for management mutations, not conversation).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/yuva/action-result";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import {
  fetchCohortMessages,
  type CohortMessage,
  type CohortSenderKind,
} from "@/components/yuva/messages/data";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const DENIED_ERROR = "You are not a member of this cohort thread.";
const NOT_FOUND_ERROR = "Program run not found.";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CohortThread = {
  id: string;
  run_id: string;
  created_at: string;
};

export type ThreadViewer = {
  personId: string;
  senderKind: CohortSenderKind;
};

type ThreadCaller =
  | { ok: true; personId: string; senderKind: CohortSenderKind }
  | { ok: false; error: string };

// ─── Membership gate (computed ONCE per action call) ──────────────────────

async function resolveThreadCaller(
  svc: Svc,
  runId: string
): Promise<ThreadCaller> {
  if (!UUID_RE.test(runId)) {
    return { ok: false, error: NOT_FOUND_ERROR };
  }

  const { data: run, error: runError } = await svc
    .from("runs")
    .select("id, chapter, academy_id")
    .eq("id", runId)
    .maybeSingle();
  if (runError || !run) {
    return { ok: false, error: NOT_FOUND_ERROR };
  }

  // Path 1 — student (signed cookie + LIVE enrollment; dropped excluded).
  const student = await getStudentSession();
  if (student) {
    const { data: enrollment, error } = await svc
      .from("enrollments")
      .select("id")
      .eq("person_id", student.personId)
      .eq("run_id", runId)
      .in("status", ["active", "completed"])
      .limit(1);
    if (!error && (enrollment ?? []).length > 0) {
      return { ok: true, personId: student.personId, senderKind: "student" };
    }
    // Not enrolled in THIS run — fall through to the staff paths (a staff
    // member could hold a stale student cookie; fail closed otherwise).
  }

  // Paths 2 + 3 — OAuth staff. ONE funnel read via getYuvaAccess.
  const access = await getYuvaAccess();
  if (access.personId) {
    // Path 2 — mentor assigned to ≥1 session of this run.
    const { data: assigned, error: assignedError } = await svc
      .from("run_sessions")
      .select("id")
      .eq("run_id", runId)
      .eq("mentor_person_id", access.personId)
      .limit(1);
    if (!assignedError && (assigned ?? []).length > 0) {
      return { ok: true, personId: access.personId, senderKind: "mentor" };
    }

    // Path 3 — run manager (national / owning chapter / bound coordinator).
    if (
      access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
    ) {
      const chapterScoped =
        access.chapterAdminOf !== null &&
        access.chapterAdminOf === (run.chapter ?? "").trim();
      const senderKind: CohortSenderKind = chapterScoped
        ? "chapter"
        : access.isNational
          ? "national"
          : "institution";
      return { ok: true, personId: access.personId, senderKind };
    }
  }

  return { ok: false, error: DENIED_ERROR };
}

// ─── Thread row (insert-ignore-23505 — covers pre-formation runs) ─────────

async function ensureThread(
  svc: Svc,
  runId: string
): Promise<CohortThread | null> {
  const { data: existing } = await svc
    .from("threads")
    .select("id, run_id, created_at")
    .eq("run_id", runId)
    .maybeSingle();
  if (existing) return existing;

  const { data: inserted, error } = await svc
    .from("threads")
    .insert({ run_id: runId })
    .select("id, run_id, created_at")
    .maybeSingle();
  if (inserted) return inserted;

  // 23505 = a concurrent caller (or cohort formation) created it first.
  if ((error as { code?: string } | null)?.code === "23505") {
    const { data: raced } = await svc
      .from("threads")
      .select("id, run_id, created_at")
      .eq("run_id", runId)
      .maybeSingle();
    return raced ?? null;
  }

  console.error("[yuva-messages] thread create failed:", error?.message);
  return null;
}

// ─── 1. Get or create the cohort thread ───────────────────────────────────

export async function getOrCreateCohortThread(
  runId: string
): Promise<ActionResult<CohortThread>> {
  const svc = await createServiceClient();
  const caller = await resolveThreadCaller(svc, runId);
  if (!caller.ok) return { success: false, error: caller.error };

  const thread = await ensureThread(svc, runId);
  if (!thread) {
    return { success: false, error: "Could not open the cohort thread." };
  }
  return { success: true, data: thread };
}

// ─── 2. Send a message ─────────────────────────────────────────────────────

const MESSAGE_MAX_LENGTH = 2000;

export async function sendCohortMessage(
  runId: string,
  body: string
): Promise<ActionResult<{ id: string; createdAt: string }>> {
  const svc = await createServiceClient();
  const caller = await resolveThreadCaller(svc, runId);
  if (!caller.ok) return { success: false, error: caller.error };

  const trimmed = (body ?? "").trim();
  if (!trimmed) {
    return { success: false, error: "Message is empty." };
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return {
      success: false,
      error: `Message is too long — keep it under ${MESSAGE_MAX_LENGTH} characters.`,
    };
  }

  const thread = await ensureThread(svc, runId);
  if (!thread) {
    return { success: false, error: "Could not open the cohort thread." };
  }

  const { data: inserted, error } = await svc
    .from("messages")
    .insert({
      thread_id: thread.id,
      sender_person_id: caller.personId,
      sender_kind: caller.senderKind,
      body: trimmed,
    })
    .select("id, created_at")
    .maybeSingle();
  if (error || !inserted) {
    console.error("[yuva-messages] send failed:", error?.message);
    return { success: false, error: "Could not send the message. Try again." };
  }

  // No audit for chat messages (by design — see header).
  revalidatePath(`/youth-academy/me/messages/${runId}`);
  revalidatePath(`/youth-academy/mentor/cohorts/${runId}`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}/cohort`);

  return {
    success: true,
    data: { id: inserted.id, createdAt: inserted.created_at },
  };
}

// ─── 3. List messages (ascending window) ──────────────────────────────────

export async function listCohortMessages(
  runId: string,
  opts?: { before?: string; limit?: number }
): Promise<
  ActionResult<{
    threadId: string | null;
    messages: CohortMessage[];
    viewer: ThreadViewer;
  }>
> {
  const svc = await createServiceClient();
  const caller = await resolveThreadCaller(svc, runId);
  if (!caller.ok) return { success: false, error: caller.error };

  const { threadId, messages } = await fetchCohortMessages(runId, opts);
  return {
    success: true,
    data: {
      threadId,
      messages,
      viewer: { personId: caller.personId, senderKind: caller.senderKind },
    },
  };
}

"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — run actions (Phase 7).
//
// Spec: docs/yi-youth-academy-spec.md → "Chapter / Institution — runs
// (program scheduling)" + Server Actions Inventory row `actions/runs.ts`.
//
// 9 exported functions: createRun, updateRunSettings, scheduleSession,
// assignSessionMentor, publishRun, closeApplications, unpublishRun,
// completeRun, markSessionCompleted (+ internal notifyScheduleChange).
//
// Contract (every function): gate-first via getYuvaAccess().canManageRun —
// the run gate admits national, the owning chapter's admin, AND the bound
// institution coordinator (coordinators co-manage RUNS; the academy record
// stays chapter/national-owned). createRun gates on the TARGET academy's
// {academy_id, chapter} ref since the run doesn't exist yet. Then:
// service-client write → logYuvaAudit → revalidatePath → ActionResult.
// Expected failures return { success:false, error } — NEVER a throw,
// NEVER a silent redirect.
//
// Lifecycle: every status write goes through lib/yuva/run-machine.ts
// (canTransitionRun / validatePublish) — no raw status writes (binding
// constraint #5). Soft-cap semantics: capacity overrun, out-of-range
// sessions, mentor double-booking and venue overlap are WARNINGS
// (success with `warning`), never blocks.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getYuvaAccess, type YuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { CAPACITY_DEFAULT, YUVA_APP, ROLE_MENTOR } from "@/lib/yuva/constants";
import { sendYuvaEmail } from "@/lib/yuva/email";
import {
  runCancelledEmail,
  scheduleChangeEmail,
} from "@/lib/yuva/email-templates";
import {
  canTransitionRun,
  runStatusLabel,
  validatePublish,
} from "@/lib/yuva/run-machine";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path the Phase 6 donor (actions/mentors.ts) uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const RUNS_BASE = "/youth-academy/chapter/runs";

function revalidateRunPaths(runId?: string) {
  revalidatePath("/youth-academy/chapter");
  revalidatePath(RUNS_BASE);
  if (runId) revalidatePath(`${RUNS_BASE}/${runId}`);
  // Public landing (Phase 8) lists published runs — keep it fresh.
  revalidatePath("/youth-academy");
}

const uuid = z.string().uuid();

/** Date-only (YYYY-MM-DD) portion of a date or timestamp string. */
const dateOnly = (value: string) => value.slice(0, 10);

// Run statuses where a live audience exists — a schedule edit on these must
// notify enrolled students (spec: "editing schedule after publish → allowed,
// students notified by email"; pre-cohort there are no enrollments → no-op).
const NOTIFY_STATUSES = new Set([
  "published",
  "applications_closed",
  "in_progress",
]);

// Terminal / frozen statuses — settings and schedule edits are rejected.
const FROZEN_STATUSES = new Set(["completed", "certified", "cancelled"]);

// ─── Shared gates ─────────────────────────────────────────────────────────

type RunRow = {
  id: string;
  program_id: string;
  academy_id: string;
  chapter: string;
  status:
    | "draft"
    | "published"
    | "applications_closed"
    | "in_progress"
    | "completed"
    | "certified"
    | "cancelled";
  apply_open_at: string | null;
  apply_close_at: string | null;
  cohort_announce_date: string | null;
  capacity: number;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
};

const RUN_COLS =
  "id, program_id, academy_id, chapter, status, apply_open_at, apply_close_at, cohort_announce_date, capacity, start_date, end_date, published_at";

/**
 * Gate a run-scoped mutation: load the run, then require canManageRun on its
 * {academy_id, chapter}. Denies carry the resolver's verdict so a 403 is
 * diagnosable in one read (project rule).
 */
async function gateRun(
  runId: string
): Promise<
  | { ok: true; svc: Svc; access: YuvaAccess; run: RunRow }
  | { ok: false; error: string }
> {
  if (!uuid.safeParse(runId).success) {
    return { ok: false, error: "Invalid run id." };
  }
  const svc = await createServiceClient();
  const { data: run } = await svc
    .from("runs")
    .select(RUN_COLS)
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, error: "Run not found." };

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      ok: false,
      error: `You can't manage this run. Your access: ${access.reason}`,
    };
  }
  return { ok: true, svc, access, run: run as RunRow };
}

type SessionRow = {
  id: string;
  run_id: string;
  seq: number;
  name: string;
  scheduled_at: string | null;
  venue: string | null;
  remarks: string | null;
  mentor_person_id: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

/** Gate a session-scoped mutation via its parent run. */
async function gateSession(
  sessionId: string
): Promise<
  | { ok: true; svc: Svc; access: YuvaAccess; session: SessionRow; run: RunRow }
  | { ok: false; error: string }
> {
  if (!uuid.safeParse(sessionId).success) {
    return { ok: false, error: "Invalid session id." };
  }
  const svc = await createServiceClient();
  const { data: session } = await svc
    .from("run_sessions")
    .select(
      "id, run_id, seq, name, scheduled_at, venue, remarks, mentor_person_id, status"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "Session not found." };

  const gate = await gateRun(session.run_id);
  if (!gate.ok) return gate;
  return { ...gate, session: session as SessionRow };
}

// ─── createRun (snapshot template sessions → run_sessions) ────────────────

const createRunSchema = z.object({
  programId: uuid,
  academyId: uuid,
});

export async function createRun(
  input: z.infer<typeof createRunSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Pick a program and an academy." };
  }

  const svc = await createServiceClient();

  // Target academy first — the gate ref is built from it (the run doesn't
  // exist yet). canManageRun admits national / owning-chapter admin / the
  // academy's bound coordinator.
  const { data: academy } = await svc
    .from("academies")
    .select("id, chapter, display_name, is_active, capacity_norm")
    .eq("id", parsed.data.academyId)
    .maybeSingle();
  if (!academy) return { success: false, error: "Academy not found." };

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: academy.id, chapter: academy.chapter })
  ) {
    return {
      success: false,
      error: `You can't create runs for this academy. Your access: ${access.reason}`,
    };
  }

  if (!academy.is_active) {
    return {
      success: false,
      error: `"${academy.display_name}" is deactivated — runs can't be created for it.`,
    };
  }

  // Only APPROVED templates can be scheduled.
  const { data: program } = await svc
    .from("programs")
    .select("id, title, status")
    .eq("id", parsed.data.programId)
    .maybeSingle();
  if (!program) return { success: false, error: "Program not found." };
  if (program.status !== "approved") {
    return {
      success: false,
      error: `"${program.title}" is not approved — only approved programs can be scheduled.`,
    };
  }

  const { data: templateSessions } = await svc
    .from("program_sessions")
    .select(
      "seq, name, duration_minutes, learning_objective, description, document_storage_path, expects_submission"
    )
    .eq("program_id", program.id)
    .order("seq", { ascending: true });
  if (!templateSessions || templateSessions.length === 0) {
    return {
      success: false,
      error: `"${program.title}" has no sessions — add the session structure before scheduling a run.`,
    };
  }

  const { data: created, error: runErr } = await svc
    .from("runs")
    .insert({
      program_id: program.id,
      academy_id: academy.id,
      chapter: academy.chapter, // denormalized from the academy
      status: "draft",
      capacity: academy.capacity_norm ?? CAPACITY_DEFAULT,
      created_by: access.personId,
    })
    .select("id")
    .single();
  if (runErr || !created) {
    return {
      success: false,
      error: `Could not create the run: ${runErr?.message ?? "unknown error"}`,
    };
  }

  // SNAPSHOT the template structure in ONE insert (template changes after
  // this point affect new runs only).
  const { error: sessErr } = await svc.from("run_sessions").insert(
    templateSessions.map((s) => ({
      run_id: created.id,
      seq: s.seq,
      name: s.name,
      duration_minutes: s.duration_minutes,
      learning_objective: s.learning_objective,
      description: s.description,
      document_storage_path: s.document_storage_path,
      expects_submission: s.expects_submission,
      status: "scheduled" as const,
    }))
  );
  if (sessErr) {
    // Don't leave an orphan run with no sessions (publish would be blocked
    // anyway, but a half-created run is confusing). Best-effort cleanup.
    await svc.from("runs").delete().eq("id", created.id);
    return {
      success: false,
      error: `Could not copy the program sessions: ${sessErr.message}`,
    };
  }

  await logYuvaAudit({
    action: "create",
    entity: "runs",
    entity_id: created.id,
    chapter: academy.chapter,
    meta: {
      program_id: program.id,
      program_title: program.title,
      academy_id: academy.id,
      sessions_copied: templateSessions.length,
    },
  });
  revalidateRunPaths(created.id);
  return { success: true, data: { id: created.id } };
}

// ─── updateRunSettings (chapter-entered dates, window, announce, capacity) ─

const settingsSchema = z.object({
  runId: uuid,
  /** Chapter-entered start date — template Part B "Filled by Chapter". */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  applyOpenAt: z.string().datetime({ offset: true }).nullable().optional(),
  applyCloseAt: z.string().datetime({ offset: true }).nullable().optional(),
  cohortAnnounceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  /** Template Part B "Expected Participants" — SOFT cap. */
  capacity: z.number().int().min(1).max(1000).optional(),
});

export type RunSettingsInput = z.infer<typeof settingsSchema>;

export async function updateRunSettings(
  input: RunSettingsInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid run settings.",
    };
  }
  const v = parsed.data;

  const gate = await gateRun(v.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  if (FROZEN_STATUSES.has(run.status)) {
    return {
      success: false,
      error: `Settings can't be changed on a ${runStatusLabel(run.status).toLowerCase()} run.`,
    };
  }

  // `undefined` means "unchanged"; null means "clear".
  const next = {
    start_date: v.startDate === undefined ? run.start_date : v.startDate,
    end_date: v.endDate === undefined ? run.end_date : v.endDate,
    apply_open_at:
      v.applyOpenAt === undefined ? run.apply_open_at : v.applyOpenAt,
    apply_close_at:
      v.applyCloseAt === undefined ? run.apply_close_at : v.applyCloseAt,
    cohort_announce_date:
      v.cohortAnnounceDate === undefined
        ? run.cohort_announce_date
        : v.cohortAnnounceDate,
    capacity: v.capacity ?? run.capacity,
  };

  if (
    next.apply_open_at &&
    next.apply_close_at &&
    new Date(next.apply_open_at) >= new Date(next.apply_close_at)
  ) {
    return {
      success: false,
      error: "The application window must open before it closes.",
    };
  }
  if (
    next.start_date &&
    next.end_date &&
    next.start_date > next.end_date
  ) {
    return {
      success: false,
      error: "The run start date must be on or before the end date.",
    };
  }

  // Capacity is a SOFT cap — accepting beyond it warns, never blocks.
  let warning: string | undefined;
  const { count: acceptedCount } = await svc
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "accepted");
  if ((acceptedCount ?? 0) > next.capacity) {
    warning = `${acceptedCount} applicants are already accepted — more than the expected ${next.capacity} participants (soft cap, nothing is blocked).`;
  }

  const { error } = await svc
    .from("runs")
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq("id", run.id);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "update_settings",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    meta: { ...next, previous_capacity: run.capacity },
  });
  revalidateRunPaths(run.id);
  return {
    success: true,
    data: { id: run.id },
    ...(warning ? { warning } : {}),
  };
}

// ─── notifyScheduleChange (internal — published-run schedule edits) ───────

/**
 * Enqueue 'schedule_change' emails to the run's ACTIVE enrollments after a
 * published run's session datetime/venue changed. Pre-cohort (no
 * enrollments) this is a no-op. Durable queue + dedupe_key per
 * (session, new datetime, recipient) makes a double-save harmless.
 *
 * NOTE on the dedupe key: the spec key 'schedule_change:{run_session_id}:
 * {scheduled_at-iso}' is extended with ':{person_id}' — dedupe_key is UNIQUE
 * across yuva.notification_log, so without the recipient discriminator only
 * the FIRST student of a cohort would ever be emailed.
 */
async function notifyScheduleChange(
  svc: Svc,
  run: RunRow,
  session: SessionRow,
  newScheduledAt: string,
  changeSummary: string
): Promise<void> {
  try {
    const { data: enrollments } = await svc
      .from("enrollments")
      .select("person_id")
      .eq("run_id", run.id)
      .eq("status", "active");
    const personIds = [
      ...new Set((enrollments ?? []).map((e) => e.person_id)),
    ];
    if (personIds.length === 0) return; // pre-cohort — nothing to notify

    const { data: program } = await svc
      .from("programs")
      .select("title")
      .eq("id", run.program_id)
      .maybeSingle();
    const programName = program?.title ?? "your Yi Youth Academy program";

    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, email, full_name")
      .in("id", personIds);

    const rendered = scheduleChangeEmail({
      programName,
      sessionName: session.name,
      changeSummary,
    });

    for (const person of people ?? []) {
      if (!person.email) continue;
      await sendYuvaEmail({
        to: person.email,
        emailType: "schedule_change",
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        dedupeKey: `schedule_change:${session.id}:${newScheduledAt}:${person.id}`,
        meta: { run_id: run.id, run_session_id: session.id },
      });
    }
  } catch (e) {
    // Notification is best-effort — the schedule change itself already
    // succeeded; failures land in the log, never block the action.
    console.error("[yuva-runs] notifyScheduleChange failed:", e);
  }
}

// ─── scheduleSession (date+time / venue / remarks) ────────────────────────

const scheduleSchema = z.object({
  sessionId: uuid,
  scheduledAt: z.string().datetime({ offset: true }),
  venue: z.string().trim().max(300).nullable().optional(),
  /** Chapter-filled "Additional Remarks" (per session). */
  remarks: z.string().trim().max(2000).nullable().optional(),
});

export type ScheduleSessionInput = z.infer<typeof scheduleSchema>;

export async function scheduleSession(
  input: ScheduleSessionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid schedule details.",
    };
  }
  const v = parsed.data;

  const gate = await gateSession(v.sessionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, session, run } = gate;

  if (FROZEN_STATUSES.has(run.status)) {
    return {
      success: false,
      error: `The schedule can't be changed on a ${runStatusLabel(run.status).toLowerCase()} run.`,
    };
  }
  if (session.status !== "scheduled") {
    return {
      success: false,
      error: `Session ${session.seq} is ${session.status} — its schedule can't be changed.`,
    };
  }

  const newScheduledAt = new Date(v.scheduledAt).toISOString();
  const newVenue = v.venue === undefined ? session.venue : v.venue;
  const newRemarks = v.remarks === undefined ? session.remarks : v.remarks;

  const warnings: string[] = [];

  // Outside the chapter-entered run dates → WARNING, never a block.
  if (run.start_date && run.end_date) {
    const day = dateOnly(newScheduledAt);
    if (day < dateOnly(run.start_date) || day > dateOnly(run.end_date)) {
      warnings.push(
        `This session is scheduled on ${day}, outside the run dates (${dateOnly(run.start_date)} – ${dateOnly(run.end_date)}).`
      );
    }
  }

  // Mentor double-booked at the same datetime → WARNING, never a block.
  if (session.mentor_person_id) {
    const { data: clashes } = await svc
      .from("run_sessions")
      .select("id, name")
      .eq("mentor_person_id", session.mentor_person_id)
      .eq("scheduled_at", newScheduledAt)
      .eq("status", "scheduled")
      .neq("id", session.id)
      .limit(3);
    if (clashes && clashes.length > 0) {
      warnings.push(
        `The assigned mentor is already booked at this exact time (${clashes
          .map((c) => `"${c.name}"`)
          .join(", ")}).`
      );
    }
  }

  const datetimeChanged = session.scheduled_at
    ? new Date(session.scheduled_at).toISOString() !== newScheduledAt
    : true;
  const venueChanged = (session.venue ?? "") !== (newVenue ?? "");

  const { error } = await svc
    .from("run_sessions")
    .update({
      scheduled_at: newScheduledAt,
      venue: newVenue,
      remarks: newRemarks,
    })
    .eq("id", session.id);
  if (error) return { success: false, error: error.message };

  // Live run + the datetime/venue actually changed ⇒ notify enrolled
  // students (no-op pre-cohort; spec: allowed, never blocked).
  if (NOTIFY_STATUSES.has(run.status) && (datetimeChanged || venueChanged)) {
    const when = new Date(newScheduledAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
    const parts: string[] = [];
    if (datetimeChanged) parts.push(`now on ${when}`);
    if (venueChanged && newVenue) parts.push(`venue: ${newVenue}`);
    await notifyScheduleChange(
      svc,
      run,
      session,
      newScheduledAt,
      parts.join(" · ") || `updated — now on ${when}`
    );
  }

  await logYuvaAudit({
    action: "schedule_session",
    entity: "run_sessions",
    entity_id: session.id,
    chapter: run.chapter,
    meta: {
      run_id: run.id,
      seq: session.seq,
      scheduled_at: newScheduledAt,
      venue: newVenue,
      previous_scheduled_at: session.scheduled_at,
      notified: NOTIFY_STATUSES.has(run.status) && (datetimeChanged || venueChanged),
      warnings,
    },
  });
  revalidateRunPaths(run.id);
  return {
    success: true,
    data: { id: session.id },
    ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}),
  };
}

// ─── assignSessionMentor ("to be announced" = null allowed) ───────────────

const assignMentorSchema = z.object({
  sessionId: uuid,
  /** null clears the assignment → "To be announced". */
  mentorPersonId: uuid.nullable(),
});

export async function assignSessionMentor(
  input: z.infer<typeof assignMentorSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignMentorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid mentor assignment." };
  }
  const v = parsed.data;

  const gate = await gateSession(v.sessionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, session, run } = gate;

  if (FROZEN_STATUSES.has(run.status)) {
    return {
      success: false,
      error: `Mentors can't be changed on a ${runStatusLabel(run.status).toLowerCase()} run.`,
    };
  }
  if (session.status !== "scheduled") {
    return {
      success: false,
      error: `Session ${session.seq} is ${session.status} — its mentor can't be changed.`,
    };
  }

  const warnings: string[] = [];

  if (v.mentorPersonId) {
    // Canonical identity rule: the mentor role lives in yi_directory only.
    const dir = await createDirService();
    const { data: roleRow } = await dir
      .schema("yi_directory")
      .from("role_assignments")
      .select("id")
      .eq("app", YUVA_APP)
      .eq("role", ROLE_MENTOR)
      .eq("person_id", v.mentorPersonId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!roleRow) {
      return {
        success: false,
        error:
          "This person is not an active mentor in the Mentor YUVA Network.",
      };
    }

    // Double-booked at this session's exact datetime → WARNING, never block.
    if (session.scheduled_at) {
      const { data: clashes } = await svc
        .from("run_sessions")
        .select("id, name")
        .eq("mentor_person_id", v.mentorPersonId)
        .eq("scheduled_at", session.scheduled_at)
        .eq("status", "scheduled")
        .neq("id", session.id)
        .limit(3);
      if (clashes && clashes.length > 0) {
        warnings.push(
          `This mentor is already booked at this exact time (${clashes
            .map((c) => `"${c.name}"`)
            .join(", ")}).`
        );
      }
    }
  }

  const { error } = await svc
    .from("run_sessions")
    .update({ mentor_person_id: v.mentorPersonId })
    .eq("id", session.id);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "assign_mentor",
    entity: "run_sessions",
    entity_id: session.id,
    chapter: run.chapter,
    meta: {
      run_id: run.id,
      seq: session.seq,
      mentor_person_id: v.mentorPersonId,
      previous_mentor_person_id: session.mentor_person_id,
    },
  });
  revalidateRunPaths(run.id);
  return {
    success: true,
    data: { id: session.id },
    ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}),
  };
}

// ─── publishRun (run-machine validatePublish — errors block, warnings pass) ─

export async function publishRun(input: {
  runId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateRun(input.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  if (run.status !== "draft" || !canTransitionRun(run.status, "published")) {
    return {
      success: false,
      error: `Only a draft run can be published (this run is ${runStatusLabel(run.status).toLowerCase()}).`,
    };
  }

  const { data: sessions } = await svc
    .from("run_sessions")
    .select("seq, name, scheduled_at, mentor_person_id")
    .eq("run_id", run.id)
    .order("seq", { ascending: true });

  const validation = validatePublish(run, sessions ?? []);
  if (!validation.ok) {
    return { success: false, error: validation.errors.join(" ") };
  }

  // Compare-and-swap against concurrent transitions: 0 affected rows means
  // someone else moved the run first — report it, don't silently succeed.
  const { data: updated, error } = await svc
    .from("runs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "draft")
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "The run changed status while you were publishing — reload and try again.",
    };
  }

  await logYuvaAudit({
    action: "publish",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    meta: { warnings: validation.warnings },
  });
  revalidateRunPaths(run.id);
  return {
    success: true,
    data: { id: run.id },
    ...(validation.warnings.length > 0
      ? { warning: validation.warnings.join(" ") }
      : {}),
  };
}

// ─── closeApplications (published → applications_closed) ──────────────────

export async function closeApplications(input: {
  runId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateRun(input.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  if (!canTransitionRun(run.status, "applications_closed")) {
    return {
      success: false,
      error: `Applications can only be closed on a published run (this run is ${runStatusLabel(run.status).toLowerCase()}).`,
    };
  }

  const { data: updated, error } = await svc
    .from("runs")
    .update({
      status: "applications_closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", run.status)
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "The run changed status meanwhile — reload and try again.",
    };
  }

  await logYuvaAudit({
    action: "close_applications",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
  });
  revalidateRunPaths(run.id);
  return { success: true, data: { id: run.id } };
}

// ─── unpublishRun (published → draft ONLY; applicants keep status access) ──

export async function unpublishRun(input: {
  runId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateRun(input.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  if (run.status !== "published") {
    return {
      success: false,
      error: `Only a published run can be unpublished (this run is ${runStatusLabel(run.status).toLowerCase()}).`,
    };
  }

  // Existing applicants keep status-page access — applications are untouched;
  // the status page looks rows up by token, independent of run status.
  const { data: updated, error } = await svc
    .from("runs")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", "published")
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "The run changed status meanwhile — reload and try again.",
    };
  }

  await logYuvaAudit({
    action: "unpublish",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    meta: { note: "existing applicants keep status-page access" },
  });
  revalidateRunPaths(run.id);
  return { success: true, data: { id: run.id } };
}

// ─── completeRun (requires ≥1 completed session) ──────────────────────────

export async function completeRun(input: {
  runId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateRun(input.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  if (!canTransitionRun(run.status, "completed")) {
    return {
      success: false,
      error: `A run can only be completed while in progress (this run is ${runStatusLabel(run.status).toLowerCase()}).`,
    };
  }

  // Action-layer prerequisite (run-machine doc): ≥1 completed session.
  const { count } = await svc
    .from("run_sessions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "completed");
  if ((count ?? 0) === 0) {
    return {
      success: false,
      error:
        "Mark at least one session as completed before completing the run.",
    };
  }

  const { data: updated, error } = await svc
    .from("runs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("status", run.status)
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "The run changed status meanwhile — reload and try again.",
    };
  }

  await logYuvaAudit({
    action: "complete",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    meta: { completed_sessions: count },
  });
  revalidateRunPaths(run.id);
  return { success: true, data: { id: run.id } };
}

// ─── markSessionCompleted (session → 'completed'; feeds national metrics) ──

export async function markSessionCompleted(input: {
  sessionId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateSession(input.sessionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, session, run } = gate;

  if (session.status !== "scheduled") {
    return {
      success: false,
      error: `Session ${session.seq} is already ${session.status}.`,
    };
  }
  if (!session.scheduled_at) {
    return {
      success: false,
      error: "Schedule the session before marking it completed.",
    };
  }

  const { error } = await svc
    .from("run_sessions")
    .update({ status: "completed" })
    .eq("id", session.id)
    .eq("status", "scheduled");
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "complete_session",
    entity: "run_sessions",
    entity_id: session.id,
    chapter: run.chapter,
    meta: { run_id: run.id, seq: session.seq, name: session.name },
  });
  revalidateRunPaths(run.id);
  return { success: true, data: { id: session.id } };
}

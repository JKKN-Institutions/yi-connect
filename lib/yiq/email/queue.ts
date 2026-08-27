/**
 * YIQ email queue — the enqueue side.
 *
 * `enqueueTeamCodeEmails({ teamId })` is the ONE function the registration
 * action calls. It writes rows to yiq.email_queue and returns; the cron
 * (app/yiq/api/cron/drain-emails/route.ts) does the sending. Registration is
 * a public form on a phone in a school corridor — it must never wait on a
 * mail server, and a Resend outage must never fail a registration whose rows
 * are already written.
 *
 * CONTRACT FOR THE CALLER (app/yiq/actions/register.ts):
 *   - It NEVER throws. Every failure path returns { ok: false, reason }.
 *     Log the result; do not branch registration success on it.
 *   - It is safe to call twice. `dedupe_key` is UNIQUE and the insert is
 *     ON CONFLICT DO NOTHING, so a retried action re-queues nothing.
 *   - It does no auth of its own. Call it only after the team is written.
 *
 * WHAT IS NOT STORED: no access code ever reaches yiq.email_queue. The queue
 * row is long-lived audit data; a code is a live credential for a minor. The
 * drain re-reads codes from yiq.students at send time through the same pure
 * templates, which also means a code re-issued between enqueue and drain is
 * delivered correctly rather than staler.
 *
 * Plain lib/ module (NOT "use server") — non-async exports are legal here and
 * the drain imports the loader below.
 */

import { createServiceClient } from "@/lib/yiq/supabase/server";
import {
  isValidYiqEmail,
  renderStudentCodeEmail,
  renderTeacherCodesEmail,
  type YiqCategoryLabel,
} from "./templates";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Matches the yiq.email_queue `kind` check constraint. */
export type YiqEmailKind = "team_codes_teacher" | "student_code";

export type YiqTeamEmailContext = {
  team: {
    id: string;
    name: string;
    teamCode: string;
    category: YiqCategoryLabel;
    chapterEventId: string;
  };
  school: {
    name: string;
    contactPerson: string;
    contactEmail: string;
  };
  chapter: {
    name: string;
    /** Per-event window, falling back to the edition window. Null when unset. */
    roundOpensAt: string | null;
  };
  students: {
    id: string;
    fullName: string;
    classLevel: number;
    email: string | null;
    accessCode: string;
  }[];
};

export type EnqueueTeamCodeEmailsResult = {
  ok: boolean;
  /** Rows actually inserted — i.e. emails that will be sent. */
  queued: number;
  /** Recipients deliberately not queued (no usable email address). */
  skipped: number;
  /** Rows absorbed by the unique dedupe key — already queued or already sent. */
  duplicates: number;
  /** Present only when ok === false. Safe to log verbatim. */
  reason?: string;
};

const EMPTY: EnqueueTeamCodeEmailsResult = {
  ok: false,
  queued: 0,
  skipped: 0,
  duplicates: 0,
};

function categoryOrSenior(raw: string | null): YiqCategoryLabel {
  return raw === "junior" ? "junior" : "senior";
}

/**
 * Read everything the two templates need for one team.
 *
 * Separate queries rather than a PostgREST embed: embeds have bitten this
 * repo before (a nested filter trimming the embed rather than the parent),
 * and four small indexed reads on a registration path cost nothing.
 *
 * Returns null when the team no longer exists.
 */
export async function loadTeamEmailContext(
  svc: ServiceClient,
  teamId: string
): Promise<YiqTeamEmailContext | null> {
  const { data: team } = await svc
    .from("teams")
    .select("id, name, team_code, category, chapter_event_id, school_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;

  const { data: school } = await svc
    .from("schools")
    .select("name, contact_person, contact_email")
    .eq("id", team.school_id)
    .maybeSingle();

  const { data: event } = await svc
    .from("chapter_events")
    .select("id, chapter_name, edition_id, online_round_opens_at")
    .eq("id", team.chapter_event_id)
    .maybeSingle();

  let roundOpensAt: string | null = event?.online_round_opens_at ?? null;
  if (!roundOpensAt && event?.edition_id) {
    const { data: edition } = await svc
      .from("editions")
      .select("online_round_opens_at")
      .eq("id", event.edition_id)
      .maybeSingle();
    roundOpensAt = edition?.online_round_opens_at ?? null;
  }

  const { data: students } = await svc
    .from("students")
    .select("id, full_name, class_level, email, access_code, is_captain")
    .eq("team_id", team.id)
    .eq("is_active", true)
    .order("is_captain", { ascending: false })
    .order("full_name", { ascending: true });

  return {
    team: {
      id: team.id,
      name: team.name,
      teamCode: team.team_code,
      category: categoryOrSenior(team.category),
      chapterEventId: team.chapter_event_id,
    },
    school: {
      name: school?.name ?? "the school",
      contactPerson: school?.contact_person ?? "Teacher",
      contactEmail: school?.contact_email ?? "",
    },
    chapter: {
      name: event?.chapter_name ?? "Yi",
      roundOpensAt,
    },
    students: (students ?? []).map((s) => ({
      id: s.id,
      fullName: s.full_name,
      classLevel: s.class_level,
      email: s.email,
      accessCode: s.access_code,
    })),
  };
}

/** Deterministic idempotency keys. A resend tag produces a fresh send. */
export function teacherDedupeKey(teamId: string, resendTag?: string): string {
  return `yiq:team:${teamId}:teacher${resendTag ? `:${resendTag}` : ""}`;
}
export function studentDedupeKey(studentId: string, resendTag?: string): string {
  return `yiq:student:${studentId}:code${resendTag ? `:${resendTag}` : ""}`;
}

type QueueInsertRow = {
  kind: YiqEmailKind;
  recipient: string;
  recipient_name: string;
  subject: string;
  payload: Record<string, unknown>;
  chapter_event_id: string;
  team_id: string;
  student_id: string | null;
  dedupe_key: string;
};

/**
 * Queue the access-code emails for one registered team:
 *   - ONE email to the registering teacher with the whole list, and
 *   - one email per student who supplied an address, carrying only their own
 *     code.
 *
 * @param teamId    yiq.teams.id — the team that was just registered.
 * @param resendTag Optional. Omit for the normal post-registration send.
 *                  Pass a short tag (e.g. "reissue-2026-09-01") to force a
 *                  deliberate second send after codes are re-issued; it
 *                  changes the dedupe key so the queue accepts new rows.
 */
export async function enqueueTeamCodeEmails(input: {
  teamId: string;
  resendTag?: string;
}): Promise<EnqueueTeamCodeEmailsResult> {
  const { teamId, resendTag } = input;
  if (!teamId) return { ...EMPTY, reason: "No teamId given" };

  try {
    const svc = await createServiceClient();
    const ctx = await loadTeamEmailContext(svc, teamId);
    if (!ctx) return { ...EMPTY, reason: `Team ${teamId} not found` };

    const rows: QueueInsertRow[] = [];
    let skipped = 0;

    const sharedPayload = {
      teamName: ctx.team.name,
      teamCode: ctx.team.teamCode,
      schoolName: ctx.school.name,
      chapterName: ctx.chapter.name,
      category: ctx.team.category,
      roundOpensAt: ctx.chapter.roundOpensAt,
    };

    // ── 1. The registering teacher: one email, the full list ──────────────
    if (isValidYiqEmail(ctx.school.contactEmail)) {
      // Rendered here only to capture the subject line for the audit view.
      // The html/text are discarded — the drain re-renders from live rows so
      // no access code is ever written to the queue.
      const { subject } = renderTeacherCodesEmail({
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
      });

      rows.push({
        kind: "team_codes_teacher",
        recipient: ctx.school.contactEmail.trim().toLowerCase(),
        recipient_name: ctx.school.contactPerson,
        subject,
        payload: { ...sharedPayload, memberCount: ctx.students.length },
        chapter_event_id: ctx.team.chapterEventId,
        team_id: ctx.team.id,
        student_id: null,
        dedupe_key: teacherDedupeKey(ctx.team.id, resendTag),
      });
    } else {
      skipped++;
    }

    // ── 2. Each student who gave an address: their own code only ──────────
    for (const student of ctx.students) {
      if (!isValidYiqEmail(student.email)) {
        // Not an error. Plenty of Class 9 students have no email; the teacher
        // hands the code over from the list above.
        skipped++;
        continue;
      }

      const { subject } = renderStudentCodeEmail({
        studentName: student.fullName,
        accessCode: student.accessCode,
        classLevel: student.classLevel,
        teamName: ctx.team.name,
        teamCode: ctx.team.teamCode,
        schoolName: ctx.school.name,
        chapterName: ctx.chapter.name,
        category: ctx.team.category,
        roundOpensAt: ctx.chapter.roundOpensAt,
      });

      rows.push({
        kind: "student_code",
        recipient: student.email!.trim().toLowerCase(),
        recipient_name: student.fullName,
        subject,
        payload: {
          ...sharedPayload,
          studentName: student.fullName,
          classLevel: student.classLevel,
        },
        chapter_event_id: ctx.team.chapterEventId,
        team_id: ctx.team.id,
        student_id: student.id,
        dedupe_key: studentDedupeKey(student.id, resendTag),
      });
    }

    if (rows.length === 0) {
      return { ok: true, queued: 0, skipped, duplicates: 0 };
    }

    // yiq.email_queue IS typed since types/yiq/database.ts was regenerated on
    // 2026-08-27. The cast stays only because `.upsert` with `onConflict` on a
    // generated Insert type is awkward to satisfy; the shape is asserted below.
    const { data, error } = (await svc
      .from("email_queue" as never)
      .upsert(rows as never, {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      })
      .select("id")) as unknown as {
      data: { id: string }[] | null;
      error: { message: string } | null;
    };

    if (error) {
      console.error("[yiq-email-queue] enqueue failed:", error.message);
      return { ...EMPTY, skipped, reason: error.message };
    }

    const queued = (data ?? []).length;
    return {
      ok: true,
      queued,
      skipped,
      duplicates: rows.length - queued,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[yiq-email-queue] enqueue threw:", reason);
    return { ...EMPTY, reason };
  }
}

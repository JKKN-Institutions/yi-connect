"use server";

/**
 * Fixing a wrong email address and sending a team's access codes again.
 *
 * WHY THIS EXISTS (Director ruling, 2026-08-27). A teacher mistypes their
 * address at registration, the codes go nowhere, and until now there was no
 * recovery: the resend machinery existed in lib/yiq/email/queue.ts but nothing
 * called it, and nothing could edit the address. One typo could keep a whole
 * team out of the round.
 *
 * AUTHORITY. Event-scoped — requireYiqEventManage() on the team's OWN chapter
 * event, re-read server-side. A client never names the event it wants
 * permission for. Refusals return { success: false, error }, never a redirect.
 *
 * NO CODE EVER LEAVES THIS FILE. The organiser can correct an address and
 * trigger a send; they cannot read anybody's access code. Putting a school's
 * codes on an organiser's screen is the thing emailing them was meant to
 * avoid, and it was explicitly rejected.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqEventManage } from "@/lib/yiq/auth/event-access";
import { enqueueTeamCodeEmails } from "@/lib/yiq/email/queue";
import {
  validateEmailChange,
  resendTagFor,
  EMAIL_CHANGE_REFUSAL_TEXT,
  type RecipientKind,
} from "@/lib/yiq/email/recipients";

type Result<T = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

/**
 * Who the codes for this team would currently go to, and whether each address
 * is one this platform will even attempt.
 *
 * Returns ADDRESSES ONLY — never an access code.
 */
export type TeamRecipients = {
  teamId: string;
  teamName: string;
  schoolName: string | null;
  teacherEmail: string | null;
  students: { id: string; name: string; email: string | null }[];
};

export async function listTeamRecipients(
  teamId: string
): Promise<Result<{ recipients: TeamRecipients }>> {
  const svc = await createServiceClient();

  const { data: team, error } = await svc
    .from("teams")
    .select("id, name, chapter_event_id, school_id, schools(name, contact_email)")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    console.error("[yiq] listTeamRecipients read failed", error);
    return { success: false, error: "Could not read that team." };
  }
  if (!team) return { success: false, error: "That team was not found." };
  if (!team.chapter_event_id) {
    // No event means no scope to authorise against. Fail closed.
    return {
      success: false,
      error: "That team is not attached to a chapter event.",
    };
  }

  const gate = await requireYiqEventManage(team.chapter_event_id);
  if (!gate.ok) return { success: false, error: gate.error };

  const { data: students } = await svc
    .from("students")
    .select("id, full_name, email")
    .eq("team_id", teamId)
    .order("is_captain", { ascending: false });

  const school = team.schools as { name: string | null; contact_email: string | null } | null;

  return {
    success: true,
    recipients: {
      teamId: team.id,
      teamName: team.name,
      schoolName: school?.name ?? null,
      teacherEmail: school?.contact_email ?? null,
      students: (students ?? []).map((s) => ({
        id: s.id,
        name: s.full_name ?? "Unnamed student",
        email: s.email,
      })),
    },
  };
}

/**
 * Correct one address and re-queue this team's codes.
 *
 * `kind: "teacher"` edits the SCHOOL's contact address, which is where the
 * full list of codes goes. `kind: "student"` edits one student's own address.
 * Either way the whole team is re-queued afterwards, because the queue is
 * idempotent per recipient and re-sending a correct address costs one email.
 *
 * THE RESEND TAG IS WHAT MAKES THIS WORK AT ALL. `dedupe_key` is UNIQUE and
 * every enqueue ignores duplicates, so re-queuing a team without a fresh tag
 * produces NOTHING. That is the right behaviour for a retried registration and
 * exactly the wrong behaviour for a deliberate resend — hence the tag.
 */
export async function fixEmailAndResend(input: {
  teamId: string;
  kind: RecipientKind;
  /** Required for kind:"student" — which student's address is being corrected. */
  studentId?: string;
  email: string;
}): Promise<Result<{ queued: number; sentTo: string }>> {
  const svc = await createServiceClient();

  const { data: team } = await svc
    .from("teams")
    .select("id, chapter_event_id, school_id, schools(contact_email)")
    .eq("id", input.teamId)
    .maybeSingle();

  if (!team) return { success: false, error: "That team was not found." };
  if (!team.chapter_event_id) {
    return {
      success: false,
      error: "That team is not attached to a chapter event.",
    };
  }

  const gate = await requireYiqEventManage(team.chapter_event_id);
  if (!gate.ok) return { success: false, error: gate.error };

  // ---- Work out the current address, so "unchanged" can be reported -------
  let current: string | null = null;
  if (input.kind === "teacher") {
    current =
      (team.schools as { contact_email: string | null } | null)?.contact_email ?? null;
  } else {
    if (!input.studentId) {
      return { success: false, error: "Which student's address is this?" };
    }
    const { data: st } = await svc
      .from("students")
      .select("id, email, team_id")
      .eq("id", input.studentId)
      .maybeSingle();
    if (!st) return { success: false, error: "That student was not found." };
    // The student must belong to the team we authorised against, or an
    // organiser could edit any student in the country by id.
    if (st.team_id !== input.teamId) {
      return { success: false, error: "That student is not in this team." };
    }
    current = st.email;
  }

  const decision = validateEmailChange(input.email, current);
  if (!decision.ok) {
    return { success: false, error: EMAIL_CHANGE_REFUSAL_TEXT[decision.reason] };
  }

  // ---- Write the correction ----------------------------------------------
  if (input.kind === "teacher") {
    if (!team.school_id) {
      return { success: false, error: "That team has no school on file." };
    }
    const { error: upErr } = await svc
      .from("schools")
      .update({ contact_email: decision.email })
      .eq("id", team.school_id);
    if (upErr) {
      console.error("[yiq] fixEmailAndResend school update failed", upErr);
      return { success: false, error: "Could not save that address." };
    }
  } else {
    const { error: upErr } = await svc
      .from("students")
      .update({ email: decision.email })
      .eq("id", input.studentId!)
      .eq("team_id", input.teamId);
    if (upErr) {
      console.error("[yiq] fixEmailAndResend student update failed", upErr);
      return { success: false, error: "Could not save that address." };
    }
  }

  // ---- Re-queue -----------------------------------------------------------
  const queued = await enqueueTeamCodeEmails({
    teamId: input.teamId,
    resendTag: resendTagFor(Date.now()),
  });

  await svc.from("audit_log").insert({
    actor_label: gate.access.role ?? "organiser",
    action: "team_codes_resent",
    entity_type: "team",
    entity_id: input.teamId,
    chapter_event_id: team.chapter_event_id,
    detail: {
      kind: input.kind,
      studentId: input.studentId ?? null,
      // The corrected ADDRESS is recorded (an organiser must be able to see
      // what it was changed to). No access code is recorded anywhere.
      newEmail: decision.email,
      queued: queued.ok ? queued.queued : 0,
      queueError: queued.ok ? null : queued.reason,
    },
  });

  if (!queued.ok) {
    // The address IS saved — that half succeeded and must not be reported as
    // a failure, or the organiser will type it again.
    return {
      success: false,
      error: `The address was saved, but the codes could not be queued (${queued.reason}). Try resending in a moment.`,
    };
  }

  revalidatePath("/yiq/dashboard");

  return { success: true, queued: queued.queued, sentTo: decision.email };
}

/**
 * Send this team's codes again WITHOUT changing anything.
 *
 * For the case where the address is right and the mail was lost, deleted, or
 * went to spam. Still needs a fresh resend tag, or the idempotent queue does
 * nothing at all and the organiser is told "sent" when nothing was.
 */
export async function resendTeamCodes(
  teamId: string
): Promise<Result<{ queued: number }>> {
  const svc = await createServiceClient();

  const { data: team } = await svc
    .from("teams")
    .select("id, chapter_event_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return { success: false, error: "That team was not found." };
  if (!team.chapter_event_id) {
    return {
      success: false,
      error: "That team is not attached to a chapter event.",
    };
  }

  const gate = await requireYiqEventManage(team.chapter_event_id);
  if (!gate.ok) return { success: false, error: gate.error };

  const queued = await enqueueTeamCodeEmails({
    teamId,
    resendTag: resendTagFor(Date.now()),
  });

  await svc.from("audit_log").insert({
    actor_label: gate.access.role ?? "organiser",
    action: "team_codes_resent",
    entity_type: "team",
    entity_id: teamId,
    chapter_event_id: team.chapter_event_id,
    detail: { kind: "resend_only", queued: queued.ok ? queued.queued : 0 },
  });

  if (!queued.ok) {
    return {
      success: false,
      error: `Could not queue those codes (${queued.reason}).`,
    };
  }

  // Nothing queued and no error means every address on file is unusable.
  if (queued.queued === 0) {
    return {
      success: false,
      error:
        "Nothing could be sent — none of the addresses on file for this team look usable. Correct one first.",
    };
  }

  revalidatePath("/yiq/dashboard");
  return { success: true, queued: queued.queued };
}

/**
 * Every team in this chapter event, for the organiser to pick from.
 *
 * An organiser standing in front of a worried teacher knows the SCHOOL's name,
 * not a UUID. Asking them to paste a team id was a non-starter — this is the
 * list they actually search.
 *
 * Returns names and a delivery summary only. No address, no code: the summary
 * is what makes a broken team findable at a glance, and the detail is one
 * click away in listTeamRecipients.
 */
export type TeamCodeSummary = {
  teamId: string;
  teamName: string;
  schoolName: string | null;
  category: string | null;
  /** Students with no usable address on file. The tell for "codes never arrived". */
  missingStudentEmails: number;
  studentCount: number;
  teacherEmailMissing: boolean;
};

export async function listTeamsForCodes(
  chapterEventId: string
): Promise<Result<{ teams: TeamCodeSummary[] }>> {
  const gate = await requireYiqEventManage(chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: teams, error } = await svc
    .from("teams")
    .select("id, name, category, schools(name, contact_email), students(id, email)")
    .eq("chapter_event_id", chapterEventId)
    .not("status", "in", "(withdrawn)")
    .order("name")
    .limit(1000);

  if (error) {
    console.error("[yiq] listTeamsForCodes failed", error);
    return { success: false, error: "Could not read this chapter's teams." };
  }

  type Row = {
    id: string;
    name: string;
    category: string | null;
    schools: { name: string | null; contact_email: string | null } | null;
    students: { id: string; email: string | null }[] | null;
  };

  return {
    success: true,
    teams: ((teams ?? []) as unknown as Row[]).map((t) => {
      const students = t.students ?? [];
      return {
        teamId: t.id,
        teamName: t.name,
        schoolName: t.schools?.name ?? null,
        category: t.category,
        studentCount: students.length,
        missingStudentEmails: students.filter(
          (s) => !s.email || s.email.trim() === ""
        ).length,
        teacherEmailMissing:
          !t.schools?.contact_email || t.schools.contact_email.trim() === "",
      };
    }),
  };
}

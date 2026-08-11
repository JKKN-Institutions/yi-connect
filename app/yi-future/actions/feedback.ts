"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { sendPushToSubject } from "@/lib/yi-future/push";
import {
  requireChapterAdmin,
  resolveFutureAccessOrNull,
} from "@/lib/yi-future/auth/require-access";
import { readSession } from "@/app/yi-future/actions/auth";

type Phase = Database["future"]["Enums"]["phase"];

/**
 * Mentor uses their session (access code) to write feedback for a team.
 * Chapter admin can also write on behalf of a mentor (for training).
 */
export async function createFeedback(
  input: { teamId: string; mentorId: string },
  formData: FormData
): Promise<ActionResult> {
  const phase = String(formData.get("phase") ?? "").trim() as Phase;
  const rating_raw = String(formData.get("rating") ?? "").trim();
  const rating = rating_raw ? Number(rating_raw) : null;
  const strengths = String(formData.get("strengths") ?? "").trim() || null;
  const improvements =
    String(formData.get("improvements") ?? "").trim() || null;
  const next_actions =
    String(formData.get("next_actions") ?? "").trim() || null;

  if (!(["phase_a", "phase_b", "phase_c"] as const).includes(phase)) {
    return { ok: false, error: "Pick a phase." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { ok: false, error: "Rating must be between 1 and 5." };
  }
  if (!strengths && !improvements && !next_actions) {
    return {
      ok: false,
      error: "Write at least one of: strengths, improvements, next actions.",
    };
  }

  const svc = await createServiceClient();

  // SECURITY: this writes with the service client (RLS-bypassing) and used to
  // have NO gate at all — input.mentorId alone let anyone post feedback as any
  // mentor, for any team. Prove the caller is EITHER that mentor (access-code
  // session) OR an admin of the team's own chapter.
  const { data: teamRow } = await svc
    .schema("future")
    .from("teams")
    .select("id, chapter_id, edition_id")
    .eq("id", input.teamId)
    .maybeSingle();
  const team = teamRow as unknown as {
    id: string;
    chapter_id: string;
    edition_id: string;
  } | null;
  if (!team) return { ok: false, error: "Team not found." };

  const { data: mentorRow } = await svc
    .schema("future")
    .from("mentors")
    .select("id, is_active, edition_id")
    .eq("id", input.mentorId)
    .maybeSingle();
  const mentor = mentorRow as unknown as {
    id: string;
    is_active: boolean | null;
    edition_id: string;
  } | null;
  if (!mentor || mentor.is_active === false) {
    return { ok: false, error: "Mentor not found or inactive." };
  }

  const session = await readSession();
  let authorized = false;
  if (session?.type === "mentor" && session.id === input.mentorId) {
    // Mirrors saveMentorEvaluation: edition must match, and once the team has
    // any mentor assignments the mentor must be one of them.
    if (mentor.edition_id === team.edition_id) {
      const { data: assigns } = await svc
        .schema("future")
        .from("mentor_team_assignments")
        .select("mentor_id")
        .eq("team_id", input.teamId);
      const list = (assigns ?? []) as { mentor_id: string }[];
      authorized =
        list.length === 0 || list.some((a) => a.mentor_id === input.mentorId);
    }
  }
  if (!authorized) {
    // Second documented path: a chapter admin writing on a mentor's behalf.
    const access = await resolveFutureAccessOrNull();
    authorized =
      !!access &&
      (access.isNational || access.chapterIds.includes(team.chapter_id));
  }
  if (!authorized) {
    return {
      ok: false,
      error: "You are not allowed to write feedback for this team.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("mentor_feedback")
    .insert({
      team_id: input.teamId,
      mentor_id: input.mentorId,
      phase,
      rating,
      strengths,
      improvements,
      next_actions,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${input.teamId}`);
  revalidatePath("/yi-future/me/feedback");
  revalidatePath("/yi-future/mentor");

  // Fire-and-forget push to every member of the team
  try {
    const [{ data: mentor }, { data: members }] = await Promise.all([
      (svc as any)
        .schema("future")
        .from("mentors")
        .select("full_name")
        .eq("id", input.mentorId)
        .maybeSingle(),
      (svc as any)
        .schema("future")
        .from("team_members")
        .select("delegate_id")
        .eq("team_id", input.teamId),
    ]);
    const mentorName =
      (mentor as { full_name: string | null } | null)?.full_name ?? "Your mentor";
    const rows =
      (members as { delegate_id: string | null }[] | null) ?? [];
    await Promise.all(
      rows
        .map((r) => r.delegate_id)
        .filter((id): id is string => Boolean(id))
        .map((delegateId) =>
          sendPushToSubject("delegate", delegateId, {
            title: "New mentor feedback",
            body: `${mentorName} gave your team feedback.`,
            url: "/me/feedback",
          }).catch((err) =>
            console.error("[push] createFeedback notify delegate failed:", err)
          )
        )
    );
  } catch (err) {
    console.error("[push] createFeedback notify members failed:", err);
  }

  return { ok: true, message: "Feedback saved." };
}

export async function mentorSubmitFeedback(
  mentorSessionId: string,
  teamId: string,
  formData: FormData
): Promise<ActionResult> {
  // Mentors use an access-code session; no Supabase Auth user is required.
  // SECURITY: checking only that the mentor row EXISTS and is active proved
  // nothing about the caller — anyone could post as any mentor by passing that
  // mentor's id. Assert the session IS this mentor. createFeedback re-verifies
  // the mentor row, the edition match and the team assignment.
  const session = await readSession();
  if (!session || session.type !== "mentor") {
    return { ok: false, error: "Sign in as a mentor first." };
  }
  if (session.id !== mentorSessionId) {
    return { ok: false, error: "Mentor session does not match mentor id." };
  }
  return createFeedback({ teamId, mentorId: mentorSessionId }, formData);
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  const svc = await createServiceClient();

  // Scope the admin gate to the feedback's OWN chapter — requireFutureAdmin
  // let a chair of chapter A delete chapter B's mentor feedback. Fails CLOSED
  // (unknown id → null chapter → denied unless national), and the gate runs
  // before the not-found return so this is not an id oracle.
  const { data: fbRow } = await svc
    .schema("future")
    .from("mentor_feedback")
    .select("id, team_id")
    .eq("id", id)
    .maybeSingle();
  const fb = fbRow as unknown as { id: string; team_id: string } | null;

  let chapterId: string | null = null;
  if (fb) {
    const { data: teamRow } = await svc
      .schema("future")
      .from("teams")
      .select("chapter_id")
      .eq("id", fb.team_id)
      .maybeSingle();
    chapterId =
      (teamRow as unknown as { chapter_id: string } | null)?.chapter_id ?? null;
  }
  await requireChapterAdmin(chapterId);
  if (!fb) return { ok: false, error: "Feedback not found." };

  const { error } = await svc
    .schema("future")
    .from("mentor_feedback")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/mentor");
  return { ok: true, message: "Feedback removed." };
}

export async function autoAllocateMentors(editionId: string, chapterId: string): Promise<ActionResult> {
  // chapterId is caller-supplied and drives every write below — gate on THAT
  // chapter, not on "is any kind of Future admin".
  await requireChapterAdmin(chapterId);
  // Simple round-robin allocation: all teams with no mentor, all active mentors.
  const svc = await createServiceClient();
  const [{ data: teams }, { data: mentors }] = await Promise.all([
    svc
      .schema("future")
      .from("teams")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("mentors")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .eq("is_active", true),
  ]);

  const teamList = (teams as unknown as { id: string }[]) ?? [];
  const mentorList = (mentors as unknown as { id: string }[]) ?? [];
  if (mentorList.length === 0) {
    return { ok: false, error: "No active mentors to allocate." };
  }
  if (teamList.length === 0) {
    return { ok: false, error: "No teams to assign." };
  }

  const rows = teamList.map((t, i) => ({
    team_id: t.id,
    mentor_id: mentorList[i % mentorList.length].id,
  }));

  const { error } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .upsert(rows, { onConflict: "mentor_id,team_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/mentors");
  return {
    ok: true,
    message: `Assigned ${teamList.length} teams across ${mentorList.length} mentors.`,
  };
}

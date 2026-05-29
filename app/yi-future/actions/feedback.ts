"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { sendPushToSubject } from "@/app/yi-future/actions/push";

type Phase = Database["future"]["Enums"]["phase"];

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

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
  // Mentors use access-code session; no auth user required. We validate the
  // mentor exists and is active.
  const svc = await createServiceClient();
  const { data: mentor } = await svc
    .schema("future")
    .from("mentors")
    .select("id, is_active")
    .eq("id", mentorSessionId)
    .maybeSingle();
  if (!mentor || (mentor as { is_active: boolean | null }).is_active === false) {
    return { ok: false, error: "Mentor not found or inactive." };
  }
  return createFeedback({ teamId, mentorId: mentorSessionId }, formData);
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
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
  await requireAuth();
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

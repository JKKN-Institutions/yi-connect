"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";
import {
  requireFutureAdmin,
  requireChapterAdmin,
} from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

/**
 * Chapter-scoped gate for the takeover-grade mentor action (regenerate access
 * code) — a chair of chapter A must not regenerate chapter B's mentor code.
 */
async function requireMentorChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("mentors")
    .select("chapter_id")
    .eq("id", id)
    .maybeSingle();
  await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
}

async function uniqueAccessCode(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("mentors")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate unique access code after 25 tries.");
}

// ─── CREATE MENTOR ──────────────────────────────────────────────────
export async function createMentor(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  // Scope to the chapter the mentor is created in — a chair of chapter A must
  // not create mentors under chapter B.
  await requireChapterAdmin(input.chapterId);
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const expertise = String(formData.get("expertise") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);

  const { error } = await svc
    .schema("future")
    .from("mentors")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      full_name,
      title,
      organization,
      email,
      phone,
      expertise,
      bio,
      access_code,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  // Upsert yi_directory.people — cross-app identity bridge
  if (email) {
    await svc
      .schema("yi_directory" as "public")
      .from("people")
      .upsert(
        {
          full_name,
          email,
          phone: phone || null,
          is_active: true,
        } as never,
        { onConflict: "email" }
      );
  }

  revalidatePath("/yi-future/chapter/mentors");
  redirect("/yi-future/chapter/mentors");
}

// ─── UPDATE MENTOR ──────────────────────────────────────────────────
export async function updateMentor(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireMentorChapterAdmin(id);
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const expertise = String(formData.get("expertise") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("mentors")
    .update({
      full_name,
      title,
      organization,
      email,
      phone,
      expertise,
      bio,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/mentors");
  redirect("/yi-future/chapter/mentors");
}

// ─── REGEN CODE ─────────────────────────────────────────────────────
export async function regenerateMentorAccessCode(
  id: string
): Promise<ActionResult> {
  await requireMentorChapterAdmin(id);
  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);
  const { error } = await svc
    .schema("future")
    .from("mentors")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/mentors");
  return { ok: true, message: `New code: ${access_code}` };
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteMentor(id: string): Promise<ActionResult> {
  await requireMentorChapterAdmin(id);
  const svc = await createServiceClient();

  // Remove any team assignments first
  await svc
    .schema("future")
    .from("mentor_team_assignments")
    .delete()
    .eq("mentor_id", id);

  const { error } = await svc
    .schema("future")
    .from("mentors")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/mentors");
  return { ok: true, message: "Mentor removed." };
}

// ─── ASSIGN / UNASSIGN MENTOR ↔ TEAM ────────────────────────────────
async function requireTeamChapterAdmin(teamId: string): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select("chapter_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!data) return false;
  // Chapter-scope: chair of team A's chapter must not manage team B's mentors.
  // requireChapterAdmin fails closed (null chapter → denied) and redirects.
  await requireChapterAdmin((data as { chapter_id: string | null }).chapter_id);
  return true;
}

export async function assignMentorToTeam(
  mentorId: string,
  teamId: string
): Promise<ActionResult> {
  if (!(await requireTeamChapterAdmin(teamId))) {
    return { ok: false, error: "Team not found." };
  }
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .upsert({ mentor_id: mentorId, team_id: teamId }, {
      onConflict: "mentor_id,team_id",
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/mentors");
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true, message: "Assigned." };
}

export async function unassignMentorFromTeam(
  mentorId: string,
  teamId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .delete()
    .eq("mentor_id", mentorId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/mentors");
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true, message: "Unassigned." };
}

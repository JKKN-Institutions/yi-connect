"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
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
  await requireAuth();
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

  revalidatePath("/chapter/mentors");
  redirect("/yi-future/chapter/mentors");
}

// ─── UPDATE MENTOR ──────────────────────────────────────────────────
export async function updateMentor(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
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

  revalidatePath("/chapter/mentors");
  redirect("/yi-future/chapter/mentors");
}

// ─── REGEN CODE ─────────────────────────────────────────────────────
export async function regenerateMentorAccessCode(
  id: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);
  const { error } = await svc
    .schema("future")
    .from("mentors")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chapter/mentors");
  return { ok: true, message: `New code: ${access_code}` };
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteMentor(id: string): Promise<ActionResult> {
  await requireAuth();
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
  revalidatePath("/chapter/mentors");
  return { ok: true, message: "Mentor removed." };
}

// ─── ASSIGN / UNASSIGN MENTOR ↔ TEAM ────────────────────────────────
export async function assignMentorToTeam(
  mentorId: string,
  teamId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .upsert({ mentor_id: mentorId, team_id: teamId }, {
      onConflict: "mentor_id,team_id",
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chapter/mentors");
  revalidatePath(`/chapter/teams/${teamId}`);
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
  revalidatePath("/chapter/mentors");
  revalidatePath(`/chapter/teams/${teamId}`);
  return { ok: true, message: "Unassigned." };
}

"use server";

/**
 * Yi-Future check-in VOLUNTEERS — chapter-admin side.
 *
 * Ported from app/yip/actions/volunteers.ts. Authorization is the existing
 * canonical gate: requireChapterAdmin() (which reads
 * yi_directory.role_assignments as the mother source, unions the
 * future.chapter_core_team cache, fails CLOSED on a null chapter, and denies
 * explicitly by redirecting to the /yi-future/forbidden 403 page). NO new
 * per-vertical auth table is introduced — future.volunteers is a roster of
 * code-holders, not an admin-role table.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import {
  VOLUNTEER_STATIONS,
  type VolunteerStation,
} from "@/lib/yi-future/volunteers";
import type { ActionResult } from "./editions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

/** future.volunteers is new and not in the generated types → loose client. */
async function loose(): Promise<LooseClient> {
  return (await createServiceClient()) as LooseClient;
}

/**
 * Chapter-scope an action that targets an EXISTING volunteer row: resolve THAT
 * row's chapter so a chair of chapter A cannot touch chapter B's desk staff.
 * Fails closed — an unresolvable chapter denies every non-national caller.
 */
async function requireVolunteerChapterAdmin(
  id: string
): Promise<{ svc: LooseClient; chapterId: string | null }> {
  const svc = await loose();
  const { data } = await svc
    .schema("future")
    .from("volunteers")
    .select("chapter_id")
    .eq("id", id)
    .maybeSingle();
  const chapterId = (data as { chapter_id: string | null } | null)?.chapter_id ?? null;
  await requireChapterAdmin(chapterId);
  return { svc, chapterId };
}

/**
 * BLOCKER B, layer 1 — GLOBAL uniqueness at generation time.
 *
 * validateAccessCode() resolves a code across delegates, mentors,
 * jury_assignments, corporate_partners and experts as well as volunteers, and
 * every uniqueness constraint in this schema is PER TABLE. A volunteer code
 * equal to a delegate's code would therefore be an identity collision. So a
 * candidate is checked against ALL SIX code-holding tables before it is
 * accepted. (The DB trigger installed by
 * supabase/migrations/future_volunteers_checkin.sql enforces the same rule as
 * a second layer for any future code path that skips this function.)
 */
const CODE_TABLES = [
  "volunteers",
  "delegates",
  "mentors",
  "jury_assignments",
  "corporate_partners",
  "experts",
] as const;

async function uniqueVolunteerAccessCode(svc: LooseClient): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = generateAccessCode();
    let taken = false;
    for (const table of CODE_TABLES) {
      const { data } = await svc
        .schema("future")
        .from(table)
        .select("id")
        .eq("access_code", code)
        .limit(1)
        .maybeSingle();
      if (data) {
        taken = true;
        break;
      }
    }
    if (!taken) return code;
  }
  throw new Error(
    "Could not allocate a unique access code after 25 tries — try again."
  );
}

function parseStation(raw: string): VolunteerStation | null {
  return (
    VOLUNTEER_STATIONS.find((s) => s.code === raw)?.code ?? null
  );
}

// ─── CREATE ─────────────────────────────────────────────────────────────────
export async function createVolunteer(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  const { userId } = await requireChapterAdmin(input.chapterId);

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const station = parseStation(String(formData.get("station") ?? "check_in"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!full_name) return { ok: false, error: "Name is required." };
  if (!station) return { ok: false, error: "Pick a valid station." };

  const svc = await loose();

  let access_code: string;
  try {
    access_code = await uniqueVolunteerAccessCode(svc);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const { error } = await svc
    .schema("future")
    .from("volunteers")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      full_name,
      phone,
      email,
      station,
      notes,
      access_code,
      is_active: true,
      created_by: userId,
    });

  if (error) {
    if (error.code === "42P01") {
      return {
        ok: false,
        error:
          "Volunteers are not switched on yet — the future_volunteers_checkin migration has not been applied to this environment.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/yi-future/chapter/volunteers");
  return { ok: true, message: `${full_name} added. Code: ${access_code}` };
}

// ─── STATION ────────────────────────────────────────────────────────────────
export async function setVolunteerStation(
  id: string,
  station: string
): Promise<ActionResult> {
  const parsed = parseStation(station);
  if (!parsed) return { ok: false, error: "Pick a valid station." };

  const { svc } = await requireVolunteerChapterAdmin(id);
  const { error } = await svc
    .schema("future")
    .from("volunteers")
    .update({ station: parsed })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/volunteers");
  return { ok: true, message: "Station updated." };
}

// ─── ACTIVE / PAUSED ────────────────────────────────────────────────────────
export async function setVolunteerActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const { svc } = await requireVolunteerChapterAdmin(id);
  const { error } = await svc
    .schema("future")
    .from("volunteers")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/volunteers");
  return {
    ok: true,
    message: active ? "Volunteer re-activated." : "Volunteer paused.",
  };
}

// ─── REGENERATE CODE ────────────────────────────────────────────────────────
export async function regenerateVolunteerCode(
  id: string
): Promise<ActionResult> {
  const { svc } = await requireVolunteerChapterAdmin(id);

  // Retry on 23505: either the partial unique index inside volunteers, or the
  // cross-table guard trigger, which raises unique_violation too.
  for (let attempt = 0; attempt < 5; attempt++) {
    let access_code: string;
    try {
      access_code = await uniqueVolunteerAccessCode(svc);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const { error } = await svc
      .schema("future")
      .from("volunteers")
      .update({ access_code })
      .eq("id", id);

    if (!error) {
      revalidatePath("/yi-future/chapter/volunteers");
      return { ok: true, message: `New code: ${access_code}` };
    }
    if (error.code !== "23505") return { ok: false, error: error.message };
  }

  return {
    ok: false,
    error: "Could not allocate a free code — please try once more.",
  };
}

// ─── REVOKE CODE ────────────────────────────────────────────────────────────
export async function revokeVolunteerCode(id: string): Promise<ActionResult> {
  const { svc } = await requireVolunteerChapterAdmin(id);
  // Clearing access_code kills the desk on the NEXT tap, not the next login:
  // requireDeskVolunteer() re-reads access_code on every desk action.
  const { error } = await svc
    .schema("future")
    .from("volunteers")
    .update({ access_code: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/volunteers");
  return { ok: true, message: "Code revoked — that volunteer is signed out." };
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
export async function deleteVolunteer(id: string): Promise<ActionResult> {
  const { svc } = await requireVolunteerChapterAdmin(id);
  // Attendance rows they marked are KEPT: marked_by_volunteer_id is
  // ON DELETE SET NULL, so the check-in survives and only the attribution is
  // lost. Deleting the desk staff must never delete a delegate's attendance.
  const { error } = await svc
    .schema("future")
    .from("volunteers")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/volunteers");
  return { ok: true, message: "Volunteer removed." };
}

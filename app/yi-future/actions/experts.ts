"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { ActionResult } from "./editions";
import {
  requireFutureAdmin,
  requireFutureNationalAdmin,
  requireChapterAdmin,
} from "@/lib/yi-future/auth/require-access";

// experts.access_code / is_active are new columns not yet in the generated
// `future` types — use a loose client (the codebase pattern for untyped
// columns; see push.ts / announcements.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

/**
 * Experts are an EDITION-WIDE shared pool: future.experts carries only
 * edition_id — no chapter column and no chapter-bearing parent — so there is
 * genuinely no chapter to scope to. Chapter-scoping is impossible here without
 * a schema change (a chapter_id column, or a chapter↔expert join table).
 *
 * Rather than lock the whole pool to national and take away a workflow chapter
 * chairs use today (/yi-future/chapter/experts has add/edit/delete pages, and
 * there are live experts in the pool), the gate is split by blast radius:
 *
 *   ADDITIVE  (create, update) — any Future admin, as before. Adding an expert
 *   or fixing their title cannot take anything away from another chapter, and
 *   chapter chairs need this in the run-up to their own final.
 *
 *   DESTRUCTIVE (delete, regenerate access code) — NATIONAL only. Deleting a
 *   shared expert removes them from every chapter's sessions, and regenerating
 *   their code invalidates the one they are already holding. Neither is
 *   recoverable by the chapter that loses out, and neither is urgent enough to
 *   justify leaving takeover-grade power with 73 chapter admins.
 *
 * Wiring an expert INTO a specific session stays chapter-scoped — see
 * assignExpertToPhaseEvent below.
 *
 * PROPER FIX (needs a migration, not a gate change): give future.experts a
 * chapter_id, then scope all four with requireChapterAdmin.
 */
async function requireExpertEditor(): Promise<void> {
  await requireFutureAdmin();
}

async function requireExpertAdmin(): Promise<void> {
  await requireFutureNationalAdmin();
}

function parseExpertise(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Unique 6-char access code among experts (login resolves experts by code).
async function uniqueExpertCode(svc: LooseClient): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("experts")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate unique access code after 25 tries.");
}

export async function createExpert(
  editionId: string,
  formData: FormData,
  chapterId?: string | null
): Promise<ActionResult> {
  await requireExpertEditor();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const expertise_raw = String(formData.get("expertise_areas") ?? "").trim();
  const expertise_areas = expertise_raw ? parseExpertise(expertise_raw) : null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = (await createServiceClient()) as LooseClient;
  const access_code = await uniqueExpertCode(svc);
  const { error } = await svc
    .schema("future")
    .from("experts")
    .insert({
      edition_id: editionId,
      // Stamp the creating chapter so this expert — and their access code —
      // is visible to that chapter alone. Rows predating 2026-08-10 carry
      // NULL and stay in the shared pool; see the migration for why they
      // could not be attributed.
      chapter_id: chapterId ?? null,
      full_name,
      title,
      organization,
      email,
      phone,
      bio,
      expertise_areas,
      access_code,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  redirect("/yi-future/chapter/experts");
}

export async function updateExpert(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireExpertEditor();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const expertise_raw = String(formData.get("expertise_areas") ?? "").trim();
  const expertise_areas = expertise_raw ? parseExpertise(expertise_raw) : null;

  if (!full_name) return { ok: false, error: "Full name is required." };

  const svc = (await createServiceClient()) as LooseClient;
  const { error } = await svc
    .schema("future")
    .from("experts")
    .update({
      full_name,
      title,
      organization,
      email,
      phone,
      bio,
      expertise_areas,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  redirect("/yi-future/chapter/experts");
}

export async function deleteExpert(id: string): Promise<ActionResult> {
  await requireExpertAdmin();
  const svc = (await createServiceClient()) as LooseClient;

  // Experts are an edition-wide shared pool; a single chapter admin must not be
  // able to silently rip an expert out of OTHER chapters' sessions. Refuse the
  // delete while the expert is still assigned anywhere — surface a clear,
  // actionable error instead of cascading.
  const { count: assignedCount } = await svc
    .schema("future")
    .from("phase_events")
    .select("id", { count: "exact", head: true })
    .eq("expert_id", id);
  if ((assignedCount ?? 0) > 0) {
    return {
      ok: false,
      error: `This expert is assigned to ${assignedCount} session${
        assignedCount === 1 ? "" : "s"
      }. Unassign them from those sessions first.`,
    };
  }

  const { error } = await svc
    .schema("future")
    .from("experts")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/experts");
  return { ok: true, message: "Expert removed." };
}

// ─── ACCESS CODE ────────────────────────────────────────────────────
export async function regenerateExpertAccessCode(
  id: string
): Promise<ActionResult> {
  await requireExpertAdmin();
  const svc = (await createServiceClient()) as LooseClient;
  const access_code = await uniqueExpertCode(svc);
  const { error } = await svc
    .schema("future")
    .from("experts")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/experts");
  return { ok: true, message: `New code: ${access_code}` };
}

// ─── ASSIGN EXPERT ↔ PHASE EVENT (chapter-scoped) ───────────────────
// A phase_event already has a nullable expert_id. Assignment is gated by the
// EVENT's chapter (a chair of chapter A cannot wire an expert into chapter B's
// session). One expert per event; setting a new one replaces the prior.
async function eventChapterId(
  svc: LooseClient,
  phaseEventId: string
): Promise<string | null> {
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("chapter_id")
    .eq("id", phaseEventId)
    .maybeSingle();
  return (data as { chapter_id: string | null } | null)?.chapter_id ?? null;
}

export async function assignExpertToPhaseEvent(
  expertId: string,
  phaseEventId: string
): Promise<ActionResult> {
  if (!expertId || !phaseEventId) {
    return { ok: false, error: "Missing expert or event." };
  }
  const svc = (await createServiceClient()) as LooseClient;
  const chapterId = await eventChapterId(svc, phaseEventId);
  if (!chapterId) return { ok: false, error: "Session not found." };
  await requireChapterAdmin(chapterId);

  const { error } = await svc
    .schema("future")
    .from("phase_events")
    .update({ expert_id: expertId })
    .eq("id", phaseEventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  revalidatePath("/yi-future/chapter/journey");
  return { ok: true, message: "Assigned to session." };
}

export async function unassignExpertFromPhaseEvent(
  phaseEventId: string
): Promise<ActionResult> {
  if (!phaseEventId) return { ok: false, error: "Missing event." };
  const svc = (await createServiceClient()) as LooseClient;
  const chapterId = await eventChapterId(svc, phaseEventId);
  if (!chapterId) return { ok: false, error: "Session not found." };
  await requireChapterAdmin(chapterId);

  const { error } = await svc
    .schema("future")
    .from("phase_events")
    .update({ expert_id: null })
    .eq("id", phaseEventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/experts");
  revalidatePath("/yi-future/chapter/journey");
  return { ok: true, message: "Removed from session." };
}

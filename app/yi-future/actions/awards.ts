"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { AWARD_CATEGORIES } from "@/lib/yi-future/constants";
import { sendPushToSubject } from "@/lib/yi-future/push";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

type AwardCategory = Database["future"]["Enums"]["award_category"];

/**
 * Awards hang off a chapter-final / regional-finale event → resolve THAT
 * event's chapter so a chair of chapter A cannot announce or delete chapter B's
 * awards. Fails closed: an unresolvable chapter denies every non-national
 * caller.
 */
async function requireEventChapterAdmin(eventId: string): Promise<string> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("chapter_id")
    .eq("id", eventId)
    .maybeSingle();
  const access = await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
  return access.userId;
}

/** Award row → its event → that event's chapter. */
async function requireAwardChapterAdmin(awardId: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("awards")
    .select("event_id")
    .eq("id", awardId)
    .maybeSingle();
  const eventId =
    (data as { event_id: string | null } | null)?.event_id ?? null;
  if (!eventId) {
    await requireChapterAdmin(null);
    return;
  }
  await requireEventChapterAdmin(eventId);
}

function isValidCategory(x: string): x is AwardCategory {
  return (AWARD_CATEGORIES as readonly string[]).includes(x);
}

export async function announceAward(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireEventChapterAdmin(eventId);
  const team_id = String(formData.get("team_id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const citation = String(formData.get("citation") ?? "").trim() || null;
  const custom_label =
    String(formData.get("custom_label") ?? "").trim() || null;
  const position_raw = String(formData.get("position") ?? "").trim();
  const position = position_raw ? Number(position_raw) : null;

  if (!team_id) return { ok: false, error: "Pick a team." };
  if (!isValidCategory(category)) {
    return { ok: false, error: "Invalid category." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("awards")
    .insert({
      event_id: eventId,
      team_id,
      category: category as AwardCategory,
      citation,
      custom_label,
      position,
      announced_at: new Date().toISOString(),
      announced_by: userId,
    });
  if (error) return { ok: false, error: safeError(error.message, "awards.announceAward") };

  revalidatePath("/yi-future/chapter/final");
  revalidatePath("/yi-future/chapter/results");
  revalidatePath("/yi-future/host");
  revalidatePath("/yi-future/me");

  // Fire-and-forget push to every delegate on the winning team
  try {
    const { data: members } = await (svc as any)
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .eq("team_id", team_id);
    const rows =
      (members as { delegate_id: string | null }[] | null) ?? [];
    const label = custom_label ?? category;
    await Promise.all(
      rows
        .map((r) => r.delegate_id)
        .filter((id): id is string => Boolean(id))
        .map((delegateId) =>
          sendPushToSubject("delegate", delegateId, {
            title: "🏆 Award announced!",
            body: `Your team won: ${label}`,
            url: "/me/results",
          }).catch((err) =>
            console.error("[push] announceAward notify delegate failed:", err)
          )
        )
    );
  } catch (err) {
    console.error("[push] announceAward notify members failed:", err);
  }

  return { ok: true, message: "Award announced." };
}

export async function deleteAward(id: string): Promise<ActionResult> {
  await requireAwardChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("awards")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "awards.deleteAward") };
  revalidatePath("/yi-future/chapter/results");
  revalidatePath("/yi-future/host");
  return { ok: true };
}

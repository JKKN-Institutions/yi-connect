"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { AWARD_CATEGORIES } from "@/lib/yi-future/constants";
import { sendPushToSubject } from "@/app/yi-future/actions/push";

type AwardCategory = Database["future"]["Enums"]["award_category"];

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

function isValidCategory(x: string): x is AwardCategory {
  return (AWARD_CATEGORIES as readonly string[]).includes(x);
}

export async function announceAward(
  eventId: string,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireAuth();
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
  if (error) return { ok: false, error: error.message };

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
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("awards")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/results");
  revalidatePath("/yi-future/host");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  effectiveMinistries,
  effectiveCabinetCount,
  hasCabinetOverride,
  type MinistryPortfolio,
} from "@/lib/yip/cabinet";

export type CabinetConfig = {
  ministries: MinistryPortfolio[];
  count: number;
  configured: boolean;
};

/**
 * The effective cabinet for an event: the per-event override when set, else the
 * MINISTRIES default. Read-only and unauthenticated-safe (ministry names are
 * not sensitive) — used by the vote manager and allocation UI to size the
 * cabinet correctly.
 */
export async function getCabinetConfig(eventId: string): Promise<CabinetConfig> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("cabinet_ministry_count, cabinet_ministries")
    .eq("id", eventId)
    .single();
  const count = data?.cabinet_ministry_count ?? null;
  const ministriesJson = data?.cabinet_ministries ?? null;
  return {
    ministries: effectiveMinistries(ministriesJson),
    count: effectiveCabinetCount(count, ministriesJson),
    configured: hasCabinetOverride(count, ministriesJson),
  };
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "ministry"
  );
}

/**
 * Set (or clear) the per-event cabinet portfolios. Pass the ministry display
 * names (one per portfolio); an empty list clears the override so the event
 * falls back to the MINISTRIES default. Organiser-gated (canManage).
 */
export async function setCabinetMinistries(
  eventId: string,
  names: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const cleaned = names.map((n) => n.trim()).filter((n) => n.length > 0);
  if (cleaned.length > 30) {
    return { success: false, error: "That's too many ministries (max 30)." };
  }

  const supabase = await createServiceClient();

  if (cleaned.length === 0) {
    // Clear override → fall back to the default cabinet.
    const { error } = await supabase
      .from("events")
      .update({ cabinet_ministries: null, cabinet_ministry_count: null })
      .eq("id", eventId);
    if (error) return { success: false, error: error.message };
    revalidatePath(`/yip/dashboard/events/${eventId}/cabinet`);
    revalidatePath(`/yip/dashboard/events/${eventId}/control`);
    return { success: true, count: 0 };
  }

  // Build portfolios with unique keys (suffix on collision).
  const seen = new Map<string, number>();
  const ministries: MinistryPortfolio[] = cleaned.map((label) => {
    let key = slugify(label);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n > 0) key = `${key}_${n + 1}`;
    return { key, label };
  });

  const { error } = await supabase
    .from("events")
    .update({
      cabinet_ministries: ministries,
      cabinet_ministry_count: ministries.length,
    })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/cabinet`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  return { success: true, count: ministries.length };
}

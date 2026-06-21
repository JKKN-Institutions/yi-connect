"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

/**
 * Sign-up funnel for the National Overview: how many students signed up,
 * how many got assigned a party (allocation run), and how many have checked in.
 * Two reads (real events + their participants); everything derived in memory.
 */
export async function getSignupFunnel(): Promise<{
  enrolled: number;
  allocated: number;
  checkedIn: number;
}> {
  const supabase = await createServiceClient();

  const { data: eventsRaw } = await supabase
    .from("events")
    .select("id")
    .eq("is_mock", false);
  const eventIds = (eventsRaw ?? []).map((e) => e.id);
  const safeIds = eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: partsRaw } = await supabase
    .from("participants")
    .select("event_id, party_side, checked_in_day1")
    .in("event_id", safeIds);
  const parts = partsRaw ?? [];

  const enrolled = parts.length;
  const allocated = parts.filter((p) => p.party_side != null).length;
  const checkedIn = parts.filter((p) => p.checked_in_day1 === true).length;

  return { enrolled, allocated, checkedIn };
}

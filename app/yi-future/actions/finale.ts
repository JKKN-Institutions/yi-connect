"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

/**
 * Mark a team as advancing to the National Finals.
 * Updates the team status to "national_finalist".
 */
export async function markTeamAdvanced(teamId: string) {
  const svc = await createServiceClient();

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({ status: "national_finalist" })
    .eq("id", teamId);

  if (error) {
    throw new Error(`Failed to advance team: ${error.message}`);
  }

  revalidatePath("/yi-future/host/finale/live");
}

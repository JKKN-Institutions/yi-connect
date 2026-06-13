"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

/**
 * Mark a team as advancing to the National Finals.
 * Updates the team status to "national_finalist".
 */
export async function markTeamAdvanced(teamId: string) {
  // SECURITY: advancing a team is an admin-only action. Without this any
  // delegate who knows a teamId could promote any team to national finalist.
  // Host chairs (chapter core-team) + national admins pass; delegates denied.
  await requireFutureAdmin();

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

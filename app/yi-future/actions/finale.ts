"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

/**
 * Chapter-scope for advancing a team. The Advance button lives on the regional
 * finale HOST's live page and its finalists come from other chapters, so the
 * chapter that must be administered is the one hosting the finale event the
 * team was advanced to (advancements.to_event_id → events.chapter_id). Falls
 * back to the team's own chapter when no advancement row exists. Fails closed
 * on null (requireChapterAdmin denies).
 */
async function requireAdvancementChapterAdmin(teamId: string): Promise<void> {
  const svc = await createServiceClient();

  const { data: advRows } = await svc
    .schema("future")
    .from("advancements")
    .select("to_event_id")
    .eq("team_id", teamId);
  const toEventId =
    ((advRows as { to_event_id: string | null }[] | null) ?? [])
      .map((r) => r.to_event_id)
      .find((v): v is string => !!v) ?? null;

  if (toEventId) {
    const { data: ev } = await svc
      .schema("future")
      .from("events")
      .select("chapter_id")
      .eq("id", toEventId)
      .maybeSingle();
    const hostChapterId =
      (ev as { chapter_id: string | null } | null)?.chapter_id ?? null;
    if (hostChapterId) {
      await requireChapterAdmin(hostChapterId);
      return;
    }
  }

  const { data: team } = await svc
    .schema("future")
    .from("teams")
    .select("chapter_id")
    .eq("id", teamId)
    .maybeSingle();
  await requireChapterAdmin(
    (team as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
}

/**
 * Mark a team as advancing to the National Finals.
 * Updates the team status to "national_finalist".
 */
export async function markTeamAdvanced(teamId: string) {
  // SECURITY: advancing a team is an admin-only action, scoped to the chapter
  // hosting this team's finale — a chair of an unrelated chapter must not
  // promote it. National admins pass; delegates denied.
  await requireAdvancementChapterAdmin(teamId);

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

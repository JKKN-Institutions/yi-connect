"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * DPDP: permanently anonymize the personal data (name → stable pseudonym;
 * email / phone / parent_phone / school NULLed or placeholdered) of the
 * participants AND volunteers of the given events. Irreversible.
 *
 * Anonymizing (not deleting) keeps scores / results / awards coherent by id
 * while removing personal data — compliant, since anonymized data is no longer
 * personal data. The per-row pseudonym is applied in SQL
 * (yip.fn_anonymize_event_pii) because a per-row expression can't be expressed
 * via a single PostgREST update.
 *
 * Gated PER EVENT to super-admin + regional admin + chapter chair via
 * getYipEventAccess.canDelete (organisers cannot). Each event is audit-logged
 * as a "wipe". Events the caller can't delete are skipped, not failed.
 */
export async function anonymizeEventPII(eventIds: string[]): Promise<
  ActionResult<{
    events_anonymized: number;
    participants: number;
    volunteers: number;
    skipped_unauthorized: number;
  }>
> {
  if (!eventIds || eventIds.length === 0) {
    return { success: false, error: "No events selected." };
  }

  // Per-event authorization: only events the caller may delete (chair / regional
  // / super-admin). Unauthorized ones are dropped, not failed.
  const authorized: string[] = [];
  let skipped = 0;
  for (const id of eventIds) {
    const access = await getYipEventAccess(id);
    if (access.canDelete) authorized.push(id);
    else skipped++;
  }
  if (authorized.length === 0) {
    return {
      success: false,
      error:
        "You're not authorized to remove personal data for any of the selected events.",
    };
  }

  const supabase = await createServiceClient();
  let totalParticipants = 0;
  let totalVolunteers = 0;
  let done = 0;

  for (const id of authorized) {
    const { data, error } = await supabase.rpc("fn_anonymize_event_pii", {
      p_event_id: id,
    });
    if (error) {
      return {
        success: false,
        error: `Removed data for ${done} event(s); then failed on one: ${error.message}`,
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    const p = row?.participants_anonymized ?? 0;
    const v = row?.volunteers_anonymized ?? 0;
    totalParticipants += p;
    totalVolunteers += v;
    done++;

    await logAuditAction({
      action_type: "wipe",
      target_table: "participants",
      target_event_id: id,
      metadata: {
        action: "dpdp_anonymize",
        participants_anonymized: p,
        volunteers_anonymized: v,
      },
    });
    revalidatePath(`/yip/dashboard/events/${id}/participants`);
  }

  return {
    success: true,
    data: {
      events_anonymized: done,
      participants: totalParticipants,
      volunteers: totalVolunteers,
      skipped_unauthorized: skipped,
    },
  };
}

// ─── Per-chapter privacy default (standing setting) ────────────────────────

export type ChapterPrivacyRow = {
  yi_chapter: string;
  privacy_default: boolean;
};

/**
 * Every chapter that runs events, with its DPDP privacy default. Chapters with
 * the default ON have their NEW events created in privacy mode (auto-anonymize
 * after results). Super-admin only.
 */
export async function listChapterPrivacyDefaults(): Promise<ChapterPrivacyRow[]> {
  if (!(await isCurrentUserSuperAdmin())) return [];
  const supabase = await createServiceClient();
  const [{ data: events }, { data: prefs }] = await Promise.all([
    supabase
      .from("events")
      .select("chapter_name")
      .eq("level", "chapter")
      .eq("is_mock", false)
      .not("chapter_name", "is", null),
    supabase.from("chapter_privacy").select("yi_chapter, privacy_default"),
  ]);
  const defaults = new Map(
    (prefs ?? []).map((p) => [p.yi_chapter, p.privacy_default])
  );
  const chapters = Array.from(
    new Set((events ?? []).map((e) => e.chapter_name).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));
  return chapters.map((yi_chapter) => ({
    yi_chapter,
    // Privacy-by-default (DPDP data-minimisation): a chapter with no explicit
    // preference is ON. A chapter opts OUT by toggling off, which stores an
    // explicit `false` row that is then honoured here.
    privacy_default: defaults.get(yi_chapter) ?? true,
  }));
}

/**
 * Set (upsert) a chapter's DPDP privacy default. Affects only FUTURE events for
 * the chapter — existing events keep their current privacy_mode (clean those
 * with the per-event "Remove personal data" tool). Super-admin only.
 */
export async function setChapterPrivacyDefault(
  yiChapter: string,
  enabled: boolean
): Promise<ActionResult<{ yi_chapter: string; privacy_default: boolean }>> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { success: false, error: "Only super-admins can set chapter privacy defaults." };
  }
  if (!yiChapter?.trim()) {
    return { success: false, error: "Missing chapter." };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("chapter_privacy")
    .upsert(
      {
        yi_chapter: yiChapter,
        privacy_default: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "yi_chapter" }
    );
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "update",
    target_table: "chapter_privacy",
    metadata: { action: "set_privacy_default", yi_chapter: yiChapter, enabled },
  });
  revalidatePath("/yip/dashboard/admin/privacy");
  return { success: true, data: { yi_chapter: yiChapter, privacy_default: enabled } };
}

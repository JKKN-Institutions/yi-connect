"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
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

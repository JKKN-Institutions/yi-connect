"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { isAwardLabel, resolveAwardsForLevel } from "@/lib/yip/awards";
import { fetchEventRoundLevel } from "@/lib/yip/round-level";
import {
  ELIGIBILITY_PLAIN,
  roleEligibility,
  schoolCapApplies,
  SCHOOL_AWARD_CAP,
} from "@/lib/yip/award-eligibility";
import { computeResults } from "./results";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AwardOverride = {
  id: string;
  award_label: string;
  participant_id: string;
  participant_name: string | null;
  note: string | null;
  set_by_email: string | null;
  created_at: string;
};

const CHAIR_ONLY =
  "Only the chapter chair (or a regional/national admin) can override award winners.";

/**
 * Current manual award overrides for the event. Gated to the same audience that
 * can read results (national/super-admin) so the override panel only renders
 * where the leaderboard does.
 */
export async function getAwardOverrides(
  eventId: string
): Promise<AwardOverride[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return [];

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_overrides")
    .select(
      "id, award_label, participant_id, note, set_by_email, created_at, participant:participants(full_name)"
    )
    .eq("event_id", eventId)
    .order("award_label");

  if (error || !data) return [];
  return data.map((r) => {
    const participant = r.participant as { full_name: string } | null;
    return {
      id: r.id,
      award_label: r.award_label,
      participant_id: r.participant_id,
      participant_name: participant?.full_name ?? null,
      note: r.note,
      set_by_email: r.set_by_email,
      created_at: r.created_at,
    };
  });
}

/**
 * Pin THE winner of one award to a chosen participant (chair's final say).
 * Upserts the override and re-runs computeResults so it takes effect at once and
 * survives every future recompute (the override is applied as a final pass).
 *
 * `note` is REQUIRED (Director ruling 2026-08-29, ruling 07): a hand-picked
 * award is the one result no score explains, so the reason is the only record
 * of why that student won. Enforced here on the server, not just in the form.
 * Validated up front — before the participant lookup, the upsert, the recompute
 * and the rollback path — so a missing reason costs nothing but the round-trip.
 * Existing overrides saved before this rule keep their blank note untouched
 * (ruling 09); this gate binds WRITES only and never blocks a read.
 */
export async function setAwardWinner(
  eventId: string,
  awardLabel: string,
  participantId: string,
  note: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) return { success: false, error: CHAIR_ONLY };
  if (!isAwardLabel(awardLabel)) {
    return { success: false, error: "Unknown award." };
  }

  const reason = note?.trim() ?? "";
  if (!reason) {
    return {
      success: false,
      error:
        "Couldn't pin this winner: every hand-picked award needs a written reason. Say why this student won — it's the only record of the decision.",
    };
  }

  const supabase = await createServiceClient();

  // The pick must be a participant of THIS event (no cross-event override).
  const { data: participant } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "That participant is not in this event." };
  }

  // The pick must meet the award's eligibility — the SAME role/side rule the
  // engine ranks with (lib/yip/award-eligibility.ts), checked before any write.
  // The award is resolved exactly as computeResults resolves it (this round's
  // level → its award set → match by label). Not blocked here: an award with no
  // definition row, an in-code fallback award (no rank_mode — the engine keys
  // those on award_key, and every live row has rank_mode), or a rule that
  // depends on result data (roleEligibility → null, e.g. no disciplinary flag).
  const roundLevel = await fetchEventRoundLevel(supabase as never, eventId);
  const { data: allAwardDefs } = await (supabase as unknown as SupabaseClient)
    .from("award_definitions")
    .select("label, eligibility, rank_mode, levels");
  const def = resolveAwardsForLevel(
    (allAwardDefs ?? []) as {
      label: string;
      eligibility: string | null;
      rank_mode: string | null;
      levels: string[] | null;
    }[],
    roundLevel
  ).find((d) => d.label === awardLabel);
  if (def?.rank_mode) {
    const eligibility = def.eligibility ?? "all";
    if (
      roleEligibility(
        eligibility,
        participant.parliament_role,
        participant.party_side
      ) === false
    ) {
      const who = ELIGIBILITY_PLAIN[eligibility] ?? "not open to this student";
      return {
        success: false,
        error: `${participant.full_name} can't receive ${awardLabel}: this award is ${who}.`,
      };
    }
  }

  // Who is making the change (for the audit trail + the override card).
  let email: string | null = null;
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    email = user?.email ?? null;
  } catch {
    // best-effort — the override still records via the audit log
  }

  // Capture any existing override for this award so a blocked new pin (e.g. the
  // 3-per-school cap) can be rolled back without dropping the prior valid pin.
  const { data: priorOverride } = await supabase
    .from("award_overrides")
    .select("participant_id, note, set_by_email")
    .eq("event_id", eventId)
    .eq("award_label", awardLabel)
    .maybeSingle();

  const { error } = await supabase.from("award_overrides").upsert(
    {
      event_id: eventId,
      award_label: awardLabel,
      participant_id: participantId,
      note: reason,
      set_by_email: email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,award_label" }
  );
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "update",
    target_table: "award_overrides",
    target_id: participantId,
    target_event_id: eventId,
  });

  // Re-persist results so the override wins immediately.
  const recompute = await computeResults(eventId);
  if (!recompute.success) {
    return {
      success: false,
      error: `Override saved, but the results recompute failed: ${recompute.error}`,
    };
  }

  // The 3-per-school cap binds overrides too (Director ruling 2026-06-28): the
  // recompute leaves the auto-winner intact when a pin would breach the cap (or
  // when the pick didn't attend every day). Verify the pin actually landed; if
  // not, roll back to the prior state so a blocked pin doesn't silently drop an
  // earlier valid override, and tell the chair why.
  const { data: landedRow } = await supabase
    .from("results")
    .select("award_category, rank")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle();
  const landed = (landedRow?.award_category ?? "")
    .split(", ")
    .includes(awardLabel);
  if (!landed) {
    // Say the ACTUAL reason the recompute skipped this pin (read from the fresh
    // recompute, before the rollback below re-runs it). The override pass in
    // computeResults skips a pin for exactly these causes, checked in order.
    const name = participant.full_name;
    let why: string;
    if (!landedRow) {
      // No result row → the student has no submitted marks at all.
      why = `${name} has no marks yet, so there is no result to give an award to. Make sure the judges' scores for ${name} are submitted, recompute, then try again.`;
    } else if (
      landedRow.rank == null &&
      (landedRow.award_category ?? "").startsWith("Not ranked")
    ) {
      // The engine's own day-presence verdict, e.g. "Not ranked — absent Day 2".
      const detail = (landedRow.award_category ?? "").replace(
        /^Not ranked\s*—\s*/,
        ""
      );
      why = `${name} wasn't checked in on every day of the round (${detail}), and only students present every day can receive an award.`;
    } else {
      // Pinned to another award too? Each student holds one award, so the
      // other pin can take this one back.
      const { data: otherPin } = await supabase
        .from("award_overrides")
        .select("award_label")
        .eq("event_id", eventId)
        .eq("participant_id", participantId)
        .neq("award_label", awardLabel)
        .limit(1)
        .maybeSingle();
      if (otherPin) {
        why = `${name} is already pinned to ${otherPin.award_label}, and each student can hold only one award. Clear that pin first.`;
      } else if (schoolCapApplies(roundLevel)) {
        why = `${name}'s school already holds the maximum of ${SCHOOL_AWARD_CAP} awards at this chapter round. Choose a student from a school under the cap.`;
      } else {
        why = `the results recompute didn't give the award to ${name}. Check that ${name} has submitted marks for this award, then try again.`;
      }
    }

    if (priorOverride && priorOverride.participant_id !== participantId) {
      await supabase.from("award_overrides").upsert(
        {
          event_id: eventId,
          award_label: awardLabel,
          participant_id: priorOverride.participant_id,
          note: priorOverride.note,
          set_by_email: priorOverride.set_by_email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,award_label" }
      );
      await computeResults(eventId);
    } else {
      await supabase
        .from("award_overrides")
        .delete()
        .eq("event_id", eventId)
        .eq("award_label", awardLabel);
    }
    revalidatePath(`/yip/dashboard/events/${eventId}/results`);
    return {
      success: false,
      error: `Couldn't pin this winner: ${why}`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return { success: true, data: null };
}

/** Remove an award override → the auto-computed winner takes the award back. */
export async function clearAwardOverride(
  eventId: string,
  awardLabel: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) return { success: false, error: CHAIR_ONLY };
  if (!isAwardLabel(awardLabel)) {
    return { success: false, error: "Unknown award." };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("award_overrides")
    .delete()
    .eq("event_id", eventId)
    .eq("award_label", awardLabel);
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "delete",
    target_table: "award_overrides",
    target_event_id: eventId,
  });

  const recompute = await computeResults(eventId);
  if (!recompute.success) {
    return {
      success: false,
      error: `Override cleared, but the results recompute failed: ${recompute.error}`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return { success: true, data: null };
}

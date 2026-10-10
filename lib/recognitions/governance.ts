import "server-only";

import { audit, type AwardState } from "./data";
import { rxService } from "./supabase";

/**
 * Write one governance decision on the award's latest submitted moderation
 * (Phase 4). NO permission check here: the caller passes a gate first
 * (governance.ts: National Leadership; nl-add.ts: National Leadership or
 * the Recognitions super admin, Director 2026-10-10). Decisions are
 * append-only rows; a "reevaluate" row is what the NMT leader sees as the
 * send-back in the Stage 2 room.
 */
export async function recordDecision(input: {
  state: AwardState;
  personId: string;
  decision: "approve" | "reevaluate";
  reason: string | null;
  /** Extra audit detail (e.g. which chapter an add-a-chapter send-back added). */
  auditDetail?: Record<string, unknown>;
}): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const { state, personId, decision, reason } = input;
  if (state.phase !== "governance") {
    return {
      ok: false,
      error:
        state.phase === "finalized"
          ? "This award is already finalised."
          : state.phase === "reevaluation"
            ? "This award has already been sent back. Wait for the NMT leader to submit a revised version."
            : "There is no submitted moderation waiting for a decision on this award.",
    };
  }
  const version = state.latestSubmittedVersion;
  if (!version || version.id !== state.latestVersion?.id) {
    return { ok: false, error: "The moderation changed while you were reading. Reload the page and decide again." };
  }

  const { data, error } = await rxService()
    .from("recognition_governance_decisions")
    .insert({
      award_id: state.award.id,
      moderation_version_id: version.id,
      decision,
      reason,
      decided_by: personId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(JSON.stringify({ tag: "recognitions_decision_write_failed", error: error?.message }));
    return {
      ok: false,
      error: "The decision could not be recorded. Reload the page and try again; if it keeps failing, tell the Recognitions super admin.",
    };
  }

  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: decision === "approve" ? "award_approved" : "award_sent_back",
    entity: "governance_decision",
    entityId: (data as { id: string }).id,
    detail: { moderation_version: version.version, moderation_version_id: version.id, reason, ...(input.auditDetail ?? {}) },
  });
  return { ok: true, version: version.version };
}

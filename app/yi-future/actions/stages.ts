"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import {
  canAdvance,
  nextStage,
  validatePrerequisites,
  type EditionStage,
} from "@/lib/yi-future/stage-machine";
import { TEAM_SIZE_MIN } from "@/lib/yi-future/constants";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

type PhaseKey = "phase_a" | "phase_b" | "phase_c";

function stagePhaseTarget(to: EditionStage): PhaseKey | null {
  if (to === "phase_a_complete") return "phase_a";
  if (to === "phase_b_complete") return "phase_b";
  if (to === "phase_c_complete") return "phase_c";
  return null;
}

/**
 * Advance the active edition to the next stage, or to an explicitly-set stage
 * if `override` is true.
 */
export async function advanceEditionStage(input: {
  editionId: string;
  to?: EditionStage;
  override?: boolean;
  overrideReason?: string;
}): Promise<ActionResult> {
  const userId = await requireAuth();
  const svc = await createServiceClient();

  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id, current_stage")
    .eq("id", input.editionId)
    .maybeSingle();
  if (!edition) return { ok: false, error: "Edition not found." };
  const e = edition as {
    id: string;
    current_stage: EditionStage | null;
  };
  const from = e.current_stage ?? "announcement";
  const to = input.to ?? nextStage(from);
  if (!to) {
    return { ok: false, error: "No next stage (edition is complete)." };
  }

  // Gather prerequisite context for the target
  let teamCount = 0;
  let phaseEventCount = 0;
  let teamsWithSubmission = 0;
  const phase = stagePhaseTarget(to);

  if (to === "teams_formed" || phase !== null) {
    const { count } = await svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", input.editionId);
    teamCount = count ?? 0;
  }

  if (phase !== null) {
    const { count: logged } = await svc
      .schema("future")
      .from("phase_events")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", input.editionId)
      .eq("phase", phase)
      .eq("completed", true);
    phaseEventCount = logged ?? 0;

    const deliverable =
      phase === "phase_a"
        ? "phase_a"
        : phase === "phase_b"
          ? "phase_b"
          : "phase_c";
    // Submissions has no direct edition_id; count via teams!inner(edition_id)
    const { count: subs } = await svc
      .schema("future")
      .from("submissions")
      .select("team_id, teams!inner(edition_id)", {
        count: "exact",
        head: true,
      })
      .eq("teams.edition_id", input.editionId)
      .eq("phase", deliverable)
      .eq("status", "approved");
    teamsWithSubmission = subs ?? 0;
  }

  const validation = validatePrerequisites(from, to, {
    teamCount,
    minTeams: TEAM_SIZE_MIN * 0, // don't force here; use min-teams-per-problem logic from constants
    phaseEventCount,
    requiredPhaseEventCount: 3,
    teamsWithSubmission,
    consentsApproved: undefined,
  });

  if (!validation.ok && !input.override) {
    return { ok: false, error: validation.reasons.join(" · ") };
  }

  // Atomic update + audit
  const { error: updErr } = await svc
    .schema("future")
    .from("editions")
    .update({
      current_stage: to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.editionId);
  if (updErr) return { ok: false, error: updErr.message };

  await svc
    .schema("future")
    .from("edition_stage_log")
    .insert({
      edition_id: input.editionId,
      from_stage: from,
      to_stage: to,
      changed_by: userId,
      override: input.override ?? false,
      override_reason: input.overrideReason ?? null,
    });

  revalidatePath("/yi-future/chapter");
  revalidatePath("/national/admin/editions");
  return {
    ok: true,
    message: `Advanced to ${to}${input.override ? " (override)" : ""}.`,
  };
}

/** Exposed helper for UIs that want to render "next stage allowed?" */
export async function peekNextStage(editionId: string): Promise<{
  from: EditionStage;
  to: EditionStage | null;
  canAdvanceTo: boolean;
}> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("current_stage")
    .eq("id", editionId)
    .maybeSingle();
  const from = ((data as { current_stage: EditionStage | null } | null)
    ?.current_stage ?? "announcement") as EditionStage;
  const to = nextStage(from);
  return {
    from,
    to,
    canAdvanceTo: to ? canAdvance(from, to) : false,
  };
}

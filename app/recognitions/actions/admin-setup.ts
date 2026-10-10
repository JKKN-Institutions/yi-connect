"use server";

import { revalidatePath } from "next/cache";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { audit, getAward, getAwardState, getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { VERTICALS, VERTICAL_LABEL, type Vertical } from "@/lib/recognitions/constants";
import type { ActionResult } from "@/lib/recognitions/types";
import { istInputToIso, plainDbError } from "../(desk)/admin/_lib/ist";

/**
 * Control room: cycles, timeline, weights, awards, and the Stage 2 escape
 * hatch. Every action passes requireRxSuperAdmin first.
 */

function done() {
  revalidatePath("/recognitions", "layout");
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

export async function createCycle(input: {
  name: string;
  yiYear: number;
  makeCurrent: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const name = (input.name ?? "").trim();
  const year = Number(input.yiYear);
  if (name === "") return { success: false, error: "Give the cycle a name, for example \"Take Pride 2026\"." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return { success: false, error: "The Yi year must be a four-digit year." };

  const svc = rxService();
  const { data, error } = await svc
    .from("recognition_cycles")
    .insert({ name, yi_year: year, created_by: gate.viewer.personId })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: plainDbError(error?.message, "Couldn't create the cycle.") };
  const id = (data as { id: string }).id;
  await audit({ cycleId: id, actorPersonId: gate.viewer.personId, action: "create", entity: "cycle", entityId: id, detail: { name, yi_year: year } });

  if (input.makeCurrent) {
    const r = await makeCycleCurrent(id);
    if (!r.success) return { success: false, error: `The cycle was created, but ${r.error.charAt(0).toLowerCase()}${r.error.slice(1)}` };
  }
  done();
  return { success: true, data: { id }, message: `Created ${name}.` };
}

export async function makeCycleCurrent(cycleId: string): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const svc = rxService();
  const { data: target } = await svc.from("recognition_cycles").select("id, name, is_current").eq("id", cycleId).maybeSingle();
  if (!target) return { success: false, error: "That cycle no longer exists." };
  if ((target as { is_current: boolean }).is_current) return { success: true, message: "That cycle is already current." };

  // Only one cycle may be current (partial unique index): clear the old one first.
  const { error: clearErr } = await svc
    .from("recognition_cycles")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("is_current", true);
  if (clearErr) return { success: false, error: "Couldn't clear the old current cycle. Try again." };
  const { error } = await svc
    .from("recognition_cycles")
    .update({ is_current: true, updated_at: new Date().toISOString() })
    .eq("id", cycleId);
  if (error) return { success: false, error: plainDbError(error.message, "Couldn't make that cycle current.") };

  await audit({ cycleId, actorPersonId: gate.viewer.personId, action: "make_current", entity: "cycle", entityId: cycleId });
  done();
  return { success: true, message: `${(target as { name: string }).name} is now the current cycle.` };
}

export async function updateCycleSettings(input: {
  cycleId: string;
  name: string;
  nominationDeadline: string;
  fixDeadline: string;
  checkDeadline: string;
  stage1Deadline: string;
  stage2Deadline: string;
  reevaluationDeadline: string;
  weight1: number;
  weight2: number;
  weight3: number;
  layer2Mode: "raw" | "percentile";
  quizOpen: boolean;
}): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const name = (input.name ?? "").trim();
  if (name === "") return { success: false, error: "The cycle needs a name." };

  const labels = [
    ["nominationDeadline", "Nomination deadline"],
    // recognitions_02: sent-back nominations are fixed, then the checks close.
    ["fixDeadline", "Fix deadline"],
    ["checkDeadline", "Check deadline"],
    ["stage1Deadline", "Stage 1 deadline"],
    ["stage2Deadline", "Stage 2 deadline"],
    ["reevaluationDeadline", "Re-evaluation deadline"],
  ] as const;
  const iso: Record<string, string | null> = {};
  for (const [key, label] of labels) {
    const r = istInputToIso(input[key]);
    if ("error" in r) return { success: false, error: `${label}: ${r.error}` };
    iso[key] = r.iso;
  }
  // The phases run in this order, so each set deadline must come after the one before it.
  const ordered = labels.map(([k, l]) => [iso[k], l] as const).filter(([v]) => v !== null) as Array<readonly [string, string]>;
  for (let i = 1; i < ordered.length; i++) {
    if (Date.parse(ordered[i][0]) < Date.parse(ordered[i - 1][0]))
      return { success: false, error: `The ${ordered[i][1].toLowerCase()} is before the ${ordered[i - 1][1].toLowerCase()}. Put them in order.` };
  }

  const w = [input.weight1, input.weight2, input.weight3].map(Number);
  if (w.some((x) => !Number.isInteger(x) || x < 0 || x > 100))
    return { success: false, error: "Each weight must be a whole number from 0 to 100." };
  if (w[0] + w[1] + w[2] !== 100)
    return { success: false, error: `The weights add up to ${w[0] + w[1] + w[2]}. They must add up to 100.` };
  if (input.layer2Mode !== "raw" && input.layer2Mode !== "percentile")
    return { success: false, error: "Choose how Layer 2 is counted." };

  const svc = rxService();
  const { data: before } = await svc.from("recognition_cycles").select("*").eq("id", input.cycleId).maybeSingle();
  if (!before) return { success: false, error: "That cycle no longer exists." };

  const patch = {
    name,
    nomination_deadline: iso.nominationDeadline,
    fix_deadline: iso.fixDeadline,
    check_deadline: iso.checkDeadline,
    stage1_deadline: iso.stage1Deadline,
    stage2_deadline: iso.stage2Deadline,
    reevaluation_deadline: iso.reevaluationDeadline,
    weight_layer1: w[0],
    weight_layer2: w[1],
    weight_layer3: w[2],
    layer2_mode: input.layer2Mode,
    quiz_open: !!input.quizOpen,
    updated_at: new Date().toISOString(),
  };
  const { error } = await svc.from("recognition_cycles").update(patch).eq("id", input.cycleId);
  if (error) return { success: false, error: plainDbError(error.message, "Couldn't save the timeline.") };

  const b = before as Record<string, unknown>;
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "updated_at") continue;
    if (String(b[k] ?? "") !== String(v ?? "") && !(typeof v === "string" && b[k] && Date.parse(String(b[k])) === Date.parse(v)))
      changed[k] = { from: b[k] ?? null, to: v };
  }
  await audit({ cycleId: input.cycleId, actorPersonId: gate.viewer.personId, action: "update", entity: "cycle", entityId: input.cycleId, detail: changed });
  done();
  return { success: true, message: Object.keys(changed).length ? "Timeline and weights saved." : "Nothing changed." };
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

export async function saveAward(input: {
  awardId?: string | null;
  vertical: Vertical;
  title: string;
  criteria: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "Open a cycle on the Timeline page first." };

  const title = (input.title ?? "").trim();
  if (title === "") return { success: false, error: "Give the award a title, for example \"Learning Excellence\"." };
  const sort = Number(input.sortOrder);
  if (!Number.isInteger(sort)) return { success: false, error: "Sort order must be a whole number." };
  const criteria = (input.criteria ?? "").trim() || null;
  const svc = rxService();

  if (input.awardId) {
    const award = await getAward(input.awardId);
    if (!award || award.cycle_id !== cycle.id) return { success: false, error: "That award is not in the current cycle." };
    // The vertical of an existing award never changes; add a new award instead.
    const patch = { title, criteria, sort_order: sort, is_active: !!input.isActive, updated_at: new Date().toISOString() };
    const { error } = await svc.from("recognition_awards").update(patch).eq("id", award.id);
    if (error) return { success: false, error: plainDbError(error.message, "Couldn't save the award.") };
    await audit({
      cycleId: cycle.id,
      awardId: award.id,
      actorPersonId: gate.viewer.personId,
      action: "update",
      entity: "award",
      entityId: award.id,
      detail: { title, sort_order: sort, is_active: !!input.isActive, criteria_changed: (award.criteria ?? null) !== criteria },
    });
    done();
    return { success: true, data: { id: award.id }, message: `Saved ${title}.` };
  }

  if (!VERTICALS.includes(input.vertical)) return { success: false, error: "Choose a vertical." };
  const { data, error } = await svc
    .from("recognition_awards")
    .insert({ cycle_id: cycle.id, vertical: input.vertical, title, criteria, sort_order: sort, is_active: !!input.isActive })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message?.includes("duplicate key"))
      return { success: false, error: `This cycle already has a ${VERTICAL_LABEL[input.vertical]} award. Edit that one instead.` };
    return { success: false, error: plainDbError(error?.message, "Couldn't add the award.") };
  }
  const id = (data as { id: string }).id;
  await audit({ cycleId: cycle.id, awardId: id, actorPersonId: gate.viewer.personId, action: "create", entity: "award", entityId: id, detail: { vertical: input.vertical, title } });
  done();
  return { success: true, data: { id }, message: `Added ${title}.` };
}

export async function addAllAwards(): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "Open a cycle on the Timeline page first." };

  const existing = new Set((await listAwards(cycle.id, true)).map((a) => a.vertical));
  const missing = VERTICALS.filter((v) => !existing.has(v));
  if (missing.length === 0) return { success: true, message: "All seven awards already exist." };

  const rows = missing.map((v) => ({
    cycle_id: cycle.id,
    vertical: v,
    title: `${VERTICAL_LABEL[v]} Excellence`,
    sort_order: VERTICALS.indexOf(v) + 1,
    is_active: true,
  }));
  const { data, error } = await rxService().from("recognition_awards").insert(rows).select("id, vertical");
  if (error) return { success: false, error: plainDbError(error.message, "Couldn't add the awards.") };
  for (const r of (data ?? []) as Array<{ id: string; vertical: string }>) {
    await audit({ cycleId: cycle.id, awardId: r.id, actorPersonId: gate.viewer.personId, action: "create", entity: "award", entityId: r.id, detail: { vertical: r.vertical, via: "add_all" } });
  }
  done();
  return { success: true, message: `Added ${missing.length} award${missing.length === 1 ? "" : "s"}: ${missing.map((v) => VERTICAL_LABEL[v]).join(", ")}.` };
}

// ---------------------------------------------------------------------------
// Stage 2 escape hatch
// ---------------------------------------------------------------------------

/**
 * The spec only unlocks Stage 2 at 100% RM + 100% NMT submission and says
 * nothing about a missed deadline. This is the super admin's escape hatch
 * for that case: a reason is required and kept on the award and in the audit.
 */
export async function forceOpenStage2(input: { awardId: string; reason: string }): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const reason = (input.reason ?? "").trim();
  if (reason.length < 10) return { success: false, error: "Write the reason in a sentence. It is kept on the record." };

  const state = await getAwardState(input.awardId);
  if (!state) return { success: false, error: "That award no longer exists." };
  if (state.phase !== "stage1")
    return { success: false, error: "Stage 2 can only be forced open while the award is in Stage 1 scoring." };
  if (state.award.stage2_unlocked_at) return { success: true, message: "Stage 2 is already open for this award." };

  const now = new Date().toISOString();
  const { error } = await rxService()
    .from("recognition_awards")
    .update({ stage2_unlocked_at: now, stage2_unlock_reason: reason, stage2_unlocked_by: gate.viewer.personId, updated_at: now })
    .eq("id", input.awardId)
    .is("stage2_unlocked_at", null);
  if (error) return { success: false, error: "Couldn't open Stage 2. Try again." };

  await audit({
    cycleId: state.cycle.id,
    awardId: input.awardId,
    actorPersonId: gate.viewer.personId,
    action: "force_open_stage2",
    entity: "award",
    entityId: input.awardId,
    detail: { reason, rm: state.completeness.rm, nmt: state.completeness.nmt, blockers: state.completeness.blockers },
  });
  done();
  return { success: true, message: `Stage 2 is open for ${state.award.title}.` };
}

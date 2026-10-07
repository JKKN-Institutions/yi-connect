"use server";

import { revalidatePath } from "next/cache";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { audit, getAward, getCurrentCycle, listChapters } from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, REGIONS, RX_APP, RX_ROLES, type Category } from "@/lib/recognitions/constants";
import type { ActionResult } from "@/lib/recognitions/types";
import { ensureRole, findPersonByEmail, findRoleRow, type DirectoryPerson } from "../(desk)/admin/_lib/directory";
import { plainDbError } from "../(desk)/admin/_lib/ist";

/**
 * Control room: people. Evaluator duties, the Recognitions team, and the
 * Phase 0 chapter categories. People are FOUND in the Yi directory by
 * email, never created. Every role lands in yi_directory.role_assignments.
 */

function done() {
  revalidatePath("/recognitions", "layout");
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function lookupPerson(email: string): Promise<ActionResult<DirectoryPerson & { hasLogin: boolean }>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const r = await findPersonByEmail(email ?? "");
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, data: { ...r.person, hasLogin: !!r.person.user_id } };
}

// ---------------------------------------------------------------------------
// Evaluator duties
// ---------------------------------------------------------------------------

export async function assignEvaluator(input: {
  awardId: string;
  email: string;
  layer: "rm" | "nmt";
  region: string | null;
  isLeader: boolean;
  conflictChapterIds: string[];
}): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const award = await getAward(input.awardId);
  if (!award) return { success: false, error: "That award no longer exists." };
  const { data: cycleRow } = await rxService().from("recognition_cycles").select("id, yi_year").eq("id", award.cycle_id).maybeSingle();
  if (!cycleRow) return { success: false, error: "That award's cycle no longer exists." };
  const cycle = cycleRow as { id: string; yi_year: number };

  if (input.layer !== "rm" && input.layer !== "nmt") return { success: false, error: "Choose Regional Mentor or NMT." };
  const region = input.layer === "rm" ? (input.region ?? "").trim() : null;
  if (input.layer === "rm" && !REGIONS.includes(region as (typeof REGIONS)[number]))
    return { success: false, error: "Choose the Regional Mentor's region." };
  const isLeader = input.layer === "nmt" && !!input.isLeader;

  const chapterIds = new Set((await listChapters()).map((c) => c.id));
  const conflicts = [...new Set(input.conflictChapterIds ?? [])].filter((id) => chapterIds.has(id));

  const found = await findPersonByEmail(input.email ?? "");
  if (!found.ok) return { success: false, error: found.error };
  const person = found.person;
  const svc = rxService();

  // The Yi directory holds one RM row per person per year (its unique key has
  // no zone), so a person can mentor one region a year. Move the zone only
  // when no active duty still depends on the old one.
  if (input.layer === "rm") {
    const row = await findRoleRow({ personId: person.id, role: RX_ROLES.rm, yiYear: cycle.yi_year, yiChapter: null });
    if (row && row.is_active !== false && norm(row.yi_zone) !== "" && norm(row.yi_zone) !== norm(region)) {
      const { data: others } = await svc
        .from("recognition_evaluators")
        .select("id, region, award:recognition_awards!inner(cycle_id, title)")
        .eq("person_id", person.id)
        .eq("layer", "rm")
        .eq("is_active", true)
        .eq("award.cycle_id", cycle.id);
      const blocking = ((others ?? []) as unknown as Array<{ region: string | null; award: { title: string } }>).filter(
        (o) => norm(o.region) === norm(row.yi_zone)
      );
      if (blocking.length > 0)
        return {
          success: false,
          error: `${person.full_name} is already the Regional Mentor for ${row.yi_zone} (${blocking.map((b) => b.award.title).join(", ")}). The Yi directory allows one RM region per person per year. Remove those duties first, or choose someone else.`,
        };
    }
  }

  if (isLeader) {
    const { data: leader } = await svc
      .from("recognition_evaluators")
      .select("id, person_id")
      .eq("award_id", award.id)
      .eq("is_nmt_leader", true)
      .eq("is_active", true)
      .maybeSingle();
    const l = leader as { id: string; person_id: string } | null;
    if (l && l.person_id !== person.id)
      return { success: false, error: "This award already has an NMT leader. Remove that leader's duty first." };
  }

  const { data: existing } = await svc
    .from("recognition_evaluators")
    .select("id, is_active")
    .eq("award_id", award.id)
    .eq("person_id", person.id)
    .eq("layer", input.layer)
    .maybeSingle();
  const ex = existing as { id: string; is_active: boolean } | null;
  if (ex?.is_active)
    return { success: false, error: `${person.full_name} already has this duty on ${award.title}. Remove it first to change region or leader.` };

  let evaluatorId: string;
  const row = { region, is_nmt_leader: isLeader, conflict_chapter_ids: conflicts, is_active: true };
  if (ex) {
    const { error } = await svc.from("recognition_evaluators").update(row).eq("id", ex.id);
    if (error) return { success: false, error: plainDbError(error.message, "Couldn't assign the duty.") };
    evaluatorId = ex.id;
  } else {
    const { data, error } = await svc
      .from("recognition_evaluators")
      .insert({ ...row, award_id: award.id, person_id: person.id, layer: input.layer, created_by: gate.viewer.personId })
      .select("id")
      .single();
    if (error || !data) return { success: false, error: plainDbError(error?.message, "Couldn't assign the duty.") };
    evaluatorId = (data as { id: string }).id;
  }

  const role = input.layer === "rm" ? RX_ROLES.rm : isLeader ? RX_ROLES.nmtLeader : RX_ROLES.nmt;
  const ensured = await ensureRole({ personId: person.id, role, yiYear: cycle.yi_year, yiChapter: null, yiZone: region });
  if (!ensured.ok)
    return { success: false, error: `The duty was saved, but ${ensured.error.charAt(0).toLowerCase()}${ensured.error.slice(1)} Until then they can't open it.` };

  await audit({
    cycleId: cycle.id,
    awardId: award.id,
    actorPersonId: gate.viewer.personId,
    action: "assign",
    entity: "evaluator",
    entityId: evaluatorId,
    detail: { person_id: person.id, name: person.full_name, layer: input.layer, region, is_nmt_leader: isLeader, conflict_chapter_ids: conflicts, directory_role: role, directory_change: ensured.change },
  });
  done();
  const login = person.user_id ? "" : " They have no login yet, so they can't sign in until they create their Yi account login.";
  return { success: true, message: `${person.full_name} is now ${isLeader ? "NMT leader" : input.layer === "rm" ? `Regional Mentor (${region})` : "NMT"} on ${award.title}.${login}` };
}

/** Ends a duty but keeps the row (history). The directory role is left alone: other awards may use it, and the gate needs a duty too. */
export async function removeEvaluator(evaluatorId: string): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const svc = rxService();
  const { data } = await svc.from("recognition_evaluators").select("id, award_id, person_id, layer, region, is_active").eq("id", evaluatorId).maybeSingle();
  const ev = data as { id: string; award_id: string; person_id: string; layer: string; region: string | null; is_active: boolean } | null;
  if (!ev) return { success: false, error: "That duty no longer exists." };
  if (!ev.is_active) return { success: true, message: "That duty was already removed." };
  const award = await getAward(ev.award_id);
  const { error } = await svc.from("recognition_evaluators").update({ is_active: false, is_nmt_leader: false }).eq("id", ev.id);
  if (error) return { success: false, error: "Couldn't remove the duty. Try again." };
  await audit({
    cycleId: award?.cycle_id ?? null,
    awardId: ev.award_id,
    actorPersonId: gate.viewer.personId,
    action: "remove",
    entity: "evaluator",
    entityId: ev.id,
    detail: { person_id: ev.person_id, layer: ev.layer, region: ev.region },
  });
  done();
  return { success: true, message: "Duty removed. Their saved scores stay on record." };
}

export async function updateEvaluatorConflicts(input: { evaluatorId: string; conflictChapterIds: string[] }): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const svc = rxService();
  const { data } = await svc.from("recognition_evaluators").select("id, award_id, conflict_chapter_ids").eq("id", input.evaluatorId).maybeSingle();
  const ev = data as { id: string; award_id: string; conflict_chapter_ids: string[] } | null;
  if (!ev) return { success: false, error: "That duty no longer exists." };
  const chapterIds = new Set((await listChapters()).map((c) => c.id));
  const conflicts = [...new Set(input.conflictChapterIds ?? [])].filter((id) => chapterIds.has(id));
  const { error } = await svc.from("recognition_evaluators").update({ conflict_chapter_ids: conflicts }).eq("id", ev.id);
  if (error) return { success: false, error: "Couldn't save the conflicts. Try again." };
  const award = await getAward(ev.award_id);
  await audit({
    cycleId: award?.cycle_id ?? null,
    awardId: ev.award_id,
    actorPersonId: gate.viewer.personId,
    action: "edit_conflicts",
    entity: "evaluator",
    entityId: ev.id,
    detail: { from: ev.conflict_chapter_ids ?? [], to: conflicts },
  });
  done();
  return { success: true, message: "Declared conflicts saved." };
}

// ---------------------------------------------------------------------------
// Recognitions team (directory roles only)
// ---------------------------------------------------------------------------

const TEAM_ROLES = [RX_ROLES.superAdmin, RX_ROLES.nationalLeadership, RX_ROLES.chapterRep] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

async function teamYear(): Promise<{ year: number; cycleId: string | null }> {
  const cycle = await getCurrentCycle();
  return cycle ? { year: cycle.yi_year, cycleId: cycle.id } : { year: new Date().getFullYear(), cycleId: null };
}

export async function grantTeamRole(input: { email: string; role: TeamRole; chapterId: string | null }): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!TEAM_ROLES.includes(input.role)) return { success: false, error: "Choose a role." };

  let chapterName: string | null = null;
  if (input.role === RX_ROLES.chapterRep) {
    const chapter = (await listChapters()).find((c) => c.id === input.chapterId);
    if (!chapter) return { success: false, error: "A chapter representative needs a chapter. Choose one." };
    chapterName = chapter.name;
  }

  const found = await findPersonByEmail(input.email ?? "");
  if (!found.ok) return { success: false, error: found.error };
  const { year, cycleId } = await teamYear();
  const ensured = await ensureRole({ personId: found.person.id, role: input.role, yiYear: year, yiChapter: chapterName, yiZone: null });
  if (!ensured.ok) return { success: false, error: ensured.error };

  if (ensured.change !== "unchanged") {
    await audit({
      cycleId,
      actorPersonId: gate.viewer.personId,
      action: "grant",
      entity: "role",
      entityId: found.person.id,
      detail: { person_id: found.person.id, name: found.person.full_name, role: input.role, yi_chapter: chapterName, yi_year: year, change: ensured.change },
    });
  }
  done();
  if (ensured.change === "unchanged") return { success: true, message: `${found.person.full_name} already has that role.` };
  const login = found.person.user_id ? "" : " They have no login yet.";
  return { success: true, message: `${found.person.full_name} now has the role.${login}` };
}

export async function revokeTeamRole(assignmentId: string): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const svc = rxService().schema("yi_directory");
  const { data } = await svc
    .from("role_assignments")
    .select("id, person_id, app, role, yi_chapter, yi_year, is_active")
    .eq("id", assignmentId)
    .maybeSingle();
  const row = data as { id: string; person_id: string; app: string; role: string; yi_chapter: string | null; yi_year: number; is_active: boolean | null } | null;
  if (!row || row.app !== RX_APP || !TEAM_ROLES.includes(row.role as TeamRole))
    return { success: false, error: "That role can't be revoked here." };
  // A super admin can't remove their own access; another super admin must.
  if (row.role === RX_ROLES.superAdmin && row.person_id === gate.viewer.personId)
    return { success: false, error: "You can't revoke your own super admin role. Ask another super admin." };
  if (row.is_active === false) return { success: true, message: "That role was already revoked." };
  const { error } = await svc.from("role_assignments").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) return { success: false, error: "Couldn't revoke the role. Try again." };
  const { cycleId } = await teamYear();
  await audit({
    cycleId,
    actorPersonId: gate.viewer.personId,
    action: "revoke",
    entity: "role",
    entityId: row.person_id,
    detail: { assignment_id: row.id, person_id: row.person_id, role: row.role, yi_chapter: row.yi_chapter, yi_year: row.yi_year },
  });
  done();
  return { success: true, message: "Role revoked." };
}

// ---------------------------------------------------------------------------
// Phase 0: chapter categories
// ---------------------------------------------------------------------------

async function writeCategories(
  cycleId: string,
  actor: string,
  changes: Array<{ chapterId: string; category: Category | null }>
): Promise<{ ok: true; set: number; cleared: number } | { ok: false; error: string }> {
  const svc = rxService();
  const now = new Date().toISOString();
  const toSet = changes.filter((c) => c.category !== null);
  const toClear = changes.filter((c) => c.category === null).map((c) => c.chapterId);
  if (toSet.length > 0) {
    const { error } = await svc.from("recognition_chapter_categories").upsert(
      toSet.map((c) => ({ cycle_id: cycleId, chapter_id: c.chapterId, category: c.category, updated_by: actor, updated_at: now })),
      { onConflict: "cycle_id,chapter_id" }
    );
    if (error) return { ok: false, error: "Couldn't save the categories. Try again." };
  }
  if (toClear.length > 0) {
    const { error } = await svc.from("recognition_chapter_categories").delete().eq("cycle_id", cycleId).in("chapter_id", toClear);
    if (error) return { ok: false, error: "Couldn't clear some categories. Try again." };
  }
  return { ok: true, set: toSet.length, cleared: toClear.length };
}

export async function saveChapterCategories(changes: Array<{ chapterId: string; category: Category | null }>): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "Open a cycle on the Timeline page first." };
  const chapterIds = new Set((await listChapters()).map((c) => c.id));
  const clean = (changes ?? []).filter(
    (c) => chapterIds.has(c.chapterId) && (c.category === null || CATEGORIES.includes(c.category))
  );
  if (clean.length === 0) return { success: true, message: "Nothing changed." };
  const r = await writeCategories(cycle.id, gate.viewer.personId, clean);
  if (!r.ok) return { success: false, error: r.error };
  await audit({ cycleId: cycle.id, actorPersonId: gate.viewer.personId, action: "update", entity: "chapter_categories", detail: { set: r.set, cleared: r.cleared, changes: clean } });
  done();
  return { success: true, message: `Saved ${clean.length} chapter${clean.length === 1 ? "" : "s"}.` };
}

export async function pasteChapterCategories(text: string): Promise<ActionResult<{ applied: number; unmatched: string[] }>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "Open a cycle on the Timeline page first." };

  const chapters = await listChapters();
  const byName = new Map(chapters.map((c) => [norm(c.name), c]));
  const byCategory = new Map<string, Category>();
  for (const c of CATEGORIES) {
    byCategory.set(c, c);
    byCategory.set(norm(CATEGORY_LABEL[c]), c);
  }

  const unmatched: string[] = [];
  const changes = new Map<string, Category>();
  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    // Split on the LAST comma or tab, so a chapter name may itself contain a comma.
    const cut = Math.max(line.lastIndexOf(","), line.lastIndexOf("\t"));
    if (cut <= 0) {
      unmatched.push(`${line} — write it as "chapter name, category"`);
      continue;
    }
    const name = line.slice(0, cut).trim();
    const catText = norm(line.slice(cut + 1));
    const chapter = byName.get(norm(name)) ?? byName.get(norm(name.replace(/^yi\s+/i, "")));
    const category = byCategory.get(catText) ?? byCategory.get(catText.replace(/s$/, "") + "s");
    if (!chapter) {
      unmatched.push(`${line} — no active chapter called "${name}"`);
      continue;
    }
    if (!category) {
      unmatched.push(`${line} — category must be Pioneers, Trailblazers or Sparks`);
      continue;
    }
    changes.set(chapter.id, category);
  }

  if (changes.size === 0)
    return { success: false, error: unmatched.length ? `None of the lines matched. ${unmatched.slice(0, 3).join("; ")}` : "Paste at least one line." };

  const list = [...changes.entries()].map(([chapterId, category]) => ({ chapterId, category }));
  const r = await writeCategories(cycle.id, gate.viewer.personId, list);
  if (!r.ok) return { success: false, error: r.error };
  await audit({ cycleId: cycle.id, actorPersonId: gate.viewer.personId, action: "paste", entity: "chapter_categories", detail: { applied: list.length, unmatched } });
  done();
  return {
    success: true,
    data: { applied: list.length, unmatched },
    message: `Saved ${list.length} chapter${list.length === 1 ? "" : "s"}.${unmatched.length ? ` ${unmatched.length} line${unmatched.length === 1 ? "" : "s"} didn't match.` : ""}`,
  };
}

"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import {
  PARLIAMENT_ROLES,
  EX_PARLIAMENT_ROLES,
  type ParliamentRole,
} from "@/lib/yip/constants";
import { roleSlugOptions } from "@/lib/yip/scoring-roles";
import {
  normaliseRoundLevels,
  describeRoundLevels,
  type RoundLevel,
} from "@/lib/yip/round-level";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type SubCriterion = {
  key: string; // dotted "<parentKey>.<childKey>" — unique across the rubric
  label: string;
  max_score: number;
};

export type RubricCriterion = {
  key: string;
  label: string;
  max_score: number;
  description?: string | null;
  /**
   * Handbook p.20: MP rubric has 17 sub-criteria nested in 5 parents.
   * When present, the parent max_score MUST equal the sum of child max_scores.
   * When absent (flat), the parent is scored as a single slot (legacy shape).
   */
  sub_criteria?: SubCriterion[] | null;
  /**
   * Parliament role slugs this criterion applies to (S2-5).
   * Absent / null / empty = applies to every role (legacy shape).
   */
  roles?: string[] | null;
};

export type Rubric = {
  id: string;
  name: string;
  target_role: ParliamentRole;
  criteria: RubricCriterion[];
  total_max: number;
  is_default: boolean;
  is_active: boolean;
  /**
   * Round levels this rubric applies to (yip.rubrics.levels).
   * null = every level — how all three production rubrics behave today.
   */
  levels: RoundLevel[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RubricInput = {
  name: string;
  target_role: ParliamentRole;
  criteria: RubricCriterion[];
  is_default?: boolean;
  is_active?: boolean;
  /** Round level scope. Omitted / null / all three = every level. */
  levels?: RoundLevel[] | null;
};

const RUBRICS_PATH = "/dashboard/admin/rubrics";
// All slugs a criterion may be scoped to — assignable roles, the
// system-assigned ex- roles (a participant can hold one at scoring time), and
// the BENCH pseudo-slugs from lib/yip/scoring-roles.ts.
//
// The benches are the addition. "The presenter" and "the opposition" in a
// Government Bill are benches, not parliament roles — a ruling MP and an
// opposition MP both have parliament_role = 'mp' — so without them the national
// admin's 6 (ruling) + 4 (both) + 6 (opposition) split is INEXPRESSIBLE on a
// rubric, and this action rejected the tag outright. roleSlugOptions() is the
// same list the editor renders, so the screen and the validator cannot drift.
// This is strictly a WIDENING: every slug accepted before is still accepted.
const KNOWN_ROLE_SLUGS = new Set<string>([
  ...PARLIAMENT_ROLES,
  ...EX_PARLIAMENT_ROLES,
  ...roleSlugOptions().map((o) => o.slug),
]);
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
// Sub-criterion keys are dotted: "<parentKey>.<childKey>"
const SUB_KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

function normaliseCriteria(
  raw: unknown
): { ok: true; criteria: RubricCriterion[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Criteria must be an array" };
  }
  if (raw.length === 0) {
    return { ok: false, error: "At least one criterion is required" };
  }

  const cleaned: RubricCriterion[] = [];
  const seenKeys = new Set<string>();
  const seenChildKeys = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Partial<RubricCriterion>;
    const key = (row.key ?? "").trim();
    const label = (row.label ?? "").trim();
    const description = (row.description ?? "").toString().trim();

    if (!key) return { ok: false, error: `Row ${i + 1}: key is required` };
    if (!KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error: `Row ${i + 1}: key "${key}" must be lowercase_snake_case (letters, digits, underscores; starts with a letter)`,
      };
    }
    if (seenKeys.has(key)) {
      return { ok: false, error: `Duplicate criterion key: "${key}"` };
    }
    seenKeys.add(key);

    if (!label) return { ok: false, error: `Row ${i + 1}: label is required` };

    // ── Optional role scoping (S2-5) ────────────────────────────
    // Empty / absent normalises to null = applies to everyone.
    let cleanRoles: string[] | null = null;
    if (row.roles != null) {
      if (!Array.isArray(row.roles)) {
        return { ok: false, error: `Row ${i + 1}: roles must be an array` };
      }
      const seenRoles = new Set<string>();
      for (const r of row.roles) {
        const slug = typeof r === "string" ? r.trim() : "";
        if (!slug || !KNOWN_ROLE_SLUGS.has(slug)) {
          return {
            ok: false,
            error: `Row ${i + 1}: unknown role "${String(r)}" in roles`,
          };
        }
        seenRoles.add(slug);
      }
      cleanRoles = seenRoles.size > 0 ? Array.from(seenRoles) : null;
    }

    // ── Optional nested sub_criteria ────────────────────────────
    const rawSubs = Array.isArray(row.sub_criteria) ? row.sub_criteria : null;
    let cleanSubs: SubCriterion[] | null = null;
    let effectiveMax: number;

    if (rawSubs && rawSubs.length > 0) {
      const subs: SubCriterion[] = [];
      const parentChildKeys = new Set<string>();

      for (let j = 0; j < rawSubs.length; j++) {
        const sub = rawSubs[j] as Partial<SubCriterion>;
        const subKey = (sub.key ?? "").trim();
        const subLabel = (sub.label ?? "").trim();
        const subMax = Number(sub.max_score);

        if (!subKey) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key is required`,
          };
        }
        if (!SUB_KEY_PATTERN.test(subKey)) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key "${subKey}" must be dotted like "${key}.<child>"`,
          };
        }
        if (!subKey.startsWith(`${key}.`)) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: key "${subKey}" must start with "${key}."`,
          };
        }
        if (parentChildKeys.has(subKey)) {
          return {
            ok: false,
            error: `Duplicate sub-criterion key within "${key}": "${subKey}"`,
          };
        }
        parentChildKeys.add(subKey);
        if (seenChildKeys.has(subKey)) {
          return {
            ok: false,
            error: `Duplicate sub-criterion key across rubric: "${subKey}"`,
          };
        }
        seenChildKeys.add(subKey);

        if (!subLabel) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: label is required`,
          };
        }
        if (!Number.isFinite(subMax) || subMax < 1) {
          return {
            ok: false,
            error: `Row ${i + 1} sub-row ${j + 1}: max_score must be an integer >= 1`,
          };
        }

        subs.push({
          key: subKey,
          label: subLabel,
          max_score: Math.round(subMax),
        });
      }

      const childSum = subs.reduce((s, sc) => s + sc.max_score, 0);
      // If the incoming parent max_score is present, require it to match the
      // derived child sum. Otherwise default the parent max to the child sum.
      const declaredMax = Number(row.max_score);
      if (Number.isFinite(declaredMax) && declaredMax > 0) {
        if (Math.round(declaredMax) !== childSum) {
          return {
            ok: false,
            error: `Row ${i + 1}: parent max_score (${Math.round(declaredMax)}) must equal sum of sub-criteria max_scores (${childSum})`,
          };
        }
      }
      effectiveMax = childSum;
      cleanSubs = subs;
    } else {
      const max = Number(row.max_score);
      if (!Number.isFinite(max) || max < 1) {
        return {
          ok: false,
          error: `Row ${i + 1}: max_score must be an integer >= 1`,
        };
      }
      effectiveMax = Math.round(max);
    }

    cleaned.push({
      key,
      label,
      max_score: effectiveMax,
      description: description || null,
      sub_criteria: cleanSubs,
      roles: cleanRoles,
    });
  }

  return { ok: true, criteria: cleaned };
}

function validateInput(
  input: RubricInput
):
  | {
      ok: true;
      clean: Omit<RubricInput, "criteria"> & {
        criteria: RubricCriterion[];
        total_max: number;
        levels: RoundLevel[] | null;
      };
    }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Name must be at least 3 characters" };
  }
  if (!input.target_role) {
    return { ok: false, error: "Target role is required" };
  }

  const parsed = normaliseCriteria(input.criteria);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const total_max = parsed.criteria.reduce((sum, c) => sum + c.max_score, 0);

  // Round-level scope. normaliseRoundLevels() drops unknown values, de-dupes,
  // orders chapter -> regional -> national, and collapses both "nothing chosen"
  // and "all three chosen" to null = every level, so one scope always stores as
  // one array and the unique index can compare arrays literally.
  const levels = normaliseRoundLevels(input.levels ?? null);
  const is_default = !!input.is_default;

  // A level-scoped rubric wins by SCOPE, never by the default flag. Enforced in
  // the database too (rubrics_scoped_never_default), and it is what keeps the
  // as-yet-unmigrated consumer correct: getRubricForRole() in
  // app/yip/actions/scoring.ts still runs `.eq(is_default,true).single()` with
  // no level filter, and `.single()` errors the moment two rows come back.
  // Rejecting here rather than silently clearing the flag, so nobody's "make
  // this the default" click disappears without explanation.
  if (levels !== null && is_default) {
    return {
      ok: false,
      error: `A rubric limited to ${describeRoundLevels(levels)} cannot also be the role default. The level scope already decides when it is used — clear the default tick, or remove the level scope to make it the shared rubric for every round.`,
    };
  }

  return {
    ok: true,
    clean: {
      name,
      target_role: input.target_role,
      is_default,
      is_active: input.is_active !== false,
      criteria: parsed.criteria,
      total_max,
      levels,
    },
  };
}

/**
 * Read the `levels` column off a rubrics row.
 *
 * types/yip/database.ts is GENERATED and does not carry this column yet.
 * Regenerating it is not this change's file to own — several level-scoping
 * branches are in flight against that one file at the same time — so the column
 * is read through a narrow cast instead. normaliseRoundLevels() doubles as the
 * guard against an unexpected value arriving from the database.
 */
/**
 * Turn the database's uniqueness complaints into something a non-technical
 * super-admin can act on. Both indexes are new in the round-level migration, so
 * without this the only feedback would be a raw Postgres 23505 string.
 */
function friendlyWriteError(
  error: { code?: string | null; message: string } | null,
  fallback: string
): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  if (error.code === "23505" || msg.includes("duplicate key")) {
    if (msg.includes("rubrics_one_active_scoped_per_role")) {
      return "Another active rubric already covers this role at this round level. Deactivate that one first, then activate this.";
    }
    if (msg.includes("rubrics_one_global_default_per_role")) {
      return "Another rubric is already the default for this role. Clear that default first.";
    }
  }
  if (msg.includes("rubrics_scoped_never_default")) {
    return "A rubric limited to certain round levels cannot also be the role default — the level scope already decides when it is used.";
  }
  return msg || fallback;
}

function readLevels(row: unknown): RoundLevel[] | null {
  return normaliseRoundLevels(
    (row as { levels?: unknown } | null)?.levels ?? null
  );
}

function rowToRubric(row: {
  id: string;
  name: string;
  target_role: ParliamentRole;
  criteria: unknown;
  total_max: number;
  is_default: boolean | null;
  is_active: boolean | null;
  levels: RoundLevel[] | null;
  created_at: string | null;
  updated_at: string | null;
}): Rubric {
  const criteria = Array.isArray(row.criteria)
    ? (row.criteria as RubricCriterion[]).map((c) => ({
        key: c.key,
        label: c.label,
        max_score: Number(c.max_score),
        description: c.description ?? null,
        sub_criteria: Array.isArray(c.sub_criteria)
          ? c.sub_criteria.map((sc) => ({
              key: sc.key,
              label: sc.label,
              max_score: Number(sc.max_score),
            }))
          : null,
        roles:
          Array.isArray(c.roles) && c.roles.length > 0
            ? c.roles.filter((r): r is string => typeof r === "string")
            : null,
      }))
    : [];
  return {
    id: row.id,
    name: row.name,
    target_role: row.target_role,
    criteria,
    total_max: row.total_max,
    is_default: !!row.is_default,
    is_active: row.is_active !== false,
    levels: row.levels,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listRubrics(
  includeInactive: boolean = true
): Promise<Rubric[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("rubrics")
    .select("*")
    .order("target_role", { ascending: true })
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (!includeInactive) q = q.eq("is_active", true);

  const { data } = await q;
  return (data ?? []).map((r) =>
    rowToRubric({
      id: r.id,
      name: r.name,
      target_role: r.target_role,
      criteria: r.criteria,
      total_max: r.total_max,
      is_default: r.is_default,
      is_active: r.is_active,
      levels: readLevels(r),
      created_at: r.created_at,
      updated_at: r.updated_at,
    })
  );
}

export async function getRubric(id: string): Promise<Rubric | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) return null;
  return rowToRubric({
    id: data.id,
    name: data.name,
    target_role: data.target_role,
    criteria: data.criteria,
    total_max: data.total_max,
    is_default: data.is_default,
    is_active: data.is_active,
    levels: readLevels(data),
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}

/**
 * Clear the "default" flag from the GLOBAL rubric(s) of one role.
 *
 * `.is("levels", null)` is the round-level fix, and it is step 2 of the recipe
 * in lib/yip/round-level.ts: this write addresses rows by KEY (target_role +
 * is_default), not by row id, so once a second dimension exists the key has to
 * grow with it. Without the filter, saving a REGIONAL rubric would reach across
 * and un-default the shared rubric that every chapter round still marks
 * against — a silent scoring change to rounds nobody touched.
 *
 * In practice a scoped rubric can never be a default at all (see validateInput
 * and the rubrics_scoped_never_default constraint), so this filter is belt and
 * braces — but it is the belt that makes the invariant hold no matter which
 * side is edited first.
 */
async function clearDefaultForRole(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  role: ParliamentRole,
  exceptId?: string
): Promise<void> {
  let q = supabase
    .from("rubrics")
    .update({ is_default: false })
    .eq("target_role", role)
    .eq("is_default", true)
    .is("levels", null);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

export async function createRubric(
  input: RubricInput
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  if (clean.is_default) {
    await clearDefaultForRole(supabase, clean.target_role);
  }

  const { data, error } = await supabase
    .from("rubrics")
    .insert({
      name: clean.name,
      target_role: clean.target_role,
      criteria: clean.criteria as unknown as never,
      total_max: clean.total_max,
      is_default: clean.is_default,
      is_active: clean.is_active,
      // Cast for the same reason as readLevels(): the generated row type does
      // not carry `levels` yet and that file is not this change's to regenerate.
      levels: clean.levels as unknown as never,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      success: false,
      error: friendlyWriteError(error, "Failed to create rubric"),
    };
  }

  revalidatePath(RUBRICS_PATH);
  return {
    success: true,
    data: rowToRubric({
      id: data.id,
      name: data.name,
      target_role: data.target_role,
      criteria: data.criteria,
      total_max: data.total_max,
      is_default: data.is_default,
      is_active: data.is_active,
      levels: readLevels(data),
      created_at: data.created_at,
      updated_at: data.updated_at,
    }),
  };
}

export async function updateRubric(
  id: string,
  input: RubricInput
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  if (clean.is_default) {
    await clearDefaultForRole(supabase, clean.target_role, id);
  }

  const { data, error } = await supabase
    .from("rubrics")
    .update({
      name: clean.name,
      target_role: clean.target_role,
      criteria: clean.criteria as unknown as never,
      total_max: clean.total_max,
      is_default: clean.is_default,
      is_active: clean.is_active,
      levels: clean.levels as unknown as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return {
      success: false,
      error: friendlyWriteError(error, "Failed to update rubric"),
    };
  }

  revalidatePath(RUBRICS_PATH);
  return {
    success: true,
    data: rowToRubric({
      id: data.id,
      name: data.name,
      target_role: data.target_role,
      criteria: data.criteria,
      total_max: data.total_max,
      is_default: data.is_default,
      is_active: data.is_active,
      levels: readLevels(data),
      created_at: data.created_at,
      updated_at: data.updated_at,
    }),
  };
}

/**
 * Copy a rubric. The copy inherits the source's ROUND-LEVEL SCOPE unless the
 * caller overrides it — a "copy" that silently applied to every round when the
 * original was regional-only would be a different rubric, not a copy. When an
 * active rubric already occupies that role at that scope, createRubric surfaces
 * the plain-English clash message from friendlyWriteError().
 */
export async function cloneRubric(
  id: string,
  opts: { newName: string; newRole?: ParliamentRole; newLevels?: RoundLevel[] | null }
): Promise<ActionResult<Rubric>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const source = await getRubric(id);
  if (!source) return { success: false, error: "Source rubric not found" };

  const newName = (opts.newName ?? "").trim();
  if (newName.length < 3) {
    return { success: false, error: "New name must be at least 3 characters" };
  }

  return createRubric({
    name: newName,
    target_role: opts.newRole ?? source.target_role,
    criteria: source.criteria.map((c) => ({
      ...c,
      sub_criteria: Array.isArray(c.sub_criteria)
        ? c.sub_criteria.map((sc) => ({ ...sc }))
        : null,
      roles: Array.isArray(c.roles) ? [...c.roles] : null,
    })),
    is_default: false,
    is_active: true,
    levels:
      opts.newLevels !== undefined
        ? opts.newLevels
        : source.levels
          ? [...source.levels]
          : null,
  });
}

export async function deactivateRubric(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { data: target } = await supabase
    .from("rubrics")
    .select("id, target_role, is_default, is_active")
    .eq("id", id)
    .single();

  if (!target) return { success: false, error: "Rubric not found" };

  if (target.is_default) {
    // Refuse to deactivate a default if no active alternative exists for the role.
    //
    // `.is("levels", null)` matters: a rubric scoped to regional rounds is NOT a
    // replacement for the shared default, because chapter and national rounds
    // would then resolve to nothing at all. Only another GLOBAL rubric counts.
    const { data: alternatives } = await supabase
      .from("rubrics")
      .select("id")
      .eq("target_role", target.target_role)
      .eq("is_active", true)
      .is("levels", null)
      .neq("id", id);

    if (!alternatives || alternatives.length === 0) {
      return {
        success: false,
        error:
          "Cannot deactivate the only default rubric for this role. Create or activate another rubric first.",
      };
    }
  }

  const { error } = await supabase
    .from("rubrics")
    .update({
      is_active: false,
      is_default: false, // a soft-deleted rubric should never be a default
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}

export async function reactivateRubric(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("rubrics")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  // Reactivating a level-scoped rubric can collide with the one already active
  // for that role and level — say so in plain English rather than leaking 23505.
  if (error) {
    return {
      success: false,
      error: friendlyWriteError(error, "Failed to reactivate rubric"),
    };
  }
  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}

export async function setAsDefault(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { data: target } = await supabase
    .from("rubrics")
    // "*" rather than a column list: `levels` is not in the generated row type
    // yet (see readLevels), and naming it explicitly would not type-check.
    .select("*")
    .eq("id", id)
    .single();

  if (!target) return { success: false, error: "Rubric not found" };

  // "Default" is a property of the SHARED rubric only. A level-scoped rubric is
  // already chosen by its scope, and flagging it would put two is_default rows
  // under one role — which the still-unmigrated
  // app/yip/actions/scoring.ts#getRubricForRole reads with `.single()`, so it
  // would return NOTHING and every juror would lose their fallback sheet.
  const targetLevels = readLevels(target);
  if (targetLevels !== null) {
    return {
      success: false,
      error: `This rubric only applies to ${describeRoundLevels(targetLevels)} rounds, so it cannot be the role default. It is already used automatically for those rounds.`,
    };
  }

  // Clear previous default(s) for this role…
  await clearDefaultForRole(supabase, target.target_role, id);

  // …then set this one as default AND ensure it's active.
  const { error } = await supabase
    .from("rubrics")
    .update({
      is_default: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(RUBRICS_PATH);
  return { success: true, data: null };
}
